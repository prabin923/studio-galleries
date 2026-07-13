import assert from "node:assert/strict";
import { test } from "node:test";
import { cacheHeaderForExpiry, contentDisposition } from "../src/lib/http.ts";

test("content disposition strips header-breaking fallback characters", () => {
  const value = contentDisposition("attachment", 'bad"\r\nname.jpg');
  assert.equal(value.includes("\r"), false);
  assert.equal(value.includes("\n"), false);
  assert.match(value, /^attachment; filename=/);
  assert.match(value, /filename\*=UTF-8''/);
});

test("signed image cache headers do not outlive URL expiry", () => {
  assert.equal(
    cacheHeaderForExpiry(String(1_700_000_060_000), 1_700_000_000_000),
    "private, max-age=60, immutable"
  );
  assert.equal(cacheHeaderForExpiry("bad"), "private, no-store");
  assert.equal(cacheHeaderForExpiry(String(1_699_999_999_000), 1_700_000_000_000), "private, no-store");
});
