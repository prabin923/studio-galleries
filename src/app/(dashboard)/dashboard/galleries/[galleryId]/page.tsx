import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStudio } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { signedImagePath } from "@/lib/crypto";
import {
  deleteGallery,
  reapStaleUploads,
  updateGalleryStatus,
} from "@/actions/galleries";
import Uploader from "@/components/uploader/Uploader";
import ManageGrid from "@/components/dashboard/ManageGrid";
import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";

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
        <ManageGrid
          galleryId={gallery.id}
          coverFileId={gallery.coverFileId}
          items={gallery.files.map((f) => ({
            id: f.id,
            filename: f.filename,
            status: f.status,
            isVideo: f.mimeType.startsWith("video/"),
            thumbSrc: signedImagePath(f.id, "thumb"),
            webSrc: signedImagePath(f.id, "web"),
            starred: f.starred,
          }))}
        />
      )}

      <div className="mt-12 border-t border-zinc-200 pt-6">
        <form
          action={async () => {
            "use server";
            await deleteGallery(gallery.id);
          }}
        >
          <ConfirmSubmitButton
            message="Delete this gallery and all of its files from Google Drive?"
            className="text-sm text-red-600 hover:text-red-800"
          >
            Delete gallery and all its files
          </ConfirmSubmitButton>
        </form>
      </div>
    </div>
  );
}
