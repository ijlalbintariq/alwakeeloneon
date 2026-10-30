import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { z } from "zod";
import { readChatEvents } from "../../client/src/experimental/lib/chat-stream";
import { cleanLegalChatResponse } from "../../client/src/experimental/lib/cleanChatResponse";

const response = (chunks: Uint8Array[]) => new Response(new ReadableStream({ start(controller) { chunks.forEach((chunk) => controller.enqueue(chunk)); controller.close(); } }));
const bytes = (text: string) => new TextEncoder().encode(text);
const collect = async (res: Response) => { const events = []; for await (const event of readChatEvents(res)) events.push(event); return events; };

test("chat SSE handles byte fragmentation, Urdu, CRLF and the final event without a newline", async () => {
  const encoded = bytes(': heartbeat\r\ndata:{"text":"اردو"}\r\n\r\ndata: {"done":true}');
  const events = await collect(response(Array.from(encoded, (byte) => new Uint8Array([byte]))));
  assert.deepEqual(events, [{ text: "اردو" }, { done: true }]);
});

test("chat SSE supports multiline data and ignores non-data fields", async () => {
  assert.deepEqual(await collect(response([bytes('event: message\nid: 1\ndata: {"text":\ndata: "answer"}\n\ndata: [DONE]\n\n')])), [{ text: "answer" }, { done: true }]);
});

test("chat SSE exposes error events and rejects corrupt or missing streams", async () => {
  assert.deepEqual(await collect(response([bytes('data: {"error":"Unavailable"}\n\n')])), [{ error: "Unavailable" }]);
  for (const data of ["broken", "null", "[]"]) await assert.rejects(collect(response([bytes(`data: ${data}\n\n`)])), /invalid stream event/);
  await assert.rejects(collect(new Response(null)), /did not include a stream/);
});

test("leaving a chat SSE loop cancels and releases a still-open stream", async () => {
  let cancelled = false;
  const body = new ReadableStream({ start(controller) { controller.enqueue(bytes('data: {"done":true}\n\n')); }, cancel() { cancelled = true; } });
  for await (const event of readChatEvents(new Response(body))) { assert.equal(event.done, true); break; }
  assert.equal(cancelled, true);
  assert.equal(body.locked, false);
});

test("chat references retain unknown courts rather than inventing a Supreme Court attribution", () => {
  const cleaned = cleanLegalChatResponse('Fixture answer.\n```references\n{"judgments":[{"citation":"PLD 2024 SC 17"}]}\n```');
  assert.equal(cleaned.references?.judgments[0].court, "");
  assert.equal(cleaned.cleanContent, "Fixture answer.");
});

// Execute the actual registered handlers with injected storage, without booting the application or a database.
const sourceText = readFileSync(new URL("../../server/routes.ts", import.meta.url), "utf8");
const source = ts.createSourceFile("routes.ts", sourceText, ts.ScriptTarget.Latest, true);
function handler(path: string, dependencies: Record<string, any>) {
  let callback: ts.Node | undefined;
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && node.expression.getText(source) === "app.post" && [path, JSON.stringify(path)].includes(node.arguments[0]?.getText(source))) callback = node.arguments.at(-1);
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(callback, `Route ${path} exists`);
  const code = ts.transpileModule(`(${callback.getText(source)})`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  return new Function(...Object.keys(dependencies), `return ${code}`)(...Object.values(dependencies));
}
function reply() {
  return { statusCode: 200, body: null as any, status(code: number) { this.statusCode = code; return this; }, json(body: any) { this.body = body; return this; }, sendStatus(code: number) { this.statusCode = code; return this; } };
}

test("Vault rejects missing or empty case files before charging usage or broadening retrieval", async () => {
  for (const [caseFile, ids, expected] of [[null, [], 404], [{ id: 7 }, [], 422]] as const) {
    let charged = false;
    const run = handler("/api/rag/ask", { getUserId: () => "owner", z, storage: { getCaseFile: async () => caseFile, getCaseDocumentIds: async () => ids }, checkUsageLimit: async () => { charged = true; return true; } });
    const res = reply();
    await run({ body: { query: "Case question", caseFileId: 7 } }, res);
    assert.equal(res.statusCode, expected);
    assert.equal(charged, false);
  }
});

test("saving to an absent or unowned thread returns 404 without recreating it", async () => {
  let inserted = false;
  const tx = { select: () => ({ from: () => ({ where: () => ({ for: async () => [] }) }) }), insert: () => { inserted = true; throw new Error("Must not insert"); } };
  const run = handler("/api/threads/upsert-turn", { getUserId: () => "owner", z, db: { transaction: async (callback: any) => callback(tx) }, threads: {}, eq: () => true, and: () => true });
  const res = reply();
  await run({ body: { threadId: 7, userMessage: "Question", assistantMessage: "Answer" } }, res);
  assert.equal(res.statusCode, 404);
  assert.equal(inserted, false);
});

test("saving a chat turn inserts both roles within one transaction and updates its thread", async () => {
  const saved: any[] = [];
  const thread = { id: 7, userId: "owner" };
  const tx = {
    select: () => ({ from: () => ({ where: () => ({ for: async () => [thread] }) }) }),
    insert: () => ({ values: async (values: any[]) => { saved.push(...values); } }),
    update: () => ({ set: () => ({ where: () => ({ returning: async () => [thread] }) }) }),
  };
  let transactions = 0;
  const run = handler("/api/threads/upsert-turn", { getUserId: () => "owner", z, db: { transaction: async (callback: any) => { transactions++; return callback(tx); } }, threads: {}, chatMessages: {}, eq: () => true, and: () => true });
  const res = reply();
  await run({ body: { threadId: 7, userMessage: "Question", assistantMessage: "Answer" } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(transactions, 1);
  assert.deepEqual(saved, [{ threadId: 7, role: "user", content: "Question" }, { threadId: 7, role: "assistant", content: "Answer" }]);
  assert.equal(res.body.threadId, 7);
});

test("chat validates message shape and the final user role before charging quota", async () => {
  for (const messages of [undefined, [], [{ role: "assistant", content: "Answer" }], [{ role: "unknown", content: "Question" }], [{ role: "user", content: 12 }]]) {
    let charged = false;
    let released = 0;
    const run = handler("api.ai.chat.path", { getUserId: () => "owner", z, crypto: { randomUUID: () => "fixture" }, beginInteractiveChatRequest: () => () => { released++; }, checkUsageLimit: async () => { charged = true; return true; } });
    const res = { ...reply(), write: () => true, on() {} };
    await run({ body: { messages } }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(charged, false);
    assert.equal(released, 1);
  }
});

test("Vault lazy indexing keeps case-file scope and applies the enrichment deadline before awaiting it", async () => {
  const indexed: any[] = [];
  const retrieved: any[] = [];
  let deadline = 0;
  const run = handler("/api/rag/ask", {
    getUserId: () => "owner", z,
    storage: { getCaseFile: async () => ({ id: 7 }), getCaseDocumentIds: async () => [42] },
    checkUsageLimit: async () => true,
    classifyQueryIntent: () => ({}),
    retrieveForQuery: async (args: any) => { retrieved.push(args.documentIds); return { matches: [], confidence: "low" }; },
    ensureIndexedForUserDocuments: async (args: any) => { indexed.push(args.sourceDocumentIds); return { indexedNow: 1 }; },
    gatherKnowledgeContextV2: () => new Promise(() => {}),
    raceToDeadline: async (_promise: any, ms: number, fallback: any) => { deadline = ms; return { value: fallback }; },
  });
  const res = reply();
  await run({ body: { query: "Case question", caseFileId: 7 } }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(indexed, [[42]]);
  assert.deepEqual(retrieved, [[42], [42]]);
  assert.equal(deadline, 8000);
});
