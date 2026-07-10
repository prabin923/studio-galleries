"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import exifr from "exifr";
import pLimit from "p-limit";

const CHUNK_SIZE = 8 * 1024 * 1024; // multiple of 256 KiB, required by Drive
const INITIATE_BATCH = 50;
const CONCURRENT_UPLOADS = 3;
const MAX_CHUNK_RETRIES = 5;

type UploadItem = {
  name: string;
  progress: number; // 0..1
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
};

async function extractMeta(file: File) {
  let takenAt: string | undefined;
  let width: number | undefined;
  let height: number | undefined;
  if (file.type.startsWith("image/")) {
    try {
      const exif = await exifr.parse(file, ["DateTimeOriginal"]);
      if (exif?.DateTimeOriginal instanceof Date) {
        takenAt = exif.DateTimeOriginal.toISOString();
      }
    } catch {
      /* not all images carry EXIF */
    }
    try {
      const bmp = await createImageBitmap(file);
      width = bmp.width;
      height = bmp.height;
      bmp.close();
    } catch {
      /* unsupported format for bitmap decode */
    }
  }
  return { takenAt, width, height };
}

/** Ask Drive which byte offset the session has committed so far. */
async function queryCommittedBytes(uploadUrl: string, total: number): Promise<number> {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Range": `bytes */${total}` },
  });
  if (res.status === 308) {
    const range = res.headers.get("Range"); // "bytes=0-8388607"
    if (!range) return 0;
    return parseInt(range.split("-")[1], 10) + 1;
  }
  if (res.ok) return total;
  throw new Error(`upload session lost (${res.status})`);
}

async function uploadToDrive(
  file: File,
  uploadUrl: string,
  onProgress: (fraction: number) => void
): Promise<string> {
  let offset = 0;
  let retries = 0;

  while (offset < file.size) {
    const end = Math.min(offset + CHUNK_SIZE, file.size);
    const chunk = file.slice(offset, end);
    let res: Response;
    try {
      res = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Range": `bytes ${offset}-${end - 1}/${file.size}`,
        },
        body: chunk,
      });
    } catch {
      if (++retries > MAX_CHUNK_RETRIES) throw new Error("network error during upload");
      await new Promise((r) => setTimeout(r, 1000 * 2 ** retries));
      offset = await queryCommittedBytes(uploadUrl, file.size);
      continue;
    }

    if (res.status === 308) {
      retries = 0;
      offset = end;
      onProgress(offset / file.size);
      continue;
    }
    if (res.ok) {
      onProgress(1);
      const json = (await res.json()) as { id: string };
      return json.id;
    }
    if ((res.status >= 500 || res.status === 429) && retries < MAX_CHUNK_RETRIES) {
      retries++;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** retries));
      offset = await queryCommittedBytes(uploadUrl, file.size);
      continue;
    }
    throw new Error(`upload failed (${res.status})`);
  }
  throw new Error("upload ended without completion response");
}

export default function Uploader({ galleryId }: { galleryId: string }) {
  const router = useRouter();
  const [items, setItems] = useState<Record<string, UploadItem>>({});
  const [busy, setBusy] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const patchItem = (key: string, patch: Partial<UploadItem>) =>
    setItems((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));

  const onDrop = useCallback(
    async (accepted: File[]) => {
      if (accepted.length === 0) return;
      setBusy(true);
      setGlobalError(null);
      setItems((prev) => {
        const next = { ...prev };
        for (const f of accepted) {
          next[f.name] = { name: f.name, progress: 0, status: "pending" };
        }
        return next;
      });

      try {
        const withMeta = await Promise.all(
          accepted.map(async (f) => ({ file: f, meta: await extractMeta(f) }))
        );

        // initiate in batches of 50 (server limit per request)
        const targets: { file: File; fileId: string; uploadUrl: string }[] = [];
        for (let i = 0; i < withMeta.length; i += INITIATE_BATCH) {
          const batch = withMeta.slice(i, i + INITIATE_BATCH);
          const res = await fetch("/api/uploads/initiate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              galleryId,
              files: batch.map(({ file, meta }) => ({
                filename: file.name,
                mimeType: file.type || "application/octet-stream",
                sizeBytes: file.size,
                ...meta,
              })),
            }),
          });
          if (res.status === 409) {
            throw new Error("Connect Google Drive in Settings → Storage before uploading.");
          }
          if (!res.ok) throw new Error(`could not start upload (${res.status})`);
          const json = (await res.json()) as {
            files: { fileId: string; filename: string; uploadUrl?: string; error?: string }[];
          };
          json.files.forEach((r, idx) => {
            if (r.uploadUrl) {
              targets.push({ file: batch[idx].file, fileId: r.fileId, uploadUrl: r.uploadUrl });
            } else {
              patchItem(r.filename, { status: "error", error: r.error ?? "failed to start" });
            }
          });
        }

        const limit = pLimit(CONCURRENT_UPLOADS);
        await Promise.all(
          targets.map(({ file, fileId, uploadUrl }) =>
            limit(async () => {
              patchItem(file.name, { status: "uploading" });
              try {
                const driveFileId = await uploadToDrive(file, uploadUrl, (p) =>
                  patchItem(file.name, { progress: p })
                );
                const done = await fetch("/api/uploads/complete", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ fileId, driveFileId }),
                });
                if (!done.ok) throw new Error("server could not verify upload");
                patchItem(file.name, { status: "done", progress: 1 });
              } catch (e) {
                patchItem(file.name, {
                  status: "error",
                  error: e instanceof Error ? e.message : "upload failed",
                });
              }
            })
          )
        );
        router.refresh();
      } catch (e) {
        setGlobalError(e instanceof Error ? e.message : "upload failed");
      } finally {
        setBusy(false);
      }
    },
    [galleryId, router]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [], "video/*": [] },
  });

  const list = Object.values(items);
  const active = list.filter((i) => i.status === "uploading" || i.status === "pending");
  const failed = list.filter((i) => i.status === "error");

  return (
    <div>
      <div
        {...getRootProps()}
        className={`cursor-pointer rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
          isDragActive ? "border-zinc-900 bg-zinc-100" : "border-zinc-300 bg-white"
        }`}
      >
        <input {...getInputProps()} />
        <p className="text-sm font-medium text-zinc-700">
          {isDragActive ? "Drop to upload" : "Drag photos here, or click to browse"}
        </p>
        <p className="mt-1 text-xs text-zinc-400">
          Photos and videos upload straight to your Google Drive
        </p>
      </div>

      {globalError && (
        <p className="mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {globalError}
        </p>
      )}

      {(active.length > 0 || failed.length > 0) && (
        <ul className="mt-4 space-y-1">
          {active.map((i) => (
            <li key={i.name} className="flex items-center gap-3 text-sm">
              <span className="w-56 truncate text-zinc-600">{i.name}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded bg-zinc-200">
                <span
                  className="block h-full bg-zinc-900 transition-all"
                  style={{ width: `${Math.round(i.progress * 100)}%` }}
                />
              </span>
              <span className="w-10 text-right text-xs text-zinc-400">
                {Math.round(i.progress * 100)}%
              </span>
            </li>
          ))}
          {failed.map((i) => (
            <li key={i.name} className="flex items-center gap-3 text-sm text-red-600">
              <span className="w-56 truncate">{i.name}</span>
              <span className="text-xs">{i.error}</span>
            </li>
          ))}
        </ul>
      )}
      {busy && list.length > 0 && (
        <p className="mt-2 text-xs text-zinc-400">
          Keep this tab open until uploads finish.
        </p>
      )}
    </div>
  );
}
