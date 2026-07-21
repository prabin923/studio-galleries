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
  selectionClosesAt: z.string().optional(),
  allowDownload: z.boolean(),
});

function endOfUtcDay(value: string): Date {
  const date = new Date(`${value}T23:59:59.999Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error("Invalid date");
  }
  return date;
}

export async function createShareLink(formData: FormData) {
  const { studio } = await requireStudio();
  const parsed = createSchema.parse({
    galleryId: formData.get("galleryId"),
    label: formData.get("label") || undefined,
    password: formData.get("password") || undefined,
    expiresAt: formData.get("expiresAt") || undefined,
    selectionLimit: formData.get("selectionLimit") || undefined,
    selectionClosesAt: formData.get("selectionClosesAt") || undefined,
    allowDownload: formData.get("allowDownload") === "on",
  });

  const expiresAt = parsed.expiresAt ? endOfUtcDay(parsed.expiresAt) : null;
  const selectionClosesAt = parsed.selectionClosesAt
    ? endOfUtcDay(parsed.selectionClosesAt)
    : null;
  if (expiresAt && selectionClosesAt && selectionClosesAt > expiresAt) {
    throw new Error("Selection deadline must be on or before link expiry");
  }

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
      expiresAt,
      selectionLimit: parsed.selectionLimit,
      selectionClosesAt,
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
