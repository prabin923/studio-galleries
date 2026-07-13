"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteFile, setGalleryCover, toggleFileStar } from "@/actions/galleries";

type Item = {
  id: string;
  filename: string;
  status: "READY" | "UPLOADING" | "FAILED" | "MISSING";
  isVideo: boolean;
  thumbSrc: string;
  webSrc: string;
  starred: boolean;
};

function HeartIcon({ filled, className = "h-4 w-4" }: { filled: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`${className} ${filled ? "fill-red-500 stroke-red-500" : "fill-none stroke-current"}`}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  );
}

export default function ManageGrid({
  galleryId,
  coverFileId,
  items: initialItems,
}: {
  galleryId: string;
  coverFileId: string | null;
  items: Item[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [cover, setCover] = useState(coverFileId);
  const [onlyStarred, setOnlyStarred] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  const visible = onlyStarred ? items.filter((i) => i.starred) : items;
  const starredCount = items.filter((i) => i.starred).length;
  const current = lightbox !== null ? visible[lightbox] : null;

  const toggleStar = useCallback((id: string) => {
    startTransition(async () => {
      const res = await toggleFileStar(id);
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, starred: res.starred } : i)));
    });
  }, []);

  const makeCover = useCallback(
    (id: string) => {
      startTransition(async () => {
        await setGalleryCover(galleryId, id);
        setCover(id);
      });
    },
    [galleryId]
  );

  const remove = useCallback(
    (id: string) => {
      setLightbox(null);
      startTransition(async () => {
        await deleteFile(id);
        setItems((prev) => prev.filter((i) => i.id !== id));
        router.refresh();
      });
    },
    [router]
  );

  useEffect(() => {
    if (lightbox === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
      if (e.key === "ArrowRight")
        setLightbox((v) => (v === null ? v : Math.min(v + 1, visible.length - 1)));
      if (e.key === "ArrowLeft") setLightbox((v) => (v === null ? v : Math.max(v - 1, 0)));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, visible.length]);

  return (
    <div>
      {starredCount > 0 && (
        <div className="mt-6 flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setOnlyStarred((v) => !v);
              setLightbox(null);
            }}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm ${
              onlyStarred
                ? "border-red-200 bg-red-50 text-red-600"
                : "border-zinc-300 text-zinc-600 hover:bg-zinc-50"
            }`}
          >
            <HeartIcon filled /> {starredCount} favorite{starredCount === 1 ? "" : "s"}
          </button>
        </div>
      )}

      <ul className="mt-6 columns-2 gap-3 sm:columns-3 md:columns-4 lg:columns-5 [&>li]:mb-3">
        {visible.map((f, idx) => (
          <li key={f.id} className="group relative break-inside-avoid">
            {f.status === "READY" ? (
              <button type="button" onClick={() => setLightbox(idx)} className="block w-full">
                <span className="block overflow-hidden rounded-xl bg-zinc-100 shadow-sm ring-1 ring-zinc-200 transition-all duration-300 group-hover:shadow-lg group-hover:ring-zinc-300">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={f.thumbSrc}
                    alt={f.filename}
                    loading="lazy"
                    className="h-auto w-full transition-transform duration-500 group-hover:scale-[1.04]"
                  />
                </span>
              </button>
            ) : (
              <div className="flex aspect-square items-center justify-center rounded-lg bg-zinc-100 px-2 text-center text-xs text-zinc-400">
                {f.status === "UPLOADING" && "uploading…"}
                {f.status === "FAILED" && "upload failed"}
                {f.status === "MISSING" && "missing from Drive"}
              </div>
            )}
            <p className="mt-1 truncate text-xs text-zinc-500">{f.filename}</p>
            {cover === f.id && (
              <span className="absolute left-1.5 top-1.5 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white">
                Cover
              </span>
            )}
            {f.status === "READY" && (
              <button
                type="button"
                onClick={() => toggleStar(f.id)}
                aria-label={f.starred ? "Remove from favorites" : "Add to favorites"}
                className={`absolute right-1.5 top-1.5 rounded-full bg-black/50 p-1.5 backdrop-blur transition-opacity ${
                  f.starred ? "" : "opacity-0 group-hover:opacity-100"
                } text-white hover:text-red-400`}
              >
                <HeartIcon filled={f.starred} />
              </button>
            )}
          </li>
        ))}
      </ul>

      {current && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/95" onClick={() => setLightbox(null)}>
          <div
            className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="truncate text-sm text-zinc-400">{current.filename}</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => toggleStar(current.id)}
                className={`rounded-full p-2 ${current.starred ? "text-red-500" : "text-white hover:text-red-400"}`}
                aria-label="Toggle favorite"
              >
                <HeartIcon filled={current.starred} className="h-5 w-5" />
              </button>
              <button
                type="button"
                disabled={cover === current.id || pending}
                onClick={() => makeCover(current.id)}
                className="rounded-lg border border-zinc-600 px-3 py-1.5 text-sm hover:bg-zinc-800 disabled:opacity-40"
              >
                {cover === current.id ? "Current cover" : "Set as cover"}
              </button>
              <a
                href={`/api/dl/${current.id}`}
                className="rounded-lg border border-zinc-600 px-3 py-1.5 text-sm hover:bg-zinc-800"
              >
                Download
              </a>
              <button
                type="button"
                onClick={() => remove(current.id)}
                className="rounded-lg border border-red-500/50 px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/10"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => setLightbox(null)}
                className="rounded-full p-2 text-white hover:text-zinc-300"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
          </div>
          <div
            className="flex min-h-0 flex-1 items-center justify-center px-4 pb-6"
            onClick={(e) => e.stopPropagation()}
          >
            {current.isVideo ? (
              <video src={`/api/dl/${current.id}?inline=1`} controls className="max-h-full max-w-full" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={current.webSrc} alt={current.filename} className="max-h-full max-w-full object-contain" />
            )}
          </div>
          {lightbox !== null && lightbox > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setLightbox(lightbox - 1);
              }}
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20"
              aria-label="Previous"
            >
              ←
            </button>
          )}
          {lightbox !== null && lightbox < visible.length - 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setLightbox(lightbox + 1);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20"
              aria-label="Next"
            >
              →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
