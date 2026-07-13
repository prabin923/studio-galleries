"use server";

import { prisma } from "@/lib/prisma";
import { readClientSession } from "@/lib/client-session";
import { resolveShareLink } from "@/lib/share";
import { rateLimitAction } from "@/lib/action-rate-limit";

type FavoriteTransaction = Pick<typeof prisma, "favorite">;

export type ToggleResult =
  | { ok: true; selected: boolean; count: number }
  | { ok: false; error: "limit_reached" | "rate_limited" | "unauthorized" | "not_found" };

export async function toggleFavorite(token: string, fileId: string): Promise<ToggleResult> {
  if (!(await rateLimitAction("favorite", token, 120, 60 * 1000))) {
    return { ok: false, error: "rate_limited" };
  }
  const resolved = await resolveShareLink(token);
  if (resolved.status !== "ok") return { ok: false, error: "unauthorized" };
  const { link } = resolved;

  const claims = await readClientSession(link.id);
  if (!claims || (link.passwordHash && !claims.pwOk)) {
    return { ok: false, error: "unauthorized" };
  }
  const session = await prisma.clientSession.findUnique({ where: { id: claims.sid } });
  if (!session || session.shareLinkId !== link.id) return { ok: false, error: "unauthorized" };

  const file = await prisma.file.findUnique({ where: { id: fileId } });
  if (!file || file.galleryId !== link.galleryId || file.status !== "READY") {
    return { ok: false, error: "not_found" };
  }

  const result = await prisma.$transaction(async (tx: FavoriteTransaction) => {
    const existing = await tx.favorite.findUnique({
      where: { clientSessionId_fileId: { clientSessionId: session.id, fileId: file.id } },
    });
    if (existing) {
      await tx.favorite.delete({ where: { id: existing.id } });
      const count = await tx.favorite.count({ where: { clientSessionId: session.id } });
      return { ok: true as const, selected: false, count };
    }
    const count = await tx.favorite.count({ where: { clientSessionId: session.id } });
    if (link.selectionLimit != null && count >= link.selectionLimit) {
      return { ok: false as const, error: "limit_reached" as const };
    }
    await tx.favorite.create({
      data: { clientSessionId: session.id, fileId: file.id },
    });
    return { ok: true as const, selected: true, count: count + 1 };
  });

  await prisma.clientSession.update({
    where: { id: session.id },
    data: { lastSeenAt: new Date() },
  });

  return result;
}

export async function setDisplayName(token: string, name: string): Promise<void> {
  const resolved = await resolveShareLink(token);
  if (resolved.status !== "ok") return;
  const claims = await readClientSession(resolved.link.id);
  if (!claims) return;
  await prisma.clientSession.update({
    where: { id: claims.sid },
    data: { displayName: name.trim().slice(0, 100) || null },
  });
}
