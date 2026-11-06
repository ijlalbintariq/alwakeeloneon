import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
process.env.DATABASE_URL = "postgresql://localhost:5432/dummy_test_db";
process.env.PGHOST = "localhost";
process.env.OPENROUTER_API_KEY = "synthetic-test-key";
process.env.RAG_EMBEDDING_PROVIDER = "voyage";
const { pool } = await import("../../server/db");
const { chunkRepairText, repairSearchScopes, loadRepairSources, repairSourceHash, retrieveRepairedMatches, mergeRepairResults } = await import("../../server/rag/repaired-index");
const { REPAIRED_EMBEDDING_MODEL } = await import("../../server/rag/embedding-local");
const globals = ["global-admin-judgments", "global-admin-case-law", "global-admin-knowledge"];

test("repair chunks retain short paragraphs and the entire tail", () => {
  const words = Array.from({ length: 1217 }, (_, i) => `word${i}`);
  const chunks = chunkRepairText(words.join(" "));
  for (const word of words) assert.ok(chunks.some(chunk => chunk.split(" ").includes(word)));
  assert.equal(chunkRepairText("Leave refused.")[0], "Leave refused.");
  assert.throws(() => chunkRepairText("x".repeat(8001)), /oversized/);
});

test("repair scopes preserve private document restrictions and narrowed global access", () => {
  assert.deepEqual(repairSearchScopes({ userId: "alice", documentIds: [7] }, globals), ["alice"]);
  assert.deepEqual(repairSearchScopes({ userId: "alice", globalUserIds: ["global-admin-judgments", "bob"] }, globals), ["alice", "global-admin-judgments"]);
  assert.deepEqual(repairSearchScopes({ userId: "alice", documentIds: [7], skipUserScope: true }, globals), []);
  assert.deepEqual(repairSearchScopes({ userId: "global-admin-case-law" }, globals), ["global-admin-case-law"]);
});

const doc = { id: 42, title: "Original case source", content: "Original legal findings. ".repeat(40), category: "case-law", object_key: "archive/original.pdf", original_filename: "original.pdf" };
async function sourceFor(row = doc) {
  return [...(await loadRepairSources({ query: async () => ({ rows: [row] }) }, [{ kind: "admin", id: "42" }])).values()][0];
}

test("source fingerprint changes with text, title, file pointer and access scope", async () => {
  const original = repairSourceHash(await sourceFor());
  for (const replacement of [{ content: doc.content + " amended" }, { title: "Another source" }, { object_key: "archive/different.pdf" }, { category: "general" }]) {
    assert.notEqual(repairSourceHash(await sourceFor({ ...doc, ...replacement })), original);
  }
});

test("a reviewed source alias links only to an internally consistent, identical judgment", async () => {
  const id = "00000000-0000-4000-8000-000000000001";
  const title = "Ahmad Khan vs State";
  const body = `Court Name: Supreme Court\nTitle: ${title}\nReported As: 2024 SCMR 1085\nJUDGMENT\n${"Legal findings from the judgment. ".repeat(40)}`;
  let admin = { ...doc, title, content: body };
  const reader = { query: async (sql: string) => ({ rows: sql.includes("FROM judgments") ? [{ id, title, citation_string: "2024 SCMR 1085", full_text: body, court_name_snapshot: "Supreme Court", pdf_url: "https://court.gov.pk/original.pdf", text_status: "own" }] : [admin] }) };
  const references = [{ kind: "admin" as const, id: "42", canonicalJudgmentId: id }];
  const source = [...(await loadRepairSources(reader, references)).values()][0];
  assert.equal(source.metadata.judgmentId, id);
  assert.equal(source.citation, "2024 SCMR 1085");
  admin = { ...admin, content: body + "Changed text." };
  assert.equal((await loadRepairSources(reader, references)).size, 0);
});

test("repaired search uses the alternative model and withholds stale, wrong-model or out-of-scope chunks", async () => {
  const source = await sourceFor();
  const originalQuery = pool.query, originalFetch = globalThis.fetch;
  let live = doc, wrongModel = false, wrongScope = false, calls = 0;
  pool.query = async (sql: string, values: any[]) => {
    if (sql.startsWith("SELECT 1")) {
      assert.equal(values[0], REPAIRED_EMBEDDING_MODEL);
      assert.deepEqual(values[1], ["global-admin-case-law"]);
      return { rows: [{ exists: 1 }] };
    }
    if (sql.includes("WITH eligible")) {
      const row = { id: 1, document_id: 1, model: wrongModel ? "voyage-law-2" : REPAIRED_EMBEDDING_MODEL, user_id: wrongScope ? "bob" : source.userId, source_kind: "admin", source_id: "42", source_document_id: 42, source_hash: repairSourceHash(source), chunk_index: 0, chunk_text: "Original legal findings.", similarity: 0.8 };
      return { rows: [row, { ...row, id: 2 }, { ...row, id: 3, chunk_index: 1, chunk_text: "Further legal findings." }] };
    }
    if (sql.includes("FROM admin_knowledge")) return { rows: [live] };
    throw new Error("Unexpected query");
  };
  globalThis.fetch = async (url, request) => {
    calls++; assert.ok(String(url).startsWith("https://openrouter.ai/"));
    const payload = JSON.parse(String(request?.body));
    assert.equal(payload.model, REPAIRED_EMBEDDING_MODEL);
    assert.equal(payload.dimensions, 1024);
    return new Response(JSON.stringify({ model: "text-embedding-3-small", data: [{ index: 0, embedding: Array(1024).fill(1) }] }));
  };
  const args = { userIds: ["global-admin-case-law"], query: "unique repair model test", topK: 3 };
  try {
    const result = await retrieveRepairedMatches(args);
    assert.equal(result.length, 2, "Duplicate source chunks must not crowd out a distinct excerpt");
    assert.equal(result[0].id, -1);
    assert.equal(result[0].metadata.repairedEmbeddingModel, REPAIRED_EMBEDDING_MODEL);
    assert.equal(result[0].metadata.sourceVerified, false);
    live = { ...doc, content: "Changed legal findings. ".repeat(40) };
    assert.deepEqual(await retrieveRepairedMatches(args), []);
    live = doc; wrongModel = true;
    assert.deepEqual(await retrieveRepairedMatches(args), []);
    wrongModel = false; wrongScope = true;
    assert.deepEqual(await retrieveRepairedMatches(args), []);
    wrongScope = false;
    assert.deepEqual(await retrieveRepairedMatches({ ...args, sourceDocumentIds: [99] }), []);
    assert.equal(calls, 1, "Only the matching model's query vector is cached");
  } finally { pool.query = originalQuery; globalThis.fetch = originalFetch; }
});

const match = (id: number, score: number) => ({ id, ragDocumentId: id, sourceDocumentId: id, title: `case ${id}`, chunkIndex: 0, tokenCount: 1, chunkText: `text ${id}`, metadata: {}, score, vectorScore: score, keywordScore: 0 });
test("rank fusion does not compare incompatible cosine distances", () => {
  assert.deepEqual(mergeRepairResults([match(1, 0.6), match(2, 0.5)], [match(-1, 0.99)], 3).map(row => row.id), [1, -1, 2]);
  assert.deepEqual(mergeRepairResults([match(1, 0.99), match(2, 0.9)], [match(-1, 0.51)], 3).map(row => row.id), [1, -1, 2]);
});

test("legacy embedding failures do not hide repaired-source matches", async () => {
  const source = ts.createSourceFile("rag-service.ts", fs.readFileSync("server/rag/rag-service.ts", "utf8"), ts.ScriptTarget.Latest, true);
  const node = source.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === "retrieveForQuery")!;
  const js = ts.transpileModule(`(${node.getText(source).replace(/^export\s+/, "")})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const deps = { retrieveRepairedMatches: async () => [match(-1, 0.8)], repairSearchScopes, GLOBAL_ADMIN_RAG_USER_IDS: globals, TOP_K: 5, retrieveLegacyForQuery: async () => { throw new Error("Legacy unavailable"); }, mergeRepairResults, resolveConfidence: () => "high" };
  const handler = new Function(...Object.keys(deps), `return ${js}`)(...Object.values(deps));
  assert.equal((await handler({ userId: "alice", query: "Legal findings" })).matches[0].id, -1);
  deps.retrieveLegacyForQuery = () => new Promise(() => {});
  const timers: number[] = [];
  const bounded = new Function(...Object.keys(deps), "setTimeout", `return ${js}`)(...Object.values(deps), (callback: () => void, ms: number) => { timers.push(ms); return setTimeout(callback, Math.min(ms, 10)); });
  assert.equal((await bounded({ userId: "alice", query: "Legal findings" })).matches[0].id, -1);
  assert.ok(timers.includes(6000), "Cold alternative-provider requests need their full budget");
  assert.ok(timers.some(ms => ms > 6000 && ms <= 6500), "A stalled legacy corpus must not consume the pipeline's 8s budget");
});

test("RAG context distinguishes canonical judgment IDs from source-document IDs", async () => {
  const { buildRagContext } = await import("../../server/rag/rag-service");
  const context = buildRagContext([{ ...match(-1, 0.8), sourceDocumentId: 2056330, metadata: { judgmentId: "00000000-0000-4000-8000-000000000001", citationString: "2024 SCMR 1085" } }]);
  assert.match(context, /Judgment ID: 00000000-0000-4000-8000-000000000001/);
  assert.doesNotMatch(context, /Document ID: 2056330/);
  const unconfirmed = buildRagContext([{ ...match(-1, 0.8), metadata: { adminKnowledgeId: 42 } }]);
  assert.match(unconfirmed, /Source document ID: admin:42/);
  assert.match(unconfirmed, /Citations within it may refer to other cases/);
});

test("case-law retrieval keeps repaired excerpts out of the legacy reranker", async () => {
  const source = ts.createSourceFile("retrieval-engine.ts", fs.readFileSync("server/pipeline/retrieval-engine.ts", "utf8"), ts.ScriptTarget.Latest, true);
  const node = source.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === "fetchCaseLaw")!;
  const js = ts.transpileModule(`(${node.getText(source)})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const row = { id: 1, citation: "2024 SCMR 1085", title: "Ahmad Khan vs State", court: "Supreme Court", summary: "Repaired findings", sourceType: "judgment" };
  let providerChecks = 0;
  const deps = {
    storage: { searchJudgmentsByKeywords: async () => [row], searchCaseLaw: async () => [], getCaseLawBySourceDocuments: async () => [] },
    withTimeout: (value: Promise<any>) => value, CASELAW_TIMEOUT_MS: 100,
    retrieveForQuery: async () => ({ matches: [{ ...match(-1, 0.8), metadata: { sourceType: "judgment", judgmentId: "00000000-0000-4000-8000-000000000001", citationString: row.citation, title: row.title, repairedEmbeddingModel: REPAIRED_EMBEDDING_MODEL } }] }),
    normalizeCitationKey: (value: string) => value, hasTrustedCitation: () => true,
    scoreCaseLawRow: () => 80, scoreCaseLawRowForCitationLookup: () => 80,
    vectorHitExcerpt: (value: any) => value.chunkText,
    getCachedQueryEmbedding: async () => null,
    isVoyageProvider: () => { providerChecks++; return false; },
  };
  const handler = new Function(...Object.keys(deps), `return ${js}`)(...Object.values(deps));
  const result = await handler({ normalized: "acquittal", type: "case-law" }, "alice", 1);
  assert.equal(result.length, 1);
  assert.equal(providerChecks, 0, "The legacy reranker must not receive repaired excerpts");
});
