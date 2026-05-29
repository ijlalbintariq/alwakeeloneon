/**
 * Statute Bulk Embedding Script
 * Embeds all 4,885 statutes into rag_chunks using OpenAI text-embedding-3-small via OpenRouter.
 * Cost: ~$0.03 | Time: ~2 minutes
 */

import "../../server/load-env";
import { Pool } from "pg";
import OpenAI from "openai";
import crypto from "crypto";

const BATCH_SIZE   = 50;   // statutes per API call
const USER_ID      = "global-admin-statute";  // matches GLOBAL_STATUTE_RAG_USER_ID in rag-service.ts
const MODEL        = "openai/text-embedding-3-small";
const DIMENSIONS   = 384;

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });

const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
  defaultHeaders: {
    "HTTP-Referer": "https://alwakeelo.com",
    "X-Title": "AlWakeelo Legal AI",
  },
});

function sha256(text: string) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function buildStatuteText(row: any): string {
  const parts: string[] = [];
  if (row.short_title) parts.push(row.short_title);
  if (row.section)     parts.push(row.section);
  if (row.description) parts.push(row.description);
  if (row.punishment)  parts.push("Punishment: " + row.punishment);
  return parts.join("\n\n").slice(0, 6000);
}

async function embedBatch(texts: string[]): Promise<number[][]> {
  const res = await openai.embeddings.create({
    model: MODEL,
    input: texts,
    dimensions: DIMENSIONS,
  });
  return res.data.sort((a, b) => a.index - b.index).map(d => d.embedding);
}

async function upsertBatch(rows: any[], embeddings: number[][]): Promise<number> {
  if (rows.length === 0) return 0;

  // Step 1: bulk upsert rag_documents
  const docValues: string[] = [];
  const docParams: any[] = [];
  let p = 1;
  const metas = rows.map((row, i) => ({
    sourceId: row.id,
    title: `${row.short_title} — ${row.section}`.slice(0, 500),
    hash: sha256(buildStatuteText(row)),
    embedding: embeddings[i],
    text: buildStatuteText(row),
    row,
  }));

  for (const m of metas) {
    docValues.push(`($${p},$${p+1},$${p+2},NULL,NULL,$${p+3},'pending',0)`);
    docParams.push(USER_ID, m.sourceId, m.title, m.hash);
    p += 4;
  }

  const docRes = await pool.query(`
    INSERT INTO rag_documents (user_id,source_document_id,title,file_name,mime_type,content_hash,status,chunk_count)
    VALUES ${docValues.join(",")}
    ON CONFLICT (user_id, source_document_id)
    DO UPDATE SET content_hash=EXCLUDED.content_hash, status='pending', updated_at=now()
    RETURNING id, source_document_id
  `, docParams);

  const sourceToRagId = new Map<number, number>();
  for (const r of docRes.rows) sourceToRagId.set(Number(r.source_document_id), Number(r.id));

  // Step 2: delete old chunks
  const ragDocIds = [...sourceToRagId.values()];
  await pool.query(`DELETE FROM rag_chunks WHERE rag_document_id = ANY($1::bigint[])`, [ragDocIds]);

  // Step 3: bulk insert chunks
  const chunkValues: string[] = [];
  const chunkParams: any[] = [];
  p = 1;
  for (const m of metas) {
    const ragDocId = sourceToRagId.get(m.sourceId);
    if (!ragDocId) continue;
    const vecLit = `[${m.embedding.map((n: number) => Number.isFinite(n) ? n : 0).join(",")}]`;
    chunkValues.push(`($${p},$${p+1},$${p+2},0,$${p+3},$${p+4},$${p+5}::vector,$${p+6})`);
    chunkParams.push(
      ragDocId, USER_ID, m.sourceId,
      Math.ceil(m.text.length / 4),
      m.text.slice(0, 1500),
      vecLit,
      JSON.stringify({
        sourceType: "statute",
        statuteId: m.row.id,
        shortTitle: m.row.short_title,
        section: m.row.section,
        hasPunishment: !!m.row.punishment,
      })
    );
    p += 7;
  }

  if (chunkValues.length > 0) {
    await pool.query(`
      INSERT INTO rag_chunks (rag_document_id,user_id,source_document_id,chunk_index,token_count,chunk_text,embedding,metadata)
      VALUES ${chunkValues.join(",")}
      ON CONFLICT (rag_document_id,chunk_index) DO NOTHING
    `, chunkParams);
  }

  // Step 4: mark indexed
  await pool.query(
    `UPDATE rag_documents SET status='indexed', chunk_count=1, updated_at=now() WHERE id=ANY($1::bigint[])`,
    [ragDocIds]
  );

  return metas.length;
}

async function main() {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║  Alwakeelo — Statute Embedding           ║");
  console.log("╚══════════════════════════════════════════╝\n");

  if (!process.env.OPENROUTER_API_KEY) {
    console.error("❌ OPENROUTER_API_KEY not set"); process.exit(1);
  }

  // Fetch all statutes
  const { rows: statutes } = await pool.query(
    `SELECT id, short_title, section, description, punishment FROM statutes ORDER BY id`
  );
  console.log(`📚 Total statutes : ${statutes.length}`);
  console.log(`💰 Est. cost      : ~$${(statutes.length * 300 / 1_000_000 * 0.02).toFixed(3)}`);
  console.log(`⏱️  Est. time      : ~${Math.ceil(statutes.length / BATCH_SIZE * 2)} seconds\n`);

  let totalIndexed = 0;
  let totalTokens  = 0;

  for (let i = 0; i < statutes.length; i += BATCH_SIZE) {
    const batch  = statutes.slice(i, i + BATCH_SIZE);
    const texts  = batch.map(buildStatuteText);
    const embeddings = await embedBatch(texts);
    const inserted   = await upsertBatch(batch, embeddings);
    totalIndexed += inserted;
    totalTokens  += texts.reduce((s, t) => s + Math.ceil(t.length / 4), 0);
    const pct = ((i + batch.length) / statutes.length * 100).toFixed(1);
    console.log(`  ✅ ${i + batch.length}/${statutes.length} (${pct}%) | indexed: ${totalIndexed} | tokens: ${totalTokens.toLocaleString()}`);
  }

  const cost = totalTokens / 1_000_000 * 0.02;
  console.log(`\n╔══════════════════════════════════════════╗`);
  console.log(`║  ✅ STATUTE EMBEDDING COMPLETE            ║`);
  console.log(`╚══════════════════════════════════════════╝`);
  console.log(`  Indexed  : ${totalIndexed} / ${statutes.length}`);
  console.log(`  Tokens   : ${totalTokens.toLocaleString()}`);
  console.log(`  Cost     : $${cost.toFixed(4)}`);

  await pool.end();
}

main().catch(e => { console.error("❌", e.message); process.exit(1); });
