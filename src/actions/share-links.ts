"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hash } from "@node-rs/argon2";
import { requireStudio } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateShareToken } from "@/lib/share";

const createSchema = z.object({
  galleryId: z.string().min(1),
  label: z.string().trim().max(100).optional(),
  password: z.string().max(200).optional(),
  expiresAt: z.string().optional(),
  selectionLimit: z.coerce.number().int().positive().max(100000).optional(),
  allowDownload: z.boolean(),
});

export async function createShareLink(formData: FormData) {
  const { studio } = await requireStudio();
  const parsed = createSchema.parse({
    galleryId: formData.get("galleryId"),
    label: formData.get("label") || undefined,
    password: formData.get("password") || undefined,
    expiresAt: formData.get("expiresAt") || undefined,
    selectionLimit: formData.get("selectionLimit") || undefined,
    allowDownload: formData.get("allowDownload") === "on",
  });

  const gallery = await prisma.gallery.findUnique({
    where: { id: parsed.galleryId, studioId: studio.id },
  });
  if (!gallery) throw new Error("Gallery not found");

  await prisma.shareLink.create({
    data: {
      galleryId: gallery.id,
      token: generateShareToken(),
      label: parsed.label,
      passwordHash: parsed.password ? await hash(parsed.password) : null,
      expiresAt: parsed.expiresAt ? new Date(parsed.expiresAt) : null,
      selectionLimit: parsed.selectionLimit,
      allowDownload: parsed.allowDownload,
    },
  });
  revalidatePath(`/dashboard/galleries/${gallery.id}/share`);
}

export async function revokeShareLink(linkId: string) {
  const { studio } = await requireStudio();
  const link = await prisma.shareLink.findUnique({
    where: { id: linkId },
    include: { gallery: { select: { id: true, studioId: true } } },
  });
  if (!link || link.gallery.studioId !== studio.id) throw new Error("Link not found");

  await prisma.shareLink.update({
    where: { id: link.id },
    data: { revokedAt: new Date() },
  });
  revalidatePath(`/dashboard/galleries/${link.gallery.id}/share`);
}
