import { NextRequest, NextResponse } from "next/server";
import { PassThrough, Readable } from "stream";
import { ZipArchive } from "archiver";
import { prisma } from "@/lib/prisma";
import { readClientSession } from "@/lib/client-session";
import { resolveShareLink } from "@/lib/share";
import { getStorage } from "@/lib/storage";

export const maxDuration = 300;

/** Streams the whole gallery (or just favorites with ?favorites=1) as a ZIP. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const resolved = await resolveShareLink(token);
  if (resolved.status !== "ok") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const { link } = resolved;

  const claims = await readClientSession(link.id);
  if (!claims || (link.passwordHash && !claims.pwOk)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  }
  if (!link.allowDownload || !link.gallery.allowDownload) {
    return NextResponse.json({ error: "downloads_disabled" }, { status: 403 });
  }

  const onlyFavorites = req.nextUrl.searchParams.get("favorites") === "1";
  const files = await prisma.file.findMany({
    where: {
      galleryId: link.galleryId,
      status: "READY",
      driveFileId: { not: null },
      ...(onlyFavorites
        ? { favorites: { some: { clientSessionId: claims.sid } } }
        : {}),
    },
    orderBy: { sortOrder: "asc" },
    select: { filename: true, driveFileId: true },
  });
  if (files.length === 0) {
    return NextResponse.json({ error: "no_files" }, { status: 404 });
  }

  const { provider } = await getStorage();
  const archive = new ZipArchive({ zlib: { level: 0 } }); // photos don't recompress
  const out = new PassThrough();
  archive.pipe(out);

  // Drive fetches happen sequentially inside the archive stream; errors after
  // headers are sent surface as a truncated zip, which is the best we can do
  (async () => {
    try {
      const seen = new Set<string>();
      for (const f of files) {
        let name = f.filename;
        for (let n = 2; seen.has(name); n++) {
          name = f.filename.replace(/(\.[^.]+)?$/, ` (${n})$1`);
        }
        seen.add(name);
        // fetch lazily and wait for each entry to drain — keeping hundreds of
        // Drive sockets open in parallel would hit timeouts
        const media = await provider.getFileStream(f.driveFileId!);
        const entryDone = new Promise<void>((res) => archive.once("entry", () => res()));
        archive.append(Readable.fromWeb(media.stream as never), { name });
        await entryDone;
      }
      await archive.finalize();
    } catch (e) {
      archive.destroy(e instanceof Error ? e : new Error("zip failed"));
    }
  })();

  const zipName = `${link.gallery.title.replace(/[^\w\s.-]/g, "").trim() || "gallery"}${
    onlyFavorites ? " - favorites" : ""
  }.zip`;

  return new NextResponse(Readable.toWeb(out) as ReadableStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(zipName)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
