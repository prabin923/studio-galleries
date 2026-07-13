import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { publicAppUrlFromEnv } from "../src/lib/app-url.ts";

const originalNextPublicAppUrl = process.env.NEXT_PUBLIC_APP_URL;
const originalVercelUrl = process.env.VERCEL_URL;

afterEach(() => {
  if (originalNextPublicAppUrl === undefined) {
    delete process.env.NEXT_PUBLIC_APP_URL;
  } else {
    process.env.NEXT_PUBLIC_APP_URL = originalNextPublicAppUrl;
  }

  if (originalVercelUrl === undefined) {
    delete process.env.VERCEL_URL;
  } else {
    process.env.VERCEL_URL = originalVercelUrl;
  }
});

test("public app URL prefers explicit configured origin", () => {
  process.env.NEXT_PUBLIC_APP_URL = "https://galleries.example.com/";
  process.env.VERCEL_URL = "preview.vercel.app";

  assert.equal(publicAppUrlFromEnv(), "https://galleries.example.com");
});

test("public app URL normalizes Vercel host fallback", () => {
  delete process.env.NEXT_PUBLIC_APP_URL;
  process.env.VERCEL_URL = "studio-galleries.vercel.app/";

  assert.equal(publicAppUrlFromEnv(), "https://studio-galleries.vercel.app");
});
