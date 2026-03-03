import test from "node:test";
import assert from "node:assert/strict";

import { getFileScanConfig, scanUploadedBuffer } from "../../server/file-scan";

test("file scan can be disabled", async () => {
  process.env.FILE_SCAN_MODE = "off";
  const cfg = getFileScanConfig();
  assert.equal(cfg.mode, "off");

  const result = await scanUploadedBuffer(Buffer.from("hello"), "hello.txt");
  assert.equal(result.allowed, true);
});

test("optional mode allows upload when scanner is unavailable", async () => {
  process.env.FILE_SCAN_MODE = "optional";
  process.env.FILE_SCAN_BIN = "definitely-not-a-real-scanner-binary";

  const result = await scanUploadedBuffer(Buffer.from("hello"), "hello.txt");
  assert.equal(result.allowed, true);
});

test("required mode blocks upload when scanner is unavailable", async () => {
  process.env.FILE_SCAN_MODE = "required";
  process.env.FILE_SCAN_BIN = "definitely-not-a-real-scanner-binary";

  const result = await scanUploadedBuffer(Buffer.from("hello"), "hello.txt");
  assert.equal(result.allowed, false);
  assert.match(result.reason || "", /scanner unavailable|rejected/i);
});

