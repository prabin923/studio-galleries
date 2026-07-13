import { prisma } from "./prisma";
import { generateShareToken, isPlausibleShareToken } from "./share-token";
import type { Gallery, ShareLink } from "@prisma/client";

export type ResolvedShareLink =
  | { status: "ok"; link: ShareLink & { gallery: Gallery } }
  | { status: "not_found" }
  | { status: "revoked" }
  | { status: "expired" }
  | { status: "unpublished" };

export { generateShareToken };

export async function resolveShareLink(token: string): Promise<ResolvedShareLink> {
  if (!isPlausibleShareToken(token)) return { status: "not_found" };
  const link = await prisma.shareLink.findUnique({
    where: { token },
    include: { gallery: true },
  });
  if (!link) return { status: "not_found" };
  if (link.revokedAt) return { status: "revoked" };
  if (link.expiresAt && link.expiresAt < new Date()) return { status: "expired" };
  if (link.gallery.status !== "PUBLISHED") return { status: "unpublished" };
  return { status: "ok", link };
}
