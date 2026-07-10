import Link from "next/link";
import { requireStudio } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function DashboardPage() {
  const { studio } = await requireStudio();

  const [galleries, storage] = await Promise.all([
    prisma.gallery.findMany({
      where: { studioId: studio.id },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { files: true } } },
    }),
    prisma.storageConnection.findUnique({ where: { studioId: studio.id } }),
  ]);

  return (
    <div>
      {(!storage || storage.status !== "ACTIVE") && (
        <div className="mb-6 flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-800">
            {storage?.status === "REVOKED"
              ? "Google Drive access was revoked. Reconnect to keep your galleries working."
              : "Connect your Google Drive to start uploading photoshoots."}
          </p>
          <Link
            href="/dashboard/settings/storage"
            className="text-sm font-medium text-amber-900 underline"
          >
            {storage ? "Reconnect" : "Connect Drive"}
          </Link>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900">Galleries</h1>
        <Link
          href="/dashboard/galleries/new"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          New gallery
        </Link>
      </div>

      {galleries.length === 0 ? (
        <div className="mt-12 rounded-xl border border-dashed border-zinc-300 py-16 text-center">
          <p className="text-zinc-500">No galleries yet.</p>
          <p className="mt-1 text-sm text-zinc-400">
            Create your first gallery to upload a photoshoot.
          </p>
        </div>
      ) : (
        <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {galleries.map((g) => (
            <li key={g.id}>
              <Link
                href={`/dashboard/galleries/${g.id}`}
                className="block rounded-xl border border-zinc-200 bg-white p-5 hover:border-zinc-400"
              >
                <div className="flex items-center justify-between">
                  <h2 className="font-medium text-zinc-900">{g.title}</h2>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      g.status === "PUBLISHED"
                        ? "bg-green-100 text-green-700"
                        : "bg-zinc-100 text-zinc-500"
                    }`}
                  >
                    {g.status.toLowerCase()}
                  </span>
                </div>
                <p className="mt-2 text-sm text-zinc-500">
                  {g._count.files} file{g._count.files === 1 ? "" : "s"}
                  {g.eventDate
                    ? ` · ${g.eventDate.toISOString().slice(0, 10)}`
                    : ""}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
