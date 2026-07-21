import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { resolveShareLink } from "@/lib/share";
import { readClientSession } from "@/lib/client-session";
import { signedImagePath } from "@/lib/crypto";
import ClientGallery from "@/components/public/ClientGallery";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

const UNAVAILABLE_COPY: Record<string, { title: string; body: string }> = {
  not_found: {
    title: "Gallery not found",
    body: "This link doesn't exist. Double-check the address you were sent.",
  },
  revoked: {
    title: "Link no longer active",
    body: "The photographer has turned off this link. Reach out to them for a new one.",
  },
  expired: {
    title: "Link expired",
    body: "This link has passed its expiry date. Reach out to your photographer for a new one.",
  },
  unpublished: {
    title: "Gallery not available",
    body: "This gallery isn't published right now. Check back soon.",
  },
};

export default async function PublicGalleryPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const resolved = await resolveShareLink(token);

  if (resolved.status !== "ok") {
    const copy = UNAVAILABLE_COPY[resolved.status];
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-6">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-zinc-900">{copy.title}</h1>
          <p className="mt-2 max-w-sm text-sm text-zinc-500">{copy.body}</p>
        </div>
      </main>
    );
  }

  const { link } = resolved;
  const claims = await readClientSession(link.id);
  if (!claims) redirect(`/g/${token}/enter`);
  if (link.passwordHash && !claims.pwOk) redirect(`/g/${token}/password`);

  const [gallery, favorites, clientSession, comments] = await Promise.all([
    prisma.gallery.findUnique({
      where: { id: link.galleryId },
      include: {
        studio: { select: { name: true } },
        files: {
          where: { status: "READY" },
          orderBy: { sortOrder: "asc" },
          select: { id: true, filename: true, mimeType: true },
        },
      },
    }),
    prisma.favorite.findMany({
      where: { clientSessionId: claims.sid },
      select: { fileId: true, label: true },
    }),
    prisma.clientSession.findUnique({
      where: { id: claims.sid },
      select: { displayName: true, selectionFinalizedAt: true },
    }),
    prisma.comment.findMany({
      where: { clientSessionId: claims.sid },
      orderBy: { createdAt: "asc" },
      select: { id: true, fileId: true, text: true, createdAt: true },
    }),
  ]);
  if (!gallery) redirect(`/g/${token}/enter`);

  const favoriteLabels = new Map(favorites.map((f) => [f.fileId, f.label]));
  const allowDownload = gallery.allowDownload && link.allowDownload;

  const commentsByFile: Record<string, { id: string; text: string; createdAt: string }[]> = {};
  for (const c of comments) {
    (commentsByFile[c.fileId] ??= []).push({
      id: c.id,
      text: c.text,
      createdAt: c.createdAt.toISOString(),
    });
  }

  const items = gallery.files.map((f) => ({
    id: f.id,
    filename: f.filename,
    isVideo: f.mimeType.startsWith("video/"),
    thumbSrc: signedImagePath(f.id, "thumb"),
    webSrc: signedImagePath(f.id, "web"),
    favorited: favoriteLabels.has(f.id),
    selectionLabel: favoriteLabels.get(f.id) ?? null,
  }));

  const coverId =
    gallery.coverFileId && gallery.files.some((f) => f.id === gallery.coverFileId)
      ? gallery.coverFileId
      : gallery.files[0]?.id ?? null;

  return (
    <ClientGallery
      token={token}
      studioName={gallery.studio.name}
      galleryTitle={gallery.title}
      galleryDescription={gallery.description}
      eventDate={gallery.eventDate ? gallery.eventDate.toISOString().slice(0, 10) : null}
      coverSrc={coverId ? signedImagePath(coverId, "web") : null}
      items={items}
      selectionLimit={link.selectionLimit}
      initialCount={favorites.length}
      allowDownload={allowDownload}
      initialDisplayName={clientSession?.displayName ?? null}
      initialComments={commentsByFile}
      selectionClosesAt={
        link.selectionClosesAt ? link.selectionClosesAt.toISOString() : null
      }
      selectionIsClosed={
        link.selectionClosesAt !== null && link.selectionClosesAt <= new Date()
      }
      initialSelectionFinalized={clientSession?.selectionFinalizedAt !== null}
    />
  );
}
