"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireStudio } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureStudioFolder, getStorage } from "@/lib/storage";

const gallerySchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  eventDate: z.string().optional(),
});

export async function createGallery(formData: FormData) {
  const { studio } = await requireStudio();
  const parsed = gallerySchema.parse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    eventDate: formData.get("eventDate") || undefined,
  });

  const gallery = await prisma.gallery.create({
    data: {
      studioId: studio.id,
      title: parsed.title,
      description: parsed.description,
      eventDate: parsed.eventDate ? new Date(parsed.eventDate) : null,
    },
  });

  // Best effort: the folder is (re)created lazily at upload time if this fails
  try {
    const storage = await getStorage();
    const studioFolderId = await ensureStudioFolder(storage, studio);
    const folderId = await storage.provider.createFolder(parsed.title, studioFolderId);
    await prisma.gallery.update({
      where: { id: gallery.id },
      data: { driveFolderId: folderId },
    });
  } catch {
    // storage not connected yet — fine
  }

  redirect(`/dashboard/galleries/${gallery.id}`);
}

export async function toggleFileStar(fileId: string): Promise<{ starred: boolean }> {
  const { studio } = await requireStudio();
  const file = await prisma.file.findUnique({
    where: { id: fileId, studioId: studio.id },
    select: { id: true, starred: true },
  });
  if (!file) throw new Error("File not found");
  const updated = await prisma.file.update({
    where: { id: file.id },
    data: { starred: !file.starred },
    select: { starred: true },
  });
  return { starred: updated.starred };
}

export async function setGalleryCover(galleryId: string, fileId: string) {
  const { studio } = await requireStudio();
  const file = await prisma.file.findUnique({
    where: { id: fileId, studioId: studio.id, galleryId },
  });
  if (!file) throw new Error("File not found");
  await prisma.gallery.update({
    where: { id: galleryId, studioId: studio.id },
    data: { coverFileId: fileId },
  });
  revalidatePath(`/dashboard/galleries/${galleryId}`);
}

export async function updateGalleryStatus(galleryId: string, status: "DRAFT" | "PUBLISHED" | "ARCHIVED") {
  const { studio } = await requireStudio();
  await prisma.gallery.update({
    // updateMany-style guard: id alone is not enough, must belong to this studio
    where: { id: galleryId, studioId: studio.id },
    data: { status },
  });
  revalidatePath(`/dashboard/galleries/${galleryId}`);
}

export async function deleteGallery(galleryId: string) {
  const { studio } = await requireStudio();
  const gallery = await prisma.gallery.findUnique({
    where: { id: galleryId, studioId: studio.id },
  });
  if (!gallery) throw new Error("Gallery not found");

  if (gallery.driveFolderId) {
    try {
      const { provider } = await getStorage();
      await provider.deleteFolder(gallery.driveFolderId);
    } catch {
      // Drive cleanup is best effort; the DB rows go regardless
    }
  }
  await prisma.gallery.delete({ where: { id: gallery.id } });
  redirect("/dashboard");
}

/**
 * Uploads abandoned mid-flight (closed tab, crash) never reach the complete
 * endpoint — reap anything still UPLOADING after 24h.
 */
export async function reapStaleUploads(galleryId: string) {
  const { studio } = await requireStudio();
  await prisma.file.updateMany({
    where: {
      galleryId,
      studioId: studio.id,
      status: "UPLOADING",
      createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
    data: { status: "FAILED" },
  });
}

export async function deleteFile(fileId: string) {
  const { studio } = await requireStudio();
  const file = await prisma.file.findUnique({
    where: { id: fileId, studioId: studio.id },
  });
  if (!file) throw new Error("File not found");

  if (file.driveFileId) {
    try {
      const { provider } = await getStorage();
      await provider.deleteFile(file.driveFileId);
    } catch {
      // best effort
    }
  }
  await prisma.file.delete({ where: { id: file.id } });
  revalidatePath(`/dashboard/galleries/${file.galleryId}`);
}
