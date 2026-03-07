import test from "node:test";
import assert from "node:assert/strict";
import { buildStyleContext, toStyleRetrievalResult } from "../../server/style-memory/prompt";

test("buildStyleContext returns bounded context with policy header", () => {
  const text = "This is a long legal drafting style example. ".repeat(200);
  const context = buildStyleContext(
    [
      {
        sampleId: 1,
        title: "Sample A",
        sourceType: "upload",
        chunkIndex: 0,
        content: text,
        vectorScore: 0.9,
        keywordScore: 0.7,
        score: 0.84,
      },
    ],
    "balanced",
    300,
  );
  assert.ok(context.includes("STYLE MEMORY POLICY"));
  assert.ok(context.length > 0);
  assert.ok(context.length <= 1300);
});

test("toStyleRetrievalResult marks applied false when no chunks", () => {
  const result = toStyleRetrievalResult({
    chunks: [],
    confidence: 0.2,
    scopeUsed: "user-org",
    strictness: "balanced",
    maxContextTokens: 200,
  });
  assert.equal(result.applied, false);
  assert.equal(result.contextText, "");
  assert.equal(result.chunks.length, 0);
});

