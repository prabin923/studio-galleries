import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "crypto";

function storageKey(): Buffer {
  const hex = process.env.STORAGE_TOKEN_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error("STORAGE_TOKEN_KEY must be 32 bytes of hex (openssl rand -hex 32)");
  }
  return Buffer.from(hex, "hex");
}

// AES-256-GCM: [12-byte iv | 16-byte auth tag | ciphertext], base64url
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", storageKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString("base64url");
}

export function decryptSecret(blob: string): string {
  const buf = Buffer.from(blob, "base64url");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", storageKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

function imageSecret(): string {
  const s = process.env.IMAGE_URL_SECRET;
  if (!s) throw new Error("IMAGE_URL_SECRET is not set");
  return s;
}

export function signPayload(payload: string): string {
  return createHmac("sha256", imageSecret()).update(payload).digest("base64url");
}

export function verifyPayload(payload: string, sig: string): boolean {
  const expected = signPayload(payload);
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Signed URL for the image proxy: /api/i/{fileId}/{variant}?exp&sig */
export function signedImagePath(fileId: string, variant: string, ttlMs = 24 * 60 * 60 * 1000): string {
  const exp = Date.now() + ttlMs;
  const sig = signPayload(`${fileId}|${variant}|${exp}`);
  return `/api/i/${fileId}/${variant}?exp=${exp}&sig=${sig}`;
}

export function verifyImageSig(fileId: string, variant: string, exp: string, sig: string): boolean {
  const expNum = Number(exp);
  if (!Number.isFinite(expNum) || expNum < Date.now()) return false;
  return verifyPayload(`${fileId}|${variant}|${exp}`, sig);
}
