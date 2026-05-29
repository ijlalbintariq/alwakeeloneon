/**
 * OpenAI Bulk Embedding via OpenRouter
 * --------------------------------
 * Embeds all 223,165 judgments using OpenAI text-embedding-3-small via OpenRouter.
 * Cost: ~$3.30 total | Time: ~2-3 hours | Quality: Best available
 *
 * Uses:
 *  - Batches of 100 judgments per API call (fast, parallel-friendly)
 *  - dimensions=384 to match existing VECTOR(384) column in rag_chunks
 *  - Resumable: skips already-embedded judgments
 *  - Writes directly into rag_documents + rag_chunks tables
 *
 * Usage:
 *   npx tsx scripts/db-sync/05-openai-bulk-embed.ts
 */

import "../../server/load-env";
import { Pool } from "pg";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ─── Config ───────────────────────────────────────────────────────────────────
const PAGE_SIZE      = 200;   // judgments fetched from DB per SQL page
const EMBED_BATCH    = 100;   // texts per OpenAI API call (max 2048, keep low for rate limits)
const CONCURRENCY    = 5;     // parallel OpenAI calls at once
const PROGRESS_FILE  = path.resolve(__dirname, "openai-embed-progress.json");
const JUDGMENTS_USER = "global-admin-judgments";
const MODEL          = "openai/text-embedding-3-small";
const DIMENSIONS     = 384;   // matches existing VECTOR(384) column

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 20,
});

// Use OpenRouter as the API gateway (routes to OpenAI embeddings)
const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
  defaultHeaders: {
    "HTTP-Referer": "https://alwakeelo.com",
    "X-Title": "AlWakeelo Legal AI",
  },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function sha256(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function uuidToSourceId(uuid: string): number {
  // Use modulo to keep within PostgreSQL INTEGER range (max 2,147,483,647)
  return Math.abs(parseInt(uuid.replace(/-/g, "").slice(0, 8), 16)) % 2_000_000_000;
}

function buildText(row: any): string {
  const parts: string[] = [];
  parts.push(`CITATION: ${row.citation_string}`);
  if (row.court_name) parts.push(`COURT: ${row.court_name}`);
  if (row.title)      parts.push(`TITLE: ${row.title}`);
  if (row.petitioner) parts.push(`PETITIONER: ${row.petitioner}`);
  if (row.respondent) parts.push(`RESPONDENT: ${row.respondent}`);
  if (row.headnotes)  parts.push(`HEADNOTES:\n${row.headnotes}`);
  // Use first 6000 chars of fulltext (keeps tokens manageable)
  if (row.full_text)  parts.push(`JUDGMENT:\n${row.full_text.slice(0, 6000)}`);
  return parts.join("\n\n").slice(0, 8000);
}

function loadProgress(): Set<string> {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      const data = JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf-8"));
      return new Set(data.done || []);
    }
  } catch {}
  return new Set();
}

function saveProgress(done: Set<string>, stats: any) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify({
    done: [...done],
    savedAt: new Date().toISOString(),
    ...stats,
  }), "utf-8");
}

async function embedBatch(texts: string[]): Promise<number[][]> {
  const response = await openai.embeddings.create({
    model: MODEL,
    input: texts,
    dimensions: DIMENSIONS,
  });
  return response.data
    .sort((a, b) => a.index - b.index)
    .map(item => item.embedding);
}

async function upsertJudgmentEmbeddingsBatch(rows: any[], embeddings: number[][]): Promise<number> {
  if (rows.length === 0) return 0;

  // Step 1: Bulk upsert all rag_documents in ONE query
  const docValues: string[] = [];
  const docParams: any[]   = [];
  let p = 1;
  const metas = rows.map((row, i) => ({
    sourceId : uuidToSourceId(row.id),
    title    : `${row.citation_string} — ${row.title || "Judgment"}`.slice(0, 500),
    hash     : sha256(buildText(row)),
    embedding: embeddings[i],
    text     : buildText(row),
    row,
  }));

  for (const m of metas) {
    docValues.push(`($${p},$${p+1},$${p+2},NULL,NULL,$${p+3},'pending',0)`);
    docParams.push(JUDGMENTS_USER, m.sourceId, m.title, m.hash);
    p += 4;
  }

  const docRes = await pool.query(`
    INSERT INTO rag_documents (user_id,source_document_id,title,file_name,mime_type,content_hash,status,chunk_count)
    VALUES ${docValues.join(",")}
    ON CONFLICT (user_id, source_document_id)
    DO UPDATE SET content_hash=EXCLUDED.content_hash, status='pending', updated_at=now()
    RETURNING id, source_document_id
  `, docParams);

  // Build map: sourceId → ragDocId
  const sourceToRagId = new Map<number, number>();
  for (const r of docRes.rows) sourceToRagId.set(Number(r.source_document_id), Number(r.id));

  // Step 2: Delete old chunks for all these docs in ONE query
  const ragDocIds = [...sourceToRagId.values()];
  await pool.query(
    `DELETE FROM rag_chunks WHERE rag_document_id = ANY($1::bigint[])`,
    [ragDocIds]
  );

  // Step 3: Bulk insert all chunks in ONE query
  const chunkValues: string[] = [];
  const chunkParams: any[]    = [];
  p = 1;
  for (const m of metas) {
    const ragDocId = sourceToRagId.get(m.sourceId);
    if (!ragDocId) continue;
    const vecLit = `[${m.embedding.map((n: number) => Number.isFinite(n) ? n : 0).join(",")}]`;
    chunkValues.push(`($${p},$${p+1},$${p+2},0,$${p+3},$${p+4},$${p+5}::vector,$${p+6})`);
    chunkParams.push(
      ragDocId, JUDGMENTS_USER, m.sourceId,
      Math.ceil(m.text.length / 4),
      m.text.slice(0, 1500),
      vecLit,
      JSON.stringify({ sourceType:"judgment", judgmentId:m.row.id, citationString:m.row.citation_string, court:m.row.court_name||"", title:m.row.title||""})
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

  // Step 4: Bulk mark all indexed in ONE query
  await pool.query(
    `UPDATE rag_documents SET status='indexed', chunk_count=1, updated_at=now() WHERE id=ANY($1::bigint[])`,
    [ragDocIds]
  );

  return metas.length;
}

// Run N tasks with limited concurrency
async function withConcurrency<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const item = items[idx++];
      await fn(item);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║   Alwakeelo — OpenAI Bulk Embedding (text-embedding-3-small)║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  // Validate OpenRouter key
  if (!process.env.OPENROUTER_API_KEY) {
    console.error("❌ OPENROUTER_API_KEY is not set in .env");
    process.exit(1);
  }
  console.log("✅ OpenRouter API key detected");
  console.log(`   Model  : ${MODEL}`);
  console.log(`   Gateway: OpenRouter → OpenAI\n`);

  // Test key with a tiny call
  console.log("🔑 Validating OpenAI key...");
  const testEmbed = await openai.embeddings.create({
    model: MODEL,
    input: ["test"],
    dimensions: DIMENSIONS,
  });
  console.log(`✅ Key valid. Dimensions: ${testEmbed.data[0].embedding.length}\n`);

  // Load progress
  const done = loadProgress();
  console.log(`📂 Progress file: ${PROGRESS_FILE}`);
  console.log(`✅ Already done : ${done.size.toLocaleString()}\n`);

  // Count total
  const countRes = await pool.query(`
    SELECT COUNT(*) as total FROM judgments
    WHERE is_active = true AND full_text IS NOT NULL AND full_text != ''
  `);
  const total = parseInt(countRes.rows[0].total);
  console.log(`📊 Total judgments : ${total.toLocaleString()}`);
  console.log(`⏭️  Skipping done   : ${done.size.toLocaleString()}`);
  console.log(`🔄 To embed        : ${(total - done.size).toLocaleString()}`);

  // Estimate cost
  const estTokens = (total - done.size) * 700; // ~700 tokens avg per judgment
  const estCost   = (estTokens / 1_000_000) * 0.02;
  console.log(`💰 Est. cost       : ~$${estCost.toFixed(2)} (text-embedding-3-small @ $0.02/1M tokens)\n`);

  const startTime  = Date.now();
  let totalIndexed = 0;
  let totalFailed  = 0;
  let totalTokens  = 0;
  let offset       = 0;

  while (true) {
    // Fetch page of judgments
    const page = await pool.query(`
      SELECT
        j.id,
        j.citation_string,
        j.title,
        j.petitioner,
        j.respondent,
        j.headnotes,
        LEFT(j.full_text, 6000) as full_text,
        c.name as court_name
      FROM judgments j
      LEFT JOIN courts_ref c ON c.id = j.court_id
      WHERE j.is_active = true
        AND j.full_text IS NOT NULL
        AND j.full_text != ''
      ORDER BY j.year DESC, j.id
      LIMIT $1 OFFSET $2
    `, [PAGE_SIZE, offset]);

    if (page.rows.length === 0) break;
    offset += page.rows.length;

    // Filter already done
    const pending = page.rows.filter((row: any) => !done.has(row.id));
    if (pending.length === 0) continue;

    // Process in EMBED_BATCH chunks with CONCURRENCY parallel calls
    const subBatches: any[][] = [];
    for (let i = 0; i < pending.length; i += EMBED_BATCH) {
      subBatches.push(pending.slice(i, i + EMBED_BATCH));
    }

    await withConcurrency(subBatches, CONCURRENCY, async (batch: any[]) => {
      try {
        const texts      = batch.map(buildText);
        const embeddings = await embedBatch(texts);
        const inserted   = await upsertJudgmentEmbeddingsBatch(batch, embeddings);

        totalIndexed += inserted;
        totalTokens  += texts.reduce((s, t) => s + Math.ceil(t.length / 4), 0);

        for (const row of batch) done.add(row.id);
      } catch (err: any) {
        console.error(`  ⚠️  Batch error: ${err.message}`);
        totalFailed += batch.length;
      }
    });

    // Save progress
    const elapsed = (Date.now() - startTime) / 1000;
    const rate    = totalIndexed / Math.max(1, elapsed);
    const remaining = total - done.size;
    const etaMin  = remaining / Math.max(0.01, rate) / 60;
    const cost    = (totalTokens / 1_000_000) * 0.02;

    saveProgress(done, { totalIndexed, totalFailed, totalTokens, costSoFar: cost });

    console.log(
      `  📦 Offset: ${offset.toLocaleString().padStart(7)} | ` +
      `✅ ${totalIndexed.toLocaleString()} | ` +
      `❌ ${totalFailed} | ` +
      `⚡ ${rate.toFixed(1)}/s | ` +
      `💰 $${cost.toFixed(3)} | ` +
      `⏱️ ETA: ~${etaMin.toFixed(0)} min`
    );
  }

  const totalCost = (totalTokens / 1_000_000) * 0.02;
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║  EMBEDDING COMPLETE ✅                                     ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log(`  ✅ Indexed   : ${totalIndexed.toLocaleString()}`);
  console.log(`  ❌ Failed    : ${totalFailed}`);
  console.log(`  💰 Total cost: $${totalCost.toFixed(3)}`);
  console.log(`  ⏱️  Duration  : ${((Date.now() - startTime) / 60000).toFixed(1)} min`);

  await pool.end();
}

main().catch(err => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
