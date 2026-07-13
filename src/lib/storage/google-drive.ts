import {
  RemoteFileMeta,
  RemoteFileMissingError,
  RemoteStream,
  StorageProvider,
} from "./types";

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3";

const FOLDER_MIME = "application/vnd.google-apps.folder";

type ThumbCacheEntry = { url: string; fetchedAt: number };

// Drive thumbnailLink URLs expire after a few hours; cache resolved links
// briefly and re-resolve on failure.
const thumbCache = new Map<string, ThumbCacheEntry>();
const THUMB_CACHE_TTL_MS = 30 * 60 * 1000;
const THUMB_CACHE_MAX = 5000;

export class GoogleDriveProvider implements StorageProvider {
  constructor(private getAccessToken: () => Promise<string>) {}

  private async fetchWithRetry(url: string, init: RequestInit = {}, attempt = 0): Promise<Response> {
    const token = await this.getAccessToken();
    const res = await fetch(url, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${token}` },
    });
    if ((res.status === 429 || res.status >= 500 || res.status === 403) && attempt < 4) {
      // 403 may be rateLimitExceeded; only retry when Drive says so
      if (res.status === 403) {
        const body = await res.clone().text();
        if (!/rate.?limit|userRateLimit/i.test(body)) return res;
      }
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt + Math.random() * 250));
      return this.fetchWithRetry(url, init, attempt + 1);
    }
    return res;
  }

  private async fetchJson<T>(url: string, init: RequestInit = {}): Promise<T> {
    const res = await this.fetchWithRetry(url, init);
    if (res.status === 404) {
      throw new RemoteFileMissingError(url);
    }
    if (!res.ok) {
      throw new Error(`Drive API ${init.method ?? "GET"} ${url} failed: ${res.status} ${await res.text()}`);
    }
    return (await res.json()) as T;
  }

  async ensureRootFolder(name: string): Promise<string> {
    // drive.file scope only sees files this app created, so a name query is safe
    const q = encodeURIComponent(
      `name = '${name.replace(/'/g, "\\'")}' and mimeType = '${FOLDER_MIME}' and trashed = false and 'root' in parents`
    );
    const found = await this.fetchJson<{ files: { id: string }[] }>(
      `${DRIVE_API}/files?q=${q}&fields=files(id)&pageSize=1`
    );
    if (found.files.length > 0) return found.files[0].id;
    return this.createFolder(name, "root");
  }

  async createFolder(name: string, parentId: string): Promise<string> {
    const created = await this.fetchJson<{ id: string }>(`${DRIVE_API}/files?fields=id`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parentId] }),
    });
    return created.id;
  }

  async initiateResumableUpload(opts: {
    folderId: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
  }): Promise<{ uploadUrl: string }> {
    const res = await this.fetchWithRetry(
      `${DRIVE_UPLOAD}/files?uploadType=resumable&fields=id`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Type": opts.mimeType,
          "X-Upload-Content-Length": String(opts.sizeBytes),
          // Google echoes CORS headers on the session URI only when the
          // session is initiated with the browser's origin — without this,
          // the browser's direct chunk PUTs fail with a CORS error
          Origin: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001",
        },
        body: JSON.stringify({
          name: opts.filename,
          mimeType: opts.mimeType,
          parents: [opts.folderId],
        }),
      }
    );
    if (!res.ok) {
      throw new Error(`Drive resumable initiate failed: ${res.status} ${await res.text()}`);
    }
    const uploadUrl = res.headers.get("Location");
    if (!uploadUrl) throw new Error("Drive resumable initiate returned no Location header");
    return { uploadUrl };
  }

  async getFileMeta(providerFileId: string): Promise<RemoteFileMeta> {
    const f = await this.fetchJson<{
      id: string;
      size?: string;
      mimeType: string;
      md5Checksum?: string;
      imageMediaMetadata?: { width?: number; height?: number };
      thumbnailLink?: string;
    }>(
      `${DRIVE_API}/files/${providerFileId}?fields=id,size,mimeType,md5Checksum,imageMediaMetadata,thumbnailLink`
    );
    if (f.thumbnailLink) {
      rememberThumb(providerFileId, f.thumbnailLink);
    }
    return {
      providerFileId: f.id,
      sizeBytes: Number(f.size ?? 0),
      mimeType: f.mimeType,
      checksum: f.md5Checksum,
      width: f.imageMediaMetadata?.width,
      height: f.imageMediaMetadata?.height,
    };
  }

  async getFileStream(providerFileId: string, opts?: { range?: string }): Promise<RemoteStream> {
    const token = await this.getAccessToken();
    const res = await fetch(`${DRIVE_API}/files/${providerFileId}?alt=media`, {
      headers: {
        Authorization: `Bearer ${token}`,
        ...(opts?.range ? { Range: opts.range } : {}),
      },
    });
    if (res.status === 404) throw new RemoteFileMissingError(providerFileId);
    if (!res.ok && res.status !== 206) {
      throw new Error(`Drive media fetch failed: ${res.status} ${await res.text()}`);
    }
    const headers: Record<string, string> = {};
    for (const h of ["content-type", "content-length", "content-range", "accept-ranges"]) {
      const v = res.headers.get(h);
      if (v) headers[h] = v;
    }
    return { stream: res.body!, headers, status: res.status };
  }

  async getThumbnailUrl(providerFileId: string, sizePx: number): Promise<string | null> {
    const cached = thumbCache.get(providerFileId);
    let link = cached && Date.now() - cached.fetchedAt < THUMB_CACHE_TTL_MS ? cached.url : null;
    if (!link) {
      const f = await this.fetchJson<{ thumbnailLink?: string }>(
        `${DRIVE_API}/files/${providerFileId}?fields=thumbnailLink`
      );
      if (!f.thumbnailLink) return null;
      link = f.thumbnailLink;
      rememberThumb(providerFileId, link);
    }
    // thumbnailLink ends with a size directive like "=s220" — swap it
    return link.replace(/=s\d+(-[a-z]+)?$/, `=s${sizePx}`);
  }

  /** Drop a cached thumbnail link (call when a fetch against it 403/404s). */
  forgetThumbnail(providerFileId: string): void {
    thumbCache.delete(providerFileId);
  }

  async deleteFile(providerFileId: string): Promise<void> {
    const res = await this.fetchWithRetry(`${DRIVE_API}/files/${providerFileId}`, {
      method: "DELETE",
    });
    if (!res.ok && res.status !== 404) {
      throw new Error(`Drive delete failed: ${res.status} ${await res.text()}`);
    }
  }

  async deleteFolder(folderId: string): Promise<void> {
    await this.deleteFile(folderId);
  }
}

function rememberThumb(id: string, url: string) {
  if (thumbCache.size >= THUMB_CACHE_MAX) {
    const oldest = thumbCache.keys().next().value;
    if (oldest) thumbCache.delete(oldest);
  }
  thumbCache.delete(id);
  thumbCache.set(id, { url, fetchedAt: Date.now() });
}
