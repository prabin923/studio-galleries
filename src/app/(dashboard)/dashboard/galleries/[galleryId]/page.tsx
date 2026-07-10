import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStudio } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { signedImagePath } from "@/lib/crypto";
import {
  deleteFile,
  deleteGallery,
  reapStaleUploads,
  updateGalleryStatus,
} from "@/actions/galleries";
import Uploader from "@/components/uploader/Uploader";

export default async function GalleryPage({
  params,
}: {
  params: Promise<{ galleryId: string }>;
}) {
  const { studio } = await requireStudio();
  const { galleryId } = await params;

  await reapStaleUploads(galleryId);

  const gallery = await prisma.gallery.findUnique({
    where: { id: galleryId, studioId: studio.id },
    include: {
      files: { orderBy: { sortOrder: "asc" } },
      _count: { select: { shareLinks: true } },
    },
  });
  if (!gallery) notFound();

  const isPublished = gallery.status === "PUBLISHED";

  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <Link href="/dashboard" className="text-sm text-zinc-400 hover:text-zinc-600">
            ← Galleries
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-zinc-900">{gallery.title}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {gallery.files.length} file{gallery.files.length === 1 ? "" : "s"}
            {gallery.eventDate ? ` · ${gallery.eventDate.toISOString().slice(0, 10)}` : ""}
            {" · "}
            <span className={isPublished ? "text-green-600" : "text-zinc-500"}>
              {gallery.status.toLowerCase()}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/galleries/${gallery.id}/selections`}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
          >
            Selections
          </Link>
          <Link
            href={`/dashboard/galleries/${gallery.id}/share`}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
          >
            Share ({gallery._count.shareLinks})
          </Link>
          <form
            action={async () => {
              "use server";
              await updateGalleryStatus(gallery.id, isPublished ? "DRAFT" : "PUBLISHED");
            }}
          >
            <button
              type="submit"
              className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700"
            >
              {isPublished ? "Unpublish" : "Publish"}
            </button>
          </form>
        </div>
      </div>

      {gallery.files.some((f) => f.status === "MISSING") && (
        <p className="mt-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          Some files were deleted or moved in Google Drive and can no longer be
          shown. Re-upload them or remove them from the gallery.
        </p>
      )}

      <div className="mt-6">
        <Uploader galleryId={gallery.id} />
      </div>

      {gallery.files.length > 0 && (
        <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {gallery.files.map((f) => (
            <li key={f.id} className="group relative">
              <div className="aspect-square overflow-hidden rounded-lg bg-zinc-100">
                {f.status === "READY" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={signedImagePath(f.id, "thumb")}
                    alt={f.filename}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center px-2 text-center text-xs text-zinc-400">
                    {f.status === "UPLOADING" && "uploading…"}
                    {f.status === "FAILED" && "upload failed"}
                    {f.status === "MISSING" && "missing from Drive"}
                  </div>
                )}
              </div>
              <p className="mt-1 truncate text-xs text-zinc-500">{f.filename}</p>
              <form
                action={async () => {
                  "use server";
                  await deleteFile(f.id);
                }}
                className="absolute right-1.5 top-1.5 hidden group-hover:block"
              >
                <button
                  type="submit"
                  aria-label={`Delete ${f.filename}`}
                  className="rounded-md bg-black/60 px-2 py-1 text-xs text-white hover:bg-black/80"
                >
                  ✕
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-12 border-t border-zinc-200 pt-6">
        <form
          action={async () => {
            "use server";
            await deleteGallery(gallery.id);
          }}
        >
          <button
            type="submit"
            className="text-sm text-red-600 hover:text-red-800"
          >
            Delete gallery and all its files
          </button>
        </form>
      </div>
    </div>
  );
}
