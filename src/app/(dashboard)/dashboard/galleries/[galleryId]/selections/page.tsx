import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStudio } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { signedImagePath } from "@/lib/crypto";
import CopyButton from "@/components/CopyButton";

/** "IMG_0412.jpg" → "IMG_0412" for Lightroom's text filter */
const basename = (filename: string) => filename.replace(/\.[^.]+$/, "");

export default async function SelectionsPage({
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
        include: {
          sessions: {
            where: {
              OR: [{ favorites: { some: {} } }, { comments: { some: {} } }],
            },
            include: {
              favorites: {
                include: { file: { select: { id: true, filename: true, status: true } } },
                orderBy: { createdAt: "asc" },
              },
              comments: {
                include: { file: { select: { filename: true } } },
                orderBy: { createdAt: "asc" },
              },
            },
            orderBy: { lastSeenAt: "desc" },
          },
        },
      },
    },
  });
  if (!gallery) notFound();

  const groups = gallery.shareLinks.flatMap((link) =>
    link.sessions.map((session) => ({
      linkLabel: link.label,
      session,
      filenames: session.favorites.map((f) => f.file.filename),
    }))
  );

  return (
    <div className="max-w-4xl">
      <Link
        href={`/dashboard/galleries/${gallery.id}`}
        className="text-sm text-zinc-400 hover:text-zinc-600"
      >
        ← {gallery.title}
      </Link>
      <h1 className="mt-1 text-xl font-semibold text-zinc-900">Client selections</h1>

      {groups.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-zinc-300 py-16 text-center">
          <p className="text-zinc-500">No selections yet.</p>
          <p className="mt-1 text-sm text-zinc-400">
            Once clients favorite photos through a share link, they show up here.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-8">
          {groups.map(({ linkLabel, session, filenames }) => (
            <section
              key={session.id}
              className="rounded-xl border border-zinc-200 bg-white p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-medium text-zinc-900">
                    {session.displayName ?? "Anonymous visitor"}
                    {linkLabel && (
                      <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">
                        via {linkLabel}
                      </span>
                    )}
                  </h2>
                  <p className="mt-0.5 text-xs text-zinc-400">
                    {filenames.length} photo{filenames.length === 1 ? "" : "s"} · last
                    active {session.lastSeenAt.toISOString().slice(0, 10)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <CopyButton
                    text={filenames.map(basename).join(", ")}
                    label="Copy for Lightroom"
                  />
                  <CopyButton
                    text={filenames.join("\n")}
                    label="Copy filenames"
                  />
                </div>
              </div>
              {session.comments.length > 0 && (
                <div className="mt-4 rounded-lg bg-zinc-50 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                    Notes
                  </p>
                  <ul className="mt-1.5 space-y-1">
                    {session.comments.map((c) => (
                      <li key={c.id} className="text-sm text-zinc-700">
                        <span className="font-mono text-xs text-zinc-400">
                          {c.file.filename}:
                        </span>{" "}
                        {c.text}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <ul className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
                {session.favorites.map(({ file }) => (
                  <li key={file.id}>
                    <div className="aspect-square overflow-hidden rounded bg-zinc-100">
                      {file.status === "READY" ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={signedImagePath(file.id, "thumb")}
                          alt={file.filename}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[10px] text-zinc-400">
                          {file.status.toLowerCase()}
                        </div>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-[10px] text-zinc-400">
                      {file.filename}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      <p className="mt-6 text-xs text-zinc-400">
        “Copy for Lightroom” gives comma-separated names without extensions — paste
        into Lightroom&apos;s Library text filter. “Copy filenames” gives one filename
        per line for Capture One or scripts.
      </p>
    </div>
  );
}
