import assert from "node:assert/strict";
import { test } from "node:test";
import {
  generateShareToken,
  isPlausibleShareToken,
} from "../src/lib/share-token.ts";

test("generated share tokens are URL-safe and accepted", () => {
  const token = generateShareToken();
  assert.equal(isPlausibleShareToken(token), true);
  assert.match(token, /^[A-Za-z0-9_-]+$/);
});

test("implausible share tokens are rejected before database lookup", () => {
  assert.equal(isPlausibleShareToken(""), false);
  assert.equal(isPlausibleShareToken("x".repeat(65)), false);
  assert.equal(isPlausibleShareToken("../secret"), false);
  assert.equal(isPlausibleShareToken("abc def"), false);
});
