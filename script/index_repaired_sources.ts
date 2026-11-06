/** Index only an explicit list of repaired records, separately from legacy vectors. */
import "../server/load-env";
import assert from "node:assert/strict";
import { readFile, writeFile, open, appendFile } from "node:fs/promises";
import { Client } from "pg";
import { chunkRepairText, loadRepairSources, repairSourceHash, type RepairReference } from "../server/rag/repaired-index";
import { embedRepairedTexts, validateEmbeddingBatch, REPAIRED_EMBEDDING_MODEL, REPAIRED_EMBEDDING_DIM } from "../server/rag/embedding-local";

async function main() {
  const args = process.argv.slice(2), apply = args.includes("--apply");
  const option = (name: string) => args[args.indexOf(name) + 1];
  for (const name of ["--sources", "--state", "--backup"]) assert.ok(args.includes(name) && option(name), `${name} is required`);
  const references = JSON.parse(await readFile(option("--sources"), "utf8")) as RepairReference[];
  assert.ok(references.length > 0 && references.length <= 100, "Use only reviewed affected sources");
  assert.equal(new Set(references.map(r => `${r.kind}:${r.id}`)).size, references.length, "Duplicate sources");
  assert.ok(references.every(r => ["judgment", "admin"].includes(r.kind)));
  const configuration = { connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 15000, query_timeout: 35000 };
  let client = new Client(configuration), connected = false;
  await client.connect(); connected = true; let transaction = false;
  try {
    await client.query("BEGIN READ ONLY"); transaction = true;
    const sources = [...(await loadRepairSources(client, references)).values()];
    assert.equal(sources.length, references.length, "A source is unavailable or has an unconfirmed judgment identity");
    await client.query("ROLLBACK"); transaction = false;
    const prepared = sources.map(source => ({ source, hash: repairSourceHash(source), chunks: chunkRepairText(source.text).map(text => `${source.title}\n${text}`) }));
    assert.ok(prepared.every(p => p.chunks.length && p.chunks.every(text => text.length <= 8000)), "Text must not be silently truncated");
    const catalog = await (await fetch("https://openrouter.ai/api/v1/embeddings/models", { signal: AbortSignal.timeout(30000) })).json() as any;
    const pricing = catalog.data?.find((model: any) => model.id === REPAIRED_EMBEDDING_MODEL)?.pricing;
    assert.ok(pricing && Number.isFinite(Number(pricing.prompt)), "Current model price is required");
    const bytes = prepared.reduce((n, p) => n + p.chunks.reduce((sum, text) => sum + Buffer.byteLength(text), 0), 0);
    // UTF-8 bytes are a conservative token bound for these text-only inputs.
    const budgetUpperBound = (bytes + prepared.reduce((n, p) => n + p.chunks.length * 10, 0)) * Number(pricing.prompt);
    assert.ok(budgetUpperBound <= 0.10, "Estimated embedding cost exceeds the approved operation budget");
    const summary = { mode: apply ? "apply" : "preview", model: REPAIRED_EMBEDDING_MODEL, dimensions: REPAIRED_EMBEDDING_DIM, sources: sources.length, chunks: prepared.reduce((n, p) => n + p.chunks.length, 0), inputBytes: bytes, conservativeCostUpperBoundUSD: budgetUpperBound };
    console.log(JSON.stringify(summary)); if (!apply) return;
    await client.end(); connected = false;
    let state: any = { model: REPAIRED_EMBEDDING_MODEL, documents: {}, costUSD: 0, tokens: 0 };
    try { state = JSON.parse(await readFile(option("--state"), "utf8")); assert.equal(state.model, REPAIRED_EMBEDDING_MODEL); } catch (error: any) { if (error.code !== "ENOENT") throw error; }
    try {
      const usage = (await readFile(`${option("--state")}.usage.ndjson`, "utf8")).trim().split("\n").filter(Boolean).map(line => JSON.parse(line));
      state.costUSD = usage.reduce((sum, row) => sum + row.costUSD, 0);
      state.tokens = usage.reduce((sum, row) => sum + row.tokens, 0);
    } catch (error: any) { if (error.code !== "ENOENT") throw error; }
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      const response = await originalFetch(input, init);
      if (String(input).endsWith("/embeddings") && response.ok) {
        const responseBody = await response.clone().json() as any;
        const costUSD = Number(responseBody.usage?.cost || 0), tokens = Number(responseBody.usage?.total_tokens || 0);
        state.costUSD += costUSD; state.tokens += tokens;
        await appendFile(`${option("--state")}.usage.ndjson`, JSON.stringify({ at: new Date().toISOString(), costUSD, tokens }) + "\n", { mode: 0o600 });
      }
      return response;
    };
    try {
      for (const item of prepared) {
        const id = `${item.source.kind}:${item.source.id}`;
        if (state.documents[id]?.hash === item.hash) {
          const cached = state.documents[id].vectors;
          validateEmbeddingBatch(cached.map((embedding: number[], index: number) => ({ embedding, index })), item.chunks.length, REPAIRED_EMBEDDING_DIM);
          continue;
        }
        const vectors: number[][] = [];
        for (let offset = 0; offset < item.chunks.length; offset += 64) vectors.push(...await embedRepairedTexts(item.chunks.slice(offset, offset + 64)));
        state.documents[id] = { hash: item.hash, vectors };
        await writeFile(option("--state"), JSON.stringify(state), { mode: 0o600 });
        console.log(JSON.stringify({ embedded: id, chunks: vectors.length, costUSD: state.costUSD }));
      }
    } finally { globalThis.fetch = originalFetch; }
    client = new Client(configuration); await client.connect(); connected = true;
    await client.query("BEGIN"); transaction = true;
    await client.query("SET LOCAL statement_timeout=30000");
    await client.query("SET LOCAL lock_timeout=5000");
    const judgments = references.filter(r => r.kind === "judgment").map(r => r.id);
    const admin = references.filter(r => r.kind === "admin").map(r => Number(r.id));
    if (judgments.length) await client.query("SELECT id FROM judgments WHERE id=ANY($1::uuid[]) FOR SHARE", [judgments]);
    if (admin.length) {
      await client.query("SELECT id FROM admin_knowledge WHERE id=ANY($1::int[]) FOR SHARE", [admin]);
      await client.query("SELECT id FROM admin_knowledge_files WHERE admin_knowledge_id=ANY($1::int[]) FOR SHARE", [admin]);
    }
    const current = await loadRepairSources(client, references);
    for (const item of prepared) assert.equal(repairSourceHash(current.get(`${item.source.kind}:${item.source.id}`)!), item.hash, "Source changed during embedding");
    await client.query(await readFile(new URL("../migrations/0012_repaired_source_embeddings.sql", import.meta.url), "utf8"));
    const previous = (await client.query("SELECT * FROM rag_repaired_chunks WHERE model=$1 AND ((source_kind='judgment' AND source_id=ANY($2::text[])) OR (source_kind='admin' AND source_id=ANY($3::text[]))) FOR UPDATE", [REPAIRED_EMBEDDING_MODEL, judgments, admin.map(String)])).rows;
    const backup = await open(option("--backup"), "wx", 0o600);
    try { await backup.writeFile(JSON.stringify({ savedAt: new Date().toISOString(), references, previous })); await backup.sync(); } finally { await backup.close(); }
    for (const item of prepared) {
      const source = item.source;
      await client.query("DELETE FROM rag_repaired_chunks WHERE model=$1 AND source_kind=$2 AND source_id=$3", [REPAIRED_EMBEDDING_MODEL, source.kind, source.id]);
      const vectors = state.documents[`${source.kind}:${source.id}`].vectors;
      for (let index = 0; index < item.chunks.length; index++) {
        await client.query(`INSERT INTO rag_repaired_chunks(model,user_id,source_kind,source_id,source_document_id,source_hash,title,metadata,chunk_index,chunk_text,embedding)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11::halfvec)`, [REPAIRED_EMBEDDING_MODEL, source.userId, source.kind, source.id, source.sourceDocumentId, item.hash, source.title, JSON.stringify(source.metadata), index, item.chunks[index], `[${vectors[index].join(",")}]`]);
      }
    }
    await client.query("COMMIT"); transaction = false;
    await writeFile(`${option("--backup")}.result.json`, JSON.stringify({ ...summary, actualEmbeddingCostUSD: state.costUSD, tokens: state.tokens, committedAt: new Date().toISOString() }, null, 2), { flag: "wx", mode: 0o600 });
    console.log(JSON.stringify({ ...summary, actualEmbeddingCostUSD: state.costUSD, tokens: state.tokens }));
  } finally { if (transaction) await client.query("ROLLBACK").catch(() => {}); if (connected) await client.end(); }
}
main().catch(error => { console.error("Repaired indexing failed:", error.code || error.message); process.exitCode = 1; });
