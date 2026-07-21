"use server";

import { prisma } from "@/lib/prisma";
import { readClientSession } from "@/lib/client-session";
import { resolveShareLink } from "@/lib/share";
import { rateLimitAction } from "@/lib/action-rate-limit";

type FavoriteTransaction = Pick<typeof prisma, "favorite">;
type SelectionLabel = "MUST_HAVE" | "MAYBE";

export type ToggleResult =
  | { ok: true; selected: boolean; count: number }
  | {
      ok: false;
      error: "limit_reached" | "rate_limited" | "selection_closed" | "unauthorized" | "not_found";
    };

export type SetSelectionLabelResult =
  | { ok: true; label: SelectionLabel }
  | { ok: false; error: "rate_limited" | "selection_closed" | "unauthorized" | "not_found" };

export type SetSelectionFinalizedResult =
  | { ok: true; finalized: boolean }
  | { ok: false; error: "empty_selection" | "rate_limited" | "selection_closed" | "unauthorized" };

function selectionIsClosed(selectionClosesAt: Date | null): boolean {
  return selectionClosesAt !== null && selectionClosesAt <= new Date();
}

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
  if (session.selectionFinalizedAt || selectionIsClosed(link.selectionClosesAt)) {
    return { ok: false, error: "selection_closed" };
  }

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
      data: { clientSessionId: session.id, fileId: file.id, label: "MUST_HAVE" },
    });
    return { ok: true as const, selected: true, count: count + 1 };
  });

  await prisma.clientSession.update({
    where: { id: session.id },
    data: { lastSeenAt: new Date() },
  });

  return result;
}

export async function setSelectionLabel(
  token: string,
  fileId: string,
  label: SelectionLabel
): Promise<SetSelectionLabelResult> {
  if (label !== "MUST_HAVE" && label !== "MAYBE") {
    return { ok: false, error: "not_found" };
  }
  if (!(await rateLimitAction("selection-label", token, 60, 60 * 1000))) {
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
  if (session.selectionFinalizedAt || selectionIsClosed(link.selectionClosesAt)) {
    return { ok: false, error: "selection_closed" };
  }

  const favorite = await prisma.favorite.findUnique({
    where: { clientSessionId_fileId: { clientSessionId: session.id, fileId } },
  });
  if (!favorite) return { ok: false, error: "not_found" };

  await prisma.favorite.update({ where: { id: favorite.id }, data: { label } });
  await prisma.clientSession.update({
    where: { id: session.id },
    data: { lastSeenAt: new Date() },
  });
  return { ok: true, label };
}

export async function setSelectionFinalized(
  token: string,
  finalized: boolean
): Promise<SetSelectionFinalizedResult> {
  if (typeof finalized !== "boolean") return { ok: false, error: "unauthorized" };
  if (!(await rateLimitAction("finalize-selection", token, 10, 10 * 60 * 1000))) {
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
  if (!finalized && selectionIsClosed(link.selectionClosesAt)) {
    return { ok: false, error: "selection_closed" };
  }

  if (finalized) {
    const count = await prisma.favorite.count({ where: { clientSessionId: session.id } });
    if (count === 0) return { ok: false, error: "empty_selection" };
  }
  await prisma.clientSession.update({
    where: { id: session.id },
    data: { selectionFinalizedAt: finalized ? new Date() : null, lastSeenAt: new Date() },
  });
  return { ok: true, finalized };
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
