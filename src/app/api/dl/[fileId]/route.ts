import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStudioContext } from "@/lib/auth";
import { readClientSession } from "@/lib/client-session";
import { resolveShareLink } from "@/lib/share";
import { getStorageForStudio } from "@/lib/storage";
import {
  RemoteFileMissingError,
  StorageNotConnectedError,
  StorageRevokedError,
} from "@/lib/storage/types";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const { fileId } = await params;
  const file = await prisma.file.findUnique({
    where: { id: fileId },
    include: { gallery: { select: { allowDownload: true } } },
  });
  if (!file || file.status !== "READY" || !file.driveFileId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Authorize: either the owning studio's session, or a client session on a
  // live share link for this gallery with downloads enabled.
  const token = req.nextUrl.searchParams.get("t");
  let authorized = false;
  if (token) {
    const resolved = await resolveShareLink(token);
    if (
      resolved.status === "ok" &&
      resolved.link.galleryId === file.galleryId &&
      resolved.link.allowDownload &&
      file.gallery.allowDownload
    ) {
      const claims = await readClientSession(resolved.link.id);
      authorized = !!claims && (!resolved.link.passwordHash || claims.pwOk);
    }
  } else {
    const ctx = await getStudioContext();
    authorized = !!ctx && ctx.studio.id === file.studioId;
  }
  if (!authorized) return NextResponse.json({ error: "unauthorized" }, { status: 403 });

  try {
    const { provider } = await getStorageForStudio(file.studioId);
    const media = await provider.getFileStream(file.driveFileId, {
      range: req.headers.get("range") ?? undefined,
    });
    const inline = req.nextUrl.searchParams.get("inline") === "1";
    return new NextResponse(media.stream, {
      status: media.status,
      headers: {
        ...media.headers,
        "Content-Type": media.headers["content-type"] ?? file.mimeType,
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${encodeURIComponent(file.filename)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    if (e instanceof RemoteFileMissingError) {
      await prisma.file.update({ where: { id: file.id }, data: { status: "MISSING" } });
      return NextResponse.json({ error: "gone" }, { status: 404 });
    }
    if (e instanceof StorageNotConnectedError || e instanceof StorageRevokedError) {
      return NextResponse.json({ error: "storage_unavailable" }, { status: 503 });
    }
    throw e;
  }
}
