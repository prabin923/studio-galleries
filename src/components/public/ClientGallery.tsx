"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { setDisplayName, toggleFavorite } from "@/actions/favorites";

type Item = {
  id: string;
  filename: string;
  isVideo: boolean;
  thumbSrc: string;
  webSrc: string;
  favorited: boolean;
};

type Props = {
  token: string;
  studioName: string;
  galleryTitle: string;
  galleryDescription: string | null;
  items: Item[];
  selectionLimit: number | null;
  initialCount: number;
  allowDownload: boolean;
  initialDisplayName: string | null;
};

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-5 w-5 ${filled ? "fill-red-500 stroke-red-500" : "fill-none stroke-current"}`}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  );
}

export default function ClientGallery({
  token,
  studioName,
  galleryTitle,
  galleryDescription,
  items: initialItems,
  selectionLimit,
  initialCount,
  allowDownload,
  initialDisplayName,
}: Props) {
  const [items, setItems] = useState(initialItems);
  const [count, setCount] = useState(initialCount);
  const [displayName, setName] = useState(initialDisplayName);
  const [nameDraft, setNameDraft] = useState("");
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const visible = onlyFavorites ? items.filter((i) => i.favorited) : items;

  const toggle = useCallback(
    (id: string) => {
      startTransition(async () => {
        const res = await toggleFavorite(token, id);
        if (!res.ok) {
          if (res.error === "limit_reached") {
            setNotice(`You can select up to ${selectionLimit} photos.`);
            setTimeout(() => setNotice(null), 2500);
          }
          return;
        }
        setItems((prev) =>
          prev.map((i) => (i.id === id ? { ...i, favorited: res.selected } : i))
        );
        setCount(res.count);
      });
    },
    [token, selectionLimit]
  );

  useEffect(() => {
    if (lightbox === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
      if (e.key === "ArrowRight") setLightbox((v) => (v === null ? v : Math.min(v + 1, visible.length - 1)));
      if (e.key === "ArrowLeft") setLightbox((v) => (v === null ? v : Math.max(v - 1, 0)));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, visible.length]);

  const current = lightbox !== null ? visible[lightbox] : null;

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-zinc-400">{studioName}</p>
            <h1 className="truncate font-semibold text-zinc-900">{galleryTitle}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setOnlyFavorites((v) => !v)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm ${
                onlyFavorites
                  ? "border-red-200 bg-red-50 text-red-600"
                  : "border-zinc-300 text-zinc-600 hover:bg-zinc-50"
              }`}
            >
              <HeartIcon filled={count > 0} />
              {count}
              {selectionLimit ? ` / ${selectionLimit}` : ""}
            </button>
          </div>
        </div>
        {notice && (
          <p className="border-t border-amber-200 bg-amber-50 px-6 py-2 text-center text-sm text-amber-800">
            {notice}
          </p>
        )}
        {count > 0 && !displayName && (
          <form
            className="flex items-center justify-center gap-2 border-t border-zinc-200 bg-zinc-50 px-6 py-2"
            onSubmit={(e) => {
              e.preventDefault();
              const name = nameDraft.trim();
              if (!name) return;
              setName(name);
              startTransition(() => setDisplayName(token, name));
            }}
          >
            <label htmlFor="visitor-name" className="text-sm text-zinc-500">
              Who&apos;s choosing?
            </label>
            <input
              id="visitor-name"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              placeholder="Your name"
              maxLength={100}
              className="rounded-lg border border-zinc-300 px-2.5 py-1 text-sm focus:border-zinc-900 focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-lg bg-zinc-900 px-3 py-1 text-sm text-white hover:bg-zinc-700"
            >
              Save
            </button>
          </form>
        )}
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {galleryDescription && (
          <p className="mb-6 max-w-2xl text-sm text-zinc-500">{galleryDescription}</p>
        )}
        {visible.length === 0 ? (
          <p className="py-24 text-center text-sm text-zinc-400">
            {onlyFavorites ? "No favorites yet — tap the heart on photos you love." : "No photos yet."}
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {visible.map((item, idx) => (
              <li key={item.id} className="group relative">
                <button
                  type="button"
                  onClick={() => setLightbox(idx)}
                  className="block w-full"
                >
                  <span className="block aspect-square overflow-hidden rounded-md bg-zinc-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.thumbSrc}
                      alt={item.filename}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
                    />
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => toggle(item.id)}
                  aria-label={item.favorited ? "Remove from favorites" : "Add to favorites"}
                  className={`absolute right-2 top-2 rounded-full bg-white/80 p-1.5 shadow-sm backdrop-blur transition-opacity ${
                    item.favorited ? "" : "opacity-0 group-hover:opacity-100"
                  } text-zinc-600 hover:text-red-500`}
                >
                  <HeartIcon filled={item.favorited} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>

      {current && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/95"
          onClick={() => setLightbox(null)}
        >
          <div
            className="flex items-center justify-between px-4 py-3 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="truncate text-sm text-zinc-300">{current.filename}</p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => toggle(current.id)}
                className={`rounded-full p-2 ${current.favorited ? "text-red-500" : "text-white hover:text-red-400"}`}
                aria-label="Toggle favorite"
              >
                <HeartIcon filled={current.favorited} />
              </button>
              {allowDownload && (
                <a
                  href={`/api/dl/${current.id}?t=${token}`}
                  className="rounded-lg border border-zinc-600 px-3 py-1.5 text-sm hover:bg-zinc-800"
                >
                  Download
                </a>
              )}
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
            className="flex flex-1 items-center justify-center overflow-hidden px-4 pb-6"
            onClick={(e) => e.stopPropagation()}
          >
            {current.isVideo ? (
              <video
                src={`/api/dl/${current.id}?t=${token}&inline=1`}
                controls
                className="max-h-full max-w-full"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={current.webSrc}
                alt={current.filename}
                className="max-h-full max-w-full object-contain"
              />
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
