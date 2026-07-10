import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getStudioContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStorageForStudio } from "@/lib/storage";

const bodySchema = z.object({
  fileId: z.string().min(1),
  driveFileId: z.string().min(1).max(200),
});

export async function POST(req: NextRequest) {
  const ctx = await getStudioContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const { fileId, driveFileId } = parsed.data;

  const file = await prisma.file.findUnique({
    where: { id: fileId, studioId: ctx.studio.id },
  });
  if (!file) return NextResponse.json({ error: "file_not_found" }, { status: 404 });
  if (file.status === "READY") return NextResponse.json({ ok: true });

  const { provider } = await getStorageForStudio(ctx.studio.id);

  // Trust nothing from the browser: confirm the file really landed in Drive
  let meta;
  try {
    meta = await provider.getFileMeta(driveFileId);
  } catch {
    await prisma.file.update({ where: { id: file.id }, data: { status: "FAILED" } });
    return NextResponse.json({ error: "drive_file_not_found" }, { status: 400 });
  }

  await prisma.file.update({
    where: { id: file.id },
    data: {
      driveFileId,
      status: "READY",
      sizeBytes: BigInt(meta.sizeBytes || Number(file.sizeBytes)),
      width: meta.width ?? file.width,
      height: meta.height ?? file.height,
    },
  });

  return NextResponse.json({ ok: true });
}
