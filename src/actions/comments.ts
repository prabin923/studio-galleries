"use server";

import { prisma } from "@/lib/prisma";
import { readClientSession } from "@/lib/client-session";
import { resolveShareLink } from "@/lib/share";

export type AddCommentResult =
  | { ok: true; comment: { id: string; text: string; createdAt: string } }
  | { ok: false; error: "unauthorized" | "not_found" | "empty" };

export async function addComment(
  token: string,
  fileId: string,
  text: string
): Promise<AddCommentResult> {
  const trimmed = text.trim().slice(0, 1000);
  if (!trimmed) return { ok: false, error: "empty" };

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

  const comment = await prisma.comment.create({
    data: { fileId: file.id, clientSessionId: session.id, text: trimmed },
  });
  return {
    ok: true,
    comment: {
      id: comment.id,
      text: comment.text,
      createdAt: comment.createdAt.toISOString(),
    },
  };
}
