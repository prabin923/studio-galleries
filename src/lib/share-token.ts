import { randomBytes } from "crypto";

const SHARE_TOKEN_BYTES = 24;
const SHARE_TOKEN_MAX_LENGTH = 64;
const SHARE_TOKEN_RE = /^[A-Za-z0-9_-]+$/;

export function generateShareToken(): string {
  return randomBytes(SHARE_TOKEN_BYTES).toString("base64url");
}

export function isPlausibleShareToken(token: string): boolean {
  return (
    token.length > 0 &&
    token.length <= SHARE_TOKEN_MAX_LENGTH &&
    SHARE_TOKEN_RE.test(token)
  );
}
