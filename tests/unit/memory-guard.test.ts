import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createMemoryGuard, memorySafeConcurrency, containerWorkingSet } from "../../server/memory-guard";
import { countWords, firstWords } from "../../server/text-memory";

const MiB = 1024 * 1024;
function memory(used = 200) {
  return { rssBytes: used * MiB, heapUsedBytes: 100 * MiB, externalBytes: 0, arrayBufferBytes: 0,
    containerBytes: used * MiB, workingSetBytes: used * MiB, limitBytes: 512 * MiB, usedBytes: used * MiB };
}
function request(guard: ReturnType<typeof createMemoryGuard>, path: string) {
  const res = Object.assign(new EventEmitter(), { statusCode: 200, body: "", headers: {} as Record<string, string>,
    setHeader(key: string, value: string) { this.headers[key] = value; return this; },
    status(code: number) { this.statusCode = code; return this; },
    send(body: string) { this.body = body; return this; } });
  let admitted = false;
  guard.middleware({ path } as any, res as any, () => { admitted = true; });
  return { res, admitted };
}

test("small instances cap existing Render overrides; invalid concurrency cannot disable guards", () => {
  assert.equal(memorySafeConcurrency("50", 4, 4, 512 * MiB), 4);
  assert.equal(memorySafeConcurrency("3", 1, 1, 512 * MiB), 1);
  for (const value of ["NaN", "Infinity", "0", "-1", "1.5"]) assert.equal(memorySafeConcurrency(value, 1, 1, 512 * MiB), 1);
  assert.equal(memorySafeConcurrency("8", 4, 4, 2048 * MiB), 8);
});

test("crawler bursts share four slots across API and HTML; finish and close release only once", () => {
  const guard = createMemoryGuard(() => memory());
  const active = Array.from({ length: 4 }, (_, i) => request(guard, i % 2 ? "/api/public/judgments/id" : "/judgment/id"));
  assert.ok(active.every(r => r.admitted));
  const denied = request(guard, "/judgment/fifth");
  assert.equal(denied.res.statusCode, 503);
  assert.equal(denied.res.headers["Retry-After"], "30");
  assert.equal(denied.res.headers["Cache-Control"], "no-store");
  active[0].res.emit("finish"); active[0].res.emit("close");
  assert.equal(guard.stats().publicReads, 3);
  assert.equal(request(guard, "/judgment/retry").admitted, true);
});

test("sitemap requests serialize; pressure blocks heavy reads while health and chat stay available", () => {
  let used = 200;
  const guard = createMemoryGuard(() => memory(used));
  const sitemap = request(guard, "/sitemap-judgments-1.xml");
  assert.equal(sitemap.admitted, true);
  assert.equal(request(guard, "/sitemap-judgments-2.xml").res.statusCode, 503);
  sitemap.res.emit("close");
  assert.equal(request(guard, "/sitemap.xml").admitted, true);
  used = 420;
  assert.equal(request(guard, "/api/public/judgments/id/pdf").admitted, false);
  assert.equal(request(guard, "/health").admitted, true);
  assert.equal(request(guard, "/api/ai/chat").admitted, true);
});

test("word helpers preserve Unicode word counts and excerpt boundaries without token arrays", () => {
  for (const text of ["", " \n\t", "English اردو\ntext", "one ".repeat(200000)]) {
    assert.equal(countWords(text), text.trim().split(/\s+/).filter(Boolean).length);
  }
  assert.equal(firstWords("one two three four", 2), "one two …");
  assert.equal(firstWords("one two", 2), "one two");
  assert.equal(firstWords("one", 1000), "one");
});

test("real HTTP crawler bursts remain bounded while chat responses and full judgment bodies remain available", async () => {
  const { default: express } = await import("express");
  const { once } = await import("node:events");
  const app = express();
  const guard = createMemoryGuard(() => memory());
  const body = "Complete judgment body. ".repeat(10000);
  let maximum = 0;
  app.use(guard.middleware);
  app.get("/judgment/:id", async (_req, res) => {
    maximum = Math.max(maximum, guard.stats().publicReads);
    await new Promise(resolve => setTimeout(resolve, 30));
    res.send(body);
  });
  app.post("/api/ai/chat", (_req, res) => { res.json({ ok: true }); });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as { port: number };
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const responses = await Promise.all(Array.from({ length: 40 }, (_, i) => fetch(`${base}/judgment/${i}`)));
    let success = 0, busy = 0;
    for (const response of responses) {
      if (response.status === 200) { success++; assert.equal(await response.text(), body); }
      else { busy++; assert.equal(response.status, 503); await response.text(); }
    }
    assert.ok(success >= 4); assert.ok(busy > 0); assert.equal(maximum, 4);
    const chat = await fetch(`${base}/api/ai/chat`, { method: "POST" });
    assert.equal(chat.status, 200); assert.deepEqual(await chat.json(), { ok: true });
    const retry = await fetch(`${base}/judgment/retry`);
    assert.equal(retry.status, 200); assert.equal(await retry.text(), body);
    assert.equal(guard.stats().publicReads, 0);
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});

 test("container pressure excludes reclaimable disk cache and supports both cgroup formats", () => {
  assert.equal(containerWorkingSet(450, "inactive_file 200\n"), 250);
  assert.equal(containerWorkingSet(450, "inactive_file 100\ntotal_inactive_file 200\n"), 250);
  assert.equal(containerWorkingSet(450, "anon 200\n"), 450);
  assert.equal(containerWorkingSet(100, "inactive_file 200\n"), 0);
});
