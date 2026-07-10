import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import pLimit from "p-limit";
import { getStudioContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStorageForStudio } from "@/lib/storage";
import { StorageNotConnectedError, StorageRevokedError } from "@/lib/storage/types";

const bodySchema = z.object({
  galleryId: z.string().min(1),
  files: z
    .array(
      z.object({
        filename: z.string().min(1).max(255),
        mimeType: z.string().min(1).max(100),
        sizeBytes: z.number().int().positive().max(20 * 1024 * 1024 * 1024),
        width: z.number().int().positive().optional(),
        height: z.number().int().positive().optional(),
        takenAt: z.string().datetime().optional(),
      })
    )
    .min(1)
    .max(50),
});

export async function POST(req: NextRequest) {
  const ctx = await getStudioContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", details: parsed.error.flatten() }, { status: 400 });
  }
  const { galleryId, files } = parsed.data;

  const gallery = await prisma.gallery.findUnique({
    where: { id: galleryId, studioId: ctx.studio.id },
  });
  if (!gallery) return NextResponse.json({ error: "gallery_not_found" }, { status: 404 });

  let storage;
  try {
    storage = await getStorageForStudio(ctx.studio.id);
  } catch (e) {
    if (e instanceof StorageNotConnectedError || e instanceof StorageRevokedError) {
      return NextResponse.json({ error: "storage_not_connected" }, { status: 409 });
    }
    throw e;
  }
  const { provider, connection } = storage;

  let folderId = gallery.driveFolderId;
  if (!folderId) {
    folderId = await provider.createFolder(gallery.title, connection.rootFolderId);
    await prisma.gallery.update({
      where: { id: gallery.id },
      data: { driveFolderId: folderId },
    });
  }

  const maxSort = await prisma.file.aggregate({
    where: { galleryId: gallery.id },
    _max: { sortOrder: true },
  });
  let nextSort = (maxSort._max.sortOrder ?? 0) + 1;

  const limit = pLimit(5);
  const results = await Promise.all(
    files.map((f) => {
      const sortOrder = nextSort++;
      return limit(async () => {
        const row = await prisma.file.create({
          data: {
            galleryId: gallery.id,
            studioId: ctx.studio.id,
            filename: f.filename,
            mimeType: f.mimeType,
            sizeBytes: BigInt(f.sizeBytes),
            width: f.width,
            height: f.height,
            takenAt: f.takenAt ? new Date(f.takenAt) : null,
            sortOrder,
          },
        });
        try {
          const { uploadUrl } = await provider.initiateResumableUpload({
            folderId: folderId!,
            filename: f.filename,
            mimeType: f.mimeType,
            sizeBytes: f.sizeBytes,
          });
          return { fileId: row.id, filename: f.filename, uploadUrl };
        } catch (e) {
          await prisma.file.update({
            where: { id: row.id },
            data: { status: "FAILED" },
          });
          return {
            fileId: row.id,
            filename: f.filename,
            error: e instanceof Error ? e.message : "initiate_failed",
          };
        }
      });
    })
  );

  return NextResponse.json({ files: results });
}
