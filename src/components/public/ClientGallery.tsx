"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  setDisplayName,
  setSelectionFinalized,
  setSelectionLabel,
  toggleFavorite,
} from "@/actions/favorites";
import { addComment } from "@/actions/comments";

type Item = {
  id: string;
  filename: string;
  isVideo: boolean;
  thumbSrc: string;
  webSrc: string;
  favorited: boolean;
  selectionLabel: "MUST_HAVE" | "MAYBE" | null;
};

type CommentEntry = { id: string; text: string; createdAt: string };

type Props = {
  token: string;
  studioName: string;
  galleryTitle: string;
  galleryDescription: string | null;
  eventDate: string | null;
  coverSrc: string | null;
  items: Item[];
  selectionLimit: number | null;
  initialCount: number;
  allowDownload: boolean;
  initialDisplayName: string | null;
  initialComments: Record<string, CommentEntry[]>;
  selectionClosesAt: string | null;
  selectionIsClosed: boolean;
  initialSelectionFinalized: boolean;
};

function HeartIcon({ filled, className = "h-5 w-5" }: { filled: boolean; className?: string }) {
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

export default function ClientGallery({
  token,
  studioName,
  galleryTitle,
  galleryDescription,
  eventDate,
  coverSrc,
  items: initialItems,
  selectionLimit,
  initialCount,
  allowDownload,
  initialDisplayName,
  initialComments,
  selectionClosesAt,
  selectionIsClosed,
  initialSelectionFinalized,
}: Props) {
  const [items, setItems] = useState(initialItems);
  const [count, setCount] = useState(initialCount);
  const [comments, setComments] = useState(initialComments);
  const [displayName, setName] = useState(initialDisplayName);
  const [nameDraft, setNameDraft] = useState("");
  const [commentDraft, setCommentDraft] = useState("");
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectionFinalized, setSelectionFinalizedState] = useState(initialSelectionFinalized);
  const [pending, startTransition] = useTransition();
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set());
  const [loaded, setLoaded] = useState<Set<string>>(() => new Set());
  const gridRef = useRef<HTMLUListElement>(null);

  const visible = onlyFavorites ? items.filter((i) => i.favorited) : items;
  const proofingClosed = selectionIsClosed || selectionFinalized;
  const selectionDeadline = selectionClosesAt?.slice(0, 10) ?? null;

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    setTimeout(() => setNotice(null), 3000);
  }, []);

  // staggered reveal as tiles scroll into view
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const ids = entries
          .filter((e) => e.isIntersecting)
          .map((e) => (e.target as HTMLElement).dataset.tileId!)
          .filter(Boolean);
        if (ids.length) {
          setRevealed((prev) => {
            const next = new Set(prev);
            ids.forEach((id) => next.add(id));
            return next;
          });
        }
      },
      { rootMargin: "0px 0px 120px 0px", threshold: 0.05 }
    );
    grid.querySelectorAll("[data-tile-id]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [visible.length, onlyFavorites]);

  const markLoaded = useCallback((id: string) => {
    setLoaded((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const toggle = useCallback(
    (id: string) => {
      startTransition(async () => {
        const res = await toggleFavorite(token, id);
        if (!res.ok) {
          if (res.error === "limit_reached") {
            showNotice(`You can select up to ${selectionLimit} photos.`);
          } else if (res.error === "rate_limited") {
            showNotice("Slow down for a moment, then try again.");
          } else if (res.error === "selection_closed") {
            showNotice("Selections are closed for this gallery.");
          }
          return;
        }
        setItems((prev) =>
          prev.map((i) =>
            i.id === id
              ? {
                  ...i,
                  favorited: res.selected,
                  selectionLabel: res.selected ? "MUST_HAVE" : null,
                }
              : i
          )
        );
        setCount(res.count);
      });
    },
    [token, selectionLimit, showNotice]
  );

  const updateSelectionLabel = useCallback(
    (fileId: string, label: "MUST_HAVE" | "MAYBE") => {
      startTransition(async () => {
        const res = await setSelectionLabel(token, fileId, label);
        if (!res.ok) {
          showNotice(
            res.error === "selection_closed"
              ? "Selections are closed for this gallery."
              : "Could not update this selection. Try again."
          );
          return;
        }
        setItems((prev) =>
          prev.map((item) => (item.id === fileId ? { ...item, selectionLabel: res.label } : item))
        );
      });
    },
    [token, showNotice]
  );

  const finalizeSelection = useCallback(
    (finalized: boolean) => {
      startTransition(async () => {
        const res = await setSelectionFinalized(token, finalized);
        if (!res.ok) {
          showNotice(
            res.error === "empty_selection"
              ? "Choose at least one photo before finalizing."
              : "Could not update your selection. Try again."
          );
          return;
        }
        setSelectionFinalizedState(res.finalized);
        showNotice(res.finalized ? "Selection finalized." : "You can edit your selection again.");
      });
    },
    [token, showNotice]
  );

  const submitComment = useCallback(
    (fileId: string) => {
      const text = commentDraft.trim();
      if (!text) return;
      setCommentDraft("");
      startTransition(async () => {
        const res = await addComment(token, fileId, text);
        if (res.ok) {
          setComments((prev) => ({
            ...prev,
            [fileId]: [...(prev[fileId] ?? []), res.comment],
          }));
        } else if (res.error === "rate_limited") {
          showNotice("Too many notes in a short time. Try again in a few minutes.");
        } else if (res.error === "selection_closed") {
          showNotice("Selections are closed for this gallery.");
        }
      });
    },
    [token, commentDraft, showNotice]
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

  const current = lightbox !== null ? visible[lightbox] : null;

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Hero */}
      <div className="relative h-[46vh] min-h-[300px] w-full overflow-hidden">
        {coverSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverSrc} alt="" className="animate-kenburns h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-zinc-900" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 mx-auto max-w-6xl px-6 pb-10">
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-zinc-300">
            {studioName}
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            {galleryTitle}
          </h1>
          {(eventDate || galleryDescription) && (
            <p className="mt-3 max-w-2xl text-sm text-zinc-300">
              {eventDate}
              {eventDate && galleryDescription ? " — " : ""}
              {galleryDescription}
            </p>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-6 py-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOnlyFavorites((v) => !v)}
              className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                onlyFavorites
                  ? "border-red-500/40 bg-red-500/10 text-red-400"
                  : "border-zinc-700 text-zinc-300 hover:border-zinc-500"
              }`}
            >
              <HeartIcon filled={count > 0} className="h-4 w-4" />
              {count}
              {selectionLimit ? ` / ${selectionLimit}` : ""}
            </button>
            <span className="hidden text-xs text-zinc-500 sm:inline">
              {onlyFavorites ? "showing favorites" : `${items.length} photos`}
            </span>
          </div>
          {allowDownload && (
            <div className="flex items-center gap-2">
              {count > 0 && (
                <a
                  href={`/api/zip/${token}?favorites=1`}
                  className="rounded-full border border-zinc-700 px-3.5 py-1.5 text-sm text-zinc-300 hover:border-zinc-500"
                >
                  Download favorites
                </a>
              )}
              <a
                href={`/api/zip/${token}`}
                className="rounded-full bg-white px-3.5 py-1.5 text-sm font-medium text-zinc-950 hover:bg-zinc-200"
              >
                Download all
              </a>
            </div>
          )}
        </div>
        {(selectionDeadline || count > 0) && (
          <div className="border-t border-zinc-800 bg-zinc-900/60 px-6 py-2.5">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-zinc-400">
                {selectionFinalized
                  ? "Your selection is finalized."
                  : selectionIsClosed
                    ? "Selections are closed."
                    : selectionDeadline
                      ? `Choose your photos by ${selectionDeadline}.`
                      : "Save your favorite photos, then finalize your selection."}
              </p>
              {count > 0 && !selectionIsClosed && (
                <button
                  type="button"
                  onClick={() => finalizeSelection(!selectionFinalized)}
                  disabled={pending}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-40 ${
                    selectionFinalized
                      ? "border border-zinc-600 text-zinc-200 hover:border-zinc-400"
                      : "bg-emerald-400 text-zinc-950 hover:bg-emerald-300"
                  }`}
                >
                  {selectionFinalized ? "Edit selection" : "Finalize selection"}
                </button>
              )}
            </div>
          </div>
        )}
        {notice && (
          <p className="border-t border-amber-500/20 bg-amber-500/10 px-6 py-2 text-center text-sm text-amber-400">
            {notice}
          </p>
        )}
        {count > 0 && !displayName && (
          <form
            className="flex items-center justify-center gap-2 border-t border-zinc-800 bg-zinc-900/60 px-6 py-2"
            onSubmit={(e) => {
              e.preventDefault();
              const name = nameDraft.trim();
              if (!name) return;
              setName(name);
              startTransition(() => setDisplayName(token, name));
            }}
          >
            <label htmlFor="visitor-name" className="text-sm text-zinc-400">
              Who&apos;s choosing?
            </label>
            <input
              id="visitor-name"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              placeholder="Your name"
              maxLength={100}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-sm text-zinc-100 focus:border-zinc-400 focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-lg bg-white px-3 py-1 text-sm font-medium text-zinc-950 hover:bg-zinc-200"
            >
              Save
            </button>
          </form>
        )}
      </div>

      {/* Grid */}
      <main className="mx-auto max-w-6xl px-6 py-10">
        {visible.length === 0 ? (
          <p className="py-24 text-center text-sm text-zinc-500">
            {onlyFavorites
              ? "No favorites yet — tap the heart on photos you love."
              : "No photos yet."}
          </p>
        ) : (
          <ul ref={gridRef} className="columns-2 gap-4 sm:columns-3 lg:columns-4 [&>li]:mb-4">
            {visible.map((item, idx) => (
              <li
                key={item.id}
                data-tile-id={item.id}
                style={{ transitionDelay: revealed.has(item.id) ? "0ms" : `${(idx % 4) * 80}ms` }}
                className={`group relative break-inside-avoid transition-all duration-700 ease-out ${
                  revealed.has(item.id)
                    ? "translate-y-0 opacity-100"
                    : "translate-y-6 opacity-0"
                }`}
              >
                <button type="button" onClick={() => setLightbox(idx)} className="block w-full">
                  <span className="block overflow-hidden rounded-xl bg-zinc-900 shadow-lg shadow-black/30 ring-1 ring-white/5 transition-all duration-500 group-hover:shadow-2xl group-hover:shadow-black/60 group-hover:ring-white/15">
                    {!loaded.has(item.id) && (
                      <span className="block aspect-[4/3] w-full animate-pulse bg-zinc-800" />
                    )}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.thumbSrc}
                      alt={item.filename}
                      loading="lazy"
                      onLoad={() => markLoaded(item.id)}
                      className={`h-auto w-full transition-all duration-700 group-hover:scale-[1.05] ${
                        loaded.has(item.id) ? "opacity-100" : "absolute h-0 opacity-0"
                      }`}
                    />
                    {/* hover veil with filename */}
                    <span className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                    <span className="pointer-events-none absolute inset-x-3 bottom-2.5 truncate text-left text-xs text-zinc-200 opacity-0 transition-all duration-300 group-hover:opacity-100">
                      {item.filename}
                    </span>
                  </span>
                </button>
                {(comments[item.id]?.length ?? 0) > 0 && (
                  <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-zinc-200 backdrop-blur">
                    💬 {comments[item.id].length}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => toggle(item.id)}
                  disabled={pending || proofingClosed}
                  aria-label={item.favorited ? "Remove from favorites" : "Add to favorites"}
                  className={`absolute right-2 top-2 rounded-full bg-black/50 p-1.5 backdrop-blur transition-all duration-300 hover:scale-110 ${
                    item.favorited ? "" : "opacity-0 group-hover:opacity-100"
                  } text-zinc-200 hover:text-red-400 disabled:opacity-40`}
                >
                  <HeartIcon filled={item.favorited} />
                </button>
                {item.selectionLabel && (
                  <span
                    className={`absolute bottom-2 left-2 h-2.5 w-2.5 rounded-full ring-2 ring-zinc-950 ${
                      item.selectionLabel === "MUST_HAVE" ? "bg-emerald-400" : "bg-amber-400"
                    }`}
                    title={item.selectionLabel === "MUST_HAVE" ? "Must have" : "Maybe"}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </main>

      <footer className="border-t border-zinc-900 py-6 text-center text-xs text-zinc-600">
        {studioName} · delivered with Studio Galleries
      </footer>

      {/* Lightbox */}
      {current && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-md"
          onClick={() => setLightbox(null)}
        >
          <div
            className="flex items-center justify-between px-4 py-3 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="truncate text-sm text-zinc-400">
              <span className="mr-3 tabular-nums text-zinc-500">
                {(lightbox ?? 0) + 1} / {visible.length}
              </span>
              {current.filename}
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => toggle(current.id)}
                disabled={pending || proofingClosed}
                className={`rounded-full p-2 disabled:opacity-40 ${current.favorited ? "text-red-500" : "text-white hover:text-red-400"}`}
                aria-label="Toggle favorite"
              >
                <HeartIcon filled={current.favorited} />
              </button>
              {current.favorited && (
                <div
                  className="flex overflow-hidden rounded-lg border border-zinc-700 text-xs"
                  role="group"
                  aria-label="Selection priority"
                >
                  <button
                    type="button"
                    onClick={() => updateSelectionLabel(current.id, "MUST_HAVE")}
                    disabled={pending || proofingClosed}
                    className={`px-2.5 py-1.5 disabled:opacity-40 ${
                      current.selectionLabel === "MUST_HAVE"
                        ? "bg-emerald-400 font-medium text-zinc-950"
                        : "text-zinc-300 hover:bg-zinc-800"
                    }`}
                  >
                    Must have
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSelectionLabel(current.id, "MAYBE")}
                    disabled={pending || proofingClosed}
                    className={`border-l border-zinc-700 px-2.5 py-1.5 disabled:opacity-40 ${
                      current.selectionLabel === "MAYBE"
                        ? "bg-amber-400 font-medium text-zinc-950"
                        : "text-zinc-300 hover:bg-zinc-800"
                    }`}
                  >
                    Maybe
                  </button>
                </div>
              )}
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
            className="flex min-h-0 flex-1 items-center justify-center px-4"
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

          {/* Comments */}
          <div
            className="mx-auto w-full max-w-2xl px-4 pb-5 pt-3"
            onClick={(e) => e.stopPropagation()}
          >
            {(comments[current.id] ?? []).map((c) => (
              <p key={c.id} className="mb-1 text-sm text-zinc-300">
                <span className="text-zinc-500">You:</span> {c.text}
              </p>
            ))}
            <form
              className="mt-1 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                submitComment(current.id);
              }}
            >
              <input
                value={commentDraft}
                onChange={(e) => setCommentDraft(e.target.value)}
                placeholder="Leave a note for the photographer…"
                maxLength={1000}
                className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-400 focus:outline-none"
              />
              <button
                type="submit"
                disabled={pending || proofingClosed || !commentDraft.trim()}
                className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-950 disabled:opacity-40"
              >
                Send
              </button>
            </form>
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
