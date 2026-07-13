import assert from "node:assert/strict";
import { test } from "node:test";
import { isExpectedCompletedUpload } from "../src/lib/upload-policy.ts";

const expected = {
  filename: "IMG_0001.jpg",
  mimeType: "image/jpeg",
  sizeBytes: 123n,
  folderId: "gallery-folder",
};

test("completed uploads must match name, type, size, and parent folder", () => {
  assert.equal(
    isExpectedCompletedUpload(
      {
        name: "IMG_0001.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 123,
        parents: ["gallery-folder"],
      },
      expected
    ),
    true
  );
});

test("completed uploads reject mismatched Drive files", () => {
  assert.equal(
    isExpectedCompletedUpload(
      {
        name: "other.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 123,
        parents: ["gallery-folder"],
      },
      expected
    ),
    false
  );
  assert.equal(
    isExpectedCompletedUpload(
      {
        name: "IMG_0001.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 123,
        parents: ["other-folder"],
      },
      expected
    ),
    false
  );
});
