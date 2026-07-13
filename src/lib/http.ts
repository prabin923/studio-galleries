const FALLBACK_FILENAME_RE = /[\r\n"\\]/g;

function fallbackFilename(filename: string): string {
  const cleaned = filename
    .replace(FALLBACK_FILENAME_RE, "_")
    .replace(/[^\x20-\x7E]/g, "_")
    .trim();
  return cleaned || "download";
}

function encodeRFC5987(value: string): string {
  return encodeURIComponent(value).replace(/['()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

export function contentDisposition(
  disposition: "attachment" | "inline",
  filename: string
): string {
  return `${disposition}; filename="${fallbackFilename(
    filename
  )}"; filename*=UTF-8''${encodeRFC5987(filename)}`;
}

export function cacheHeaderForExpiry(exp: string, now = Date.now()): string {
  const expMs = Number(exp);
  if (!Number.isFinite(expMs)) return "private, no-store";
  const seconds = Math.max(0, Math.floor((expMs - now) / 1000));
  if (seconds === 0) return "private, no-store";
  return `private, max-age=${seconds}, immutable`;
}
