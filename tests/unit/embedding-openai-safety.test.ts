import test from "node:test";
import assert from "node:assert/strict";

process.env.RAG_EMBEDDING_PROVIDER = "openai";
process.env.OPENROUTER_API_KEY = "synthetic-test-key";
const { embedTextLocal, embedTextsLocal, validateEmbeddingBatch } = await import("../../server/rag/embedding-local");

test("embedding responses preserve input ordering and normalize valid vectors", () => {
  assert.deepEqual(validateEmbeddingBatch([{ index: 1, embedding: [0, 2] }, { index: 0, embedding: [3, 0] }], 2, 2), [[1, 0], [0, 1]]);
});

test("malformed embeddings cannot be padded, hashed or inserted", () => {
  for (const items of [undefined, [], [{ index: 1, embedding: [1, 0] }], [{ index: 0, embedding: [1] }], [{ index: 0, embedding: [0, 0] }], [{ index: 0, embedding: [NaN, 1] }], [{ index: 0, embedding: [null, 1] }]]) {
    assert.throws(() => validateEmbeddingBatch(items, 1, 2), /Embedding response count mismatch|Invalid embedding response/);
  }
});

test("OpenAI-compatible API failures reject instead of returning hashing vectors", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response("Unavailable", { status: 503 });
    await assert.rejects(embedTextsLocal(["A judgment"], 2), /HTTP 503/);
    globalThis.fetch = async () => { throw new Error("Synthetic timeout"); };
    await assert.rejects(embedTextLocal("A judgment", 2), /Synthetic timeout/);
  } finally { globalThis.fetch = original; }
});

test("OpenAI-compatible requests use the configured dimensions and validate the entire batch", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (_url, request) => {
      const body = JSON.parse(String(request?.body));
      assert.equal(body.dimensions, 2);
      assert.deepEqual(body.input, ["First judgment", "Second judgment"]);
      return new Response(JSON.stringify({ model: "text-embedding-3-small", data: [{ index: 1, embedding: [0, 2] }, { index: 0, embedding: [3, 0] }] }));
    };
    assert.deepEqual(await embedTextsLocal(["First judgment", "Second judgment"], 2), [[1, 0], [0, 1]]);
    globalThis.fetch = async () => new Response(JSON.stringify({ model: "text-embedding-3-small", data: [{ index: 0, embedding: [1, 0] }] }));
    await assert.rejects(embedTextsLocal(["First judgment", "Second judgment"], 2), /count mismatch/);
  } finally { globalThis.fetch = original; }
});
