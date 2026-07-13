export const MAX_UPLOAD_FILES_PER_BATCH = 50;
export const MAX_UPLOAD_SIZE_BYTES = 20 * 1024 * 1024 * 1024;

export function isExpectedCompletedUpload(
  meta: {
    name?: string;
    mimeType: string;
    sizeBytes: number;
    parents?: string[];
  },
  expected: {
    filename: string;
    mimeType: string;
    sizeBytes: bigint;
    folderId: string;
  }
): boolean {
  if (meta.name !== expected.filename) return false;
  if (meta.mimeType !== expected.mimeType) return false;
  if (!meta.parents?.includes(expected.folderId)) return false;
  return BigInt(meta.sizeBytes) === expected.sizeBytes;
}
