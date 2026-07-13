import Link from "next/link";
import { requireStudio } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { signedImagePath } from "@/lib/crypto";

export default async function DashboardPage() {
  const { studio, isAdmin } = await requireStudio();

  const [galleries, storage, photoCount, favoriteCount, visitorCount] =
    await Promise.all([
      prisma.gallery.findMany({
        where: { studioId: studio.id },
        orderBy: { createdAt: "desc" },
        include: {
          _count: { select: { files: true } },
          files: {
            where: { status: "READY" },
            orderBy: { sortOrder: "asc" },
            take: 1,
            select: { id: true },
          },
        },
      }),
      prisma.storageConnection.findFirst({ orderBy: { createdAt: "asc" } }),
      prisma.file.count({ where: { studioId: studio.id, status: "READY" } }),
      prisma.favorite.count({ where: { file: { studioId: studio.id } } }),
      prisma.clientSession.count({
        where: { shareLink: { gallery: { studioId: studio.id } } },
      }),
    ]);

  const stats = [
    { label: "Galleries", value: galleries.length },
    { label: "Photos", value: photoCount },
    { label: "Client favorites", value: favoriteCount },
    { label: "Gallery visitors", value: visitorCount },
  ];

  return (
    <div>
      {(!storage || storage.status !== "ACTIVE") &&
        (isAdmin ? (
          <div className="mb-6 flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
            <p className="text-sm text-amber-800">
              {storage?.status === "REVOKED"
                ? "Google Drive access was revoked. Storage needs to be reconnected."
                : "Platform storage isn't connected yet — uploads are disabled for everyone."}
            </p>
            <Link
              href="/dashboard/settings/storage"
              className="text-sm font-medium text-amber-900 underline"
            >
              {storage ? "Reconnect" : "Connect Drive"}
            </Link>
          </div>
        ) : (
          <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
            <p className="text-sm text-amber-800">
              Uploads are temporarily unavailable — please check back soon.
            </p>
          </div>
        ))}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-zinc-200 bg-white px-5 py-4"
          >
            <p className="text-2xl font-semibold tabular-nums text-zinc-900">
              {s.value}
            </p>
            <p className="mt-0.5 text-xs uppercase tracking-wide text-zinc-400">
              {s.label}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-10 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900">Galleries</h1>
        <Link
          href="/dashboard/galleries/new"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          New gallery
        </Link>
      </div>

      {galleries.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-zinc-300 py-20 text-center">
          <p className="text-zinc-500">No galleries yet.</p>
          <p className="mt-1 text-sm text-zinc-400">
            Create your first gallery to upload a photoshoot.
          </p>
        </div>
      ) : (
        <ul className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {galleries.map((g) => {
            const coverId = g.coverFileId ?? g.files[0]?.id ?? null;
            return (
              <li key={g.id}>
                <Link
                  href={`/dashboard/galleries/${g.id}`}
                  className="group block overflow-hidden rounded-2xl border border-zinc-200 bg-white transition-shadow hover:shadow-md"
                >
                  <div className="aspect-[3/2] overflow-hidden bg-zinc-100">
                    {coverId ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={signedImagePath(coverId, "web")}
                        alt={g.title}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-zinc-300">
                        No photos yet
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="min-w-0">
                      <h2 className="truncate font-medium text-zinc-900">
                        {g.title}
                      </h2>
                      <p className="mt-0.5 text-xs text-zinc-400">
                        {g._count.files} file{g._count.files === 1 ? "" : "s"}
                        {g.eventDate
                          ? ` · ${g.eventDate.toISOString().slice(0, 10)}`
                          : ""}
                      </p>
                    </div>
                    <span
                      className={`ml-3 shrink-0 rounded-full px-2 py-0.5 text-xs ${
                        g.status === "PUBLISHED"
                          ? "bg-green-100 text-green-700"
                          : "bg-zinc-100 text-zinc-500"
                      }`}
                    >
                      {g.status.toLowerCase()}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
