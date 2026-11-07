import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("the zero-cost worker blocks fetch and HTTPS before opening an external connection", () => {
  const result = spawnSync(process.execPath, ["--import", "tsx", "--import", "./script/no_paid_network.ts", "--input-type=module", "-e", `
    import assert from 'node:assert/strict';
    import https, {request} from 'node:https';
    await assert.rejects(fetch('https://example.invalid'), /External HTTP is disabled/);
    assert.throws(() => https.request('https://example.invalid'), /External HTTP is disabled/);
    assert.throws(() => request('https://example.invalid'), /External HTTP is disabled/);
  `], { cwd: process.cwd(), encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
});
