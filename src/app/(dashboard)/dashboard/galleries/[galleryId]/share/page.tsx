import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStudio } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createShareLink, revokeShareLink } from "@/actions/share-links";
import CopyButton from "@/components/CopyButton";

export default async function SharePage({
  params,
}: {
  params: Promise<{ galleryId: string }>;
}) {
  const { studio } = await requireStudio();
  const { galleryId } = await params;

  const gallery = await prisma.gallery.findUnique({
    where: { id: galleryId, studioId: studio.id },
    include: {
      shareLinks: {
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { sessions: true } } },
      },
    },
  });
  if (!gallery) notFound();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  return (
    <div className="max-w-3xl">
      <Link
        href={`/dashboard/galleries/${gallery.id}`}
        className="text-sm text-zinc-400 hover:text-zinc-600"
      >
        ← {gallery.title}
      </Link>
      <h1 className="mt-1 text-xl font-semibold text-zinc-900">Share links</h1>
      {gallery.status !== "PUBLISHED" && (
        <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          This gallery is {gallery.status.toLowerCase()} — links won&apos;t open until
          you publish it.
        </p>
      )}

      <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="font-medium text-zinc-900">New link</h2>
        <form action={createShareLink} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <input type="hidden" name="galleryId" value={gallery.id} />
          <div>
            <label htmlFor="label" className="block text-sm font-medium text-zinc-700">
              Label <span className="text-zinc-400">(optional)</span>
            </label>
            <input
              id="label"
              name="label"
              placeholder="Bride's family"
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-zinc-700">
              Password <span className="text-zinc-400">(optional)</span>
            </label>
            <input
              id="password"
              name="password"
              type="text"
              autoComplete="off"
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="selectionLimit" className="block text-sm font-medium text-zinc-700">
              Selection limit <span className="text-zinc-400">(optional)</span>
            </label>
            <input
              id="selectionLimit"
              name="selectionLimit"
              type="number"
              min={1}
              placeholder="e.g. 30"
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="expiresAt" className="block text-sm font-medium text-zinc-700">
              Expires <span className="text-zinc-400">(optional)</span>
            </label>
            <input
              id="expiresAt"
              name="expiresAt"
              type="date"
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input type="checkbox" name="allowDownload" defaultChecked className="rounded" />
            Allow downloads
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
            >
              Create link
            </button>
          </div>
        </form>
      </div>

      <ul className="mt-6 space-y-3">
        {gallery.shareLinks.map((link) => {
          const url = `${appUrl}/g/${link.token}`;
          const dead =
            !!link.revokedAt || (link.expiresAt !== null && link.expiresAt < new Date());
          return (
            <li
              key={link.id}
              className={`rounded-xl border bg-white p-4 ${
                dead ? "border-zinc-200 opacity-60" : "border-zinc-200"
              }`}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium text-zinc-900">
                    {link.label ?? "Untitled link"}
                    {link.revokedAt && <span className="ml-2 text-xs text-red-600">revoked</span>}
                    {!link.revokedAt && link.expiresAt && link.expiresAt < new Date() && (
                      <span className="ml-2 text-xs text-amber-600">expired</span>
                    )}
                  </p>
                  <p className="mt-0.5 truncate font-mono text-xs text-zinc-500">{url}</p>
                  <p className="mt-1 text-xs text-zinc-400">
                    {link.passwordHash ? "password · " : ""}
                    {link.selectionLimit ? `pick up to ${link.selectionLimit} · ` : ""}
                    {link.allowDownload ? "downloads on" : "downloads off"} ·{" "}
                    {link._count.sessions} visitor{link._count.sessions === 1 ? "" : "s"} ·{" "}
                    {link.viewCount} views
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {!dead && <CopyButton text={url} label="Copy link" />}
                  {!link.revokedAt && (
                    <form
                      action={async () => {
                        "use server";
                        await revokeShareLink(link.id);
                      }}
                    >
                      <button
                        type="submit"
                        className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                      >
                        Revoke
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
