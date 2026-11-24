import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ts from "typescript";
import { EventEmitter } from "node:events";

function compile(file: string, name: string, dependencies: Record<string, any>) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
  let node: ts.FunctionDeclaration | undefined;
  const visit = (n: ts.Node) => { if (ts.isFunctionDeclaration(n) && n.name?.text === name) node = n; ts.forEachChild(n, visit); };
  visit(source); assert.ok(node);
  const code = ts.transpileModule(`(${node.getText(source).replace(/^export\s+/, "")})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(dependencies), `return ${code}`)(...Object.values(dependencies));
}

test("disk uploads do not retain processed buffers on every request file or copy background bytes", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "upload-memory-test-"));
  try {
    const file = { path: path.join(dir, "input.txt"), originalname: "input.txt" };
    fs.writeFileSync(file.path, "original judgment");
    const load = compile("server/routes.ts", "getUploadBufferOrThrow", { fs, Buffer });
    const clone = compile("server/routes.ts", "cloneUploadFile", { getUploadBufferOrThrow: load });
    assert.equal(load(file).toString(), "original judgment");
    assert.equal("buffer" in file, false);
    const background = clone(file);
    fs.unlinkSync(file.path);
    assert.equal(background.buffer.toString(), "original judgment");
    const buffered = { buffer: Buffer.from("immutable input") };
    assert.equal(clone(buffered).buffer, buffered.buffer);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("statute cache evicts by bytes, accounts for replacements and declines oversized entries", () => {
  const seoCache = new Map();
  const run = compile("server/static.ts", "setSeoCache", {
    seoCache, MAX_SEO_CACHE_SIZE: 500, MAX_SEO_CACHE_BYTES: 100, seoCacheBytes: 0, Buffer,
  });
  const entry = (text: string) => ({ meta: {}, preRenderBlock: text, expiresAt: Date.now() + 1000 });
  run("first", entry("x".repeat(60)));
  run("second", entry("y".repeat(60)));
  assert.deepEqual([...seoCache.keys()], ["second"]);
  run("second", entry("z".repeat(10)));
  run("third", entry("a".repeat(70)));
  assert.equal(seoCache.size, 2);
  run("huge", entry("h".repeat(200)));
  assert.equal(seoCache.has("huge"), false);
});

test("worker success and timeout wait for worker termination before releasing queued buffers", async () => {
  for (const timeout of [false, true]) {
    let worker: any, onTimeout: (() => void) | undefined, endTermination: (() => void) | undefined;
    let removed = false;
    class FakeWorker extends EventEmitter {
      constructor() { super(); worker = this; }
      terminate() { return new Promise<void>(resolve => { endTermination = resolve; }); }
    }
    const run = compile("server/extraction-guard.ts", "runWorkerTask", {
      fs: { mkdtemp: async () => "/temp/test", writeFile: async () => {}, rm: async () => { removed = true; } },
      os, path, Worker: FakeWorker, WORKER_SCRIPT: "", setTimeout: (callback: () => void) => { onTimeout = callback; return 1; }, clearTimeout() {},
    });
    let settled = false;
    const result = run("pdf-parse", Buffer.from("pdf bytes"), 3000).then((value: any) => { settled = true; return value; }, (error: Error) => { settled = true; return error; });
    await new Promise(resolve => setImmediate(resolve));
    if (timeout) onTimeout!(); else worker.emit("message", { ok: true, payload: { text: "complete judgment" } });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(settled, false); assert.equal(removed, false);
    endTermination!();
    const value = await result;
    assert.equal(removed, true);
    if (timeout) assert.match(value.message, /timed out/);
    else assert.deepEqual(value, { text: "complete judgment" });
  }
});

test("upload queue bounds waiting requests, removes disconnected clients and releases slots once", () => {
  const source = ts.createSourceFile("routes.ts", fs.readFileSync("server/routes.ts", "utf8"), ts.ScriptTarget.Latest, true);
  const names = ["getUploadQueueStats", "releaseUploadSlot", "createUploadQueueMiddleware"];
  const functions = names.map(name => {
    const node = source.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name)!;
    assert.ok(node); return node.getText(source).replace(/^export\s+/, "");
  }).join("\n");
  const code = ts.transpileModule(functions, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const guard = new Function("readMemorySnapshot", `let activeUploadRequests = 0; const pendingUploadResolvers = [];
    const UPLOAD_QUEUE_CONCURRENCY = 1, UPLOAD_QUEUE_MAX_PENDING = 2;
    ${code}; return {middleware: createUploadQueueMiddleware('test'), stats: getUploadQueueStats};`)(() => ({ usedBytes: 200, limitBytes: 512 }));
  function send() {
    let admitted = false;
    const res = Object.assign(new EventEmitter(), { statusCode: 200, status(code: number) { this.statusCode = code; return this; }, json() { return this; } });
    guard.middleware({}, res, () => { admitted = true; });
    return { res, admitted: () => admitted };
  }
  const first = send(), cancelled = send(), third = send(), full = send();
  assert.equal(first.admitted(), true); assert.equal(third.admitted(), false);
  assert.equal(full.res.statusCode, 503); assert.equal(guard.stats().queued, 2);
  cancelled.res.emit("close"); assert.equal(guard.stats().queued, 1);
  first.res.emit("finish"); first.res.emit("close");
  assert.equal(cancelled.admitted(), false); assert.equal(third.admitted(), true);
  assert.equal(guard.stats().active, 1);
  third.res.emit("finish"); assert.equal(guard.stats().active, 0);
});
