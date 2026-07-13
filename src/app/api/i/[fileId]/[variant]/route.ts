import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyImageSig } from "@/lib/crypto";
import { getStorage } from "@/lib/storage";
import {
  RemoteFileMissingError,
  StorageNotConnectedError,
  StorageRevokedError,
} from "@/lib/storage/types";

const VARIANT_SIZES: Record<string, number> = { thumb: 400, web: 1600 };
const CACHE_HEADER = "public, max-age=31536000, immutable";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ fileId: string; variant: string }> }
) {
  const { fileId, variant } = await params;
  if (!(variant in VARIANT_SIZES) && variant !== "full") {
    return NextResponse.json({ error: "bad_variant" }, { status: 400 });
  }

  const exp = req.nextUrl.searchParams.get("exp") ?? "";
  const sig = req.nextUrl.searchParams.get("sig") ?? "";
  if (!verifyImageSig(fileId, variant, exp, sig)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 403 });
  }

  const file = await prisma.file.findUnique({ where: { id: fileId } });
  if (!file || file.status !== "READY" || !file.driveFileId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    const { provider } = await getStorage();

    if (variant !== "full") {
      const sizePx = VARIANT_SIZES[variant];
      // Drive-hosted thumbnails do the resizing for us; links expire after a
      // few hours, so retry once with a fresh link before falling back
      for (let attempt = 0; attempt < 2; attempt++) {
        const url = await provider.getThumbnailUrl(file.driveFileId, sizePx);
        if (!url) break;
        const res = await fetch(url);
        if (res.ok && res.body) {
          return new NextResponse(res.body, {
            headers: {
              "Content-Type": res.headers.get("content-type") ?? "image/jpeg",
              "Cache-Control": CACHE_HEADER,
            },
          });
        }
        provider.forgetThumbnail(file.driveFileId);
      }
    }

    const media = await provider.getFileStream(file.driveFileId, {
      range: req.headers.get("range") ?? undefined,
    });
    return new NextResponse(media.stream, {
      status: media.status,
      headers: {
        ...media.headers,
        "Content-Type": media.headers["content-type"] ?? file.mimeType,
        "Cache-Control": CACHE_HEADER,
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
