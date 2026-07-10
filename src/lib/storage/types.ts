export type RemoteFileMeta = {
  providerFileId: string;
  sizeBytes: number;
  mimeType: string;
  width?: number;
  height?: number;
  checksum?: string;
};

export type RemoteStream = {
  stream: ReadableStream;
  headers: Record<string, string>;
  status: number;
};

/**
 * Abstraction over the file backend. MVP ships GoogleDriveProvider; an
 * S3-compatible provider can be added later without touching product code.
 */
export interface StorageProvider {
  /** Returns the provider id of the app's root folder, creating it if needed. */
  ensureRootFolder(name: string): Promise<string>;
  createFolder(name: string, parentId: string): Promise<string>;
  /**
   * Starts a resumable upload and returns a URL the *browser* can PUT chunks
   * to directly — file bytes never pass through our server.
   */
  initiateResumableUpload(opts: {
    folderId: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
  }): Promise<{ uploadUrl: string }>;
  getFileMeta(providerFileId: string): Promise<RemoteFileMeta>;
  getFileStream(providerFileId: string, opts?: { range?: string }): Promise<RemoteStream>;
  /**
   * Provider-hosted thumbnail URL for server-side fetching, or null if the
   * provider can't resize (caller falls back to getFileStream).
   */
  getThumbnailUrl(providerFileId: string, sizePx: number): Promise<string | null>;
  deleteFile(providerFileId: string): Promise<void>;
  deleteFolder(folderId: string): Promise<void>;
}

export class StorageNotConnectedError extends Error {
  constructor() {
    super("No storage connection for this studio");
    this.name = "StorageNotConnectedError";
  }
}

export class StorageRevokedError extends Error {
  constructor() {
    super("Storage access was revoked by the account owner");
    this.name = "StorageRevokedError";
  }
}

export class RemoteFileMissingError extends Error {
  constructor(public providerFileId: string) {
    super(`Remote file ${providerFileId} no longer exists`);
    this.name = "RemoteFileMissingError";
  }
}
