/**
 * index-missing-judgments-voyage.ts
 *
 * Ultra-Responsive, Credit-Safe Voyage-law-2 Incremental Indexer:
 * - Batches multi-row chunk inserts into single network round-trips.
 * - 5 concurrent workers with jittered startup.
 * - Logs progress on EVERY SINGLE completed batch in real-time.
 * - Automatic retry with exponential backoff on Voyage 429/5xx.
 * - Zero tokens wasted: skips any already-indexed documents.
 *
 * Usage:
 *   npx tsx scripts/index-missing-judgments-voyage.ts --live
 */

import "../server/load-env";
import { Pool } from "pg";
import * as fs from "fs";
import crypto from "crypto";

const LIVE = process.argv.includes("--live");
const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY || "";
const VOYAGE_MODEL = "voyage-law-2";
const VOYAGE_BASE_URL = "https://api.voyageai.com/v1/embeddings";
const EMBEDDING_DIM = 1024;
const GLOBAL_JUDGMENTS_USER_ID = "global-admin-judgments";
const JSON_PATH = "/tmp/missing_judgments_to_upload.json";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 30,
  connectionTimeoutMillis: 45000,
  idleTimeoutMillis: 30000,
});

function sha256(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function normalizeVector(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((sum, val) => sum + val * val, 0));
  if (!Number.isFinite(norm) || norm === 0) return v;
  return v.map((x) => x / norm);
}

function fitToDimension(input: number[], dim: number): number[] {
  if (input.length === dim) return normalizeVector(input);
  if (input.length > dim) return normalizeVector(input.slice(0, dim));
  const resized = input.slice();
  while (resized.length < dim) resized.push(0);
  return normalizeVector(resized);
}

// Resilient Voyage Embedding with Exponential Backoff Retry
async function embedBatchVoyageWithRetry(texts: string[], maxRetries = 5): Promise<number[][]> {
  if (!VOYAGE_API_KEY) throw new Error("VOYAGE_API_KEY not set");
  if (texts.length === 0) return [];

  let attempt = 0;
  while (attempt < maxRetries) {
    attempt++;
    try {
      const resp = await fetch(VOYAGE_BASE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${VOYAGE_API_KEY}`,
        },
        body: JSON.stringify({
          model: VOYAGE_MODEL,
          input: texts.map((t) => t.slice(0, 30000)),
          input_type: "document",
        }),
      });

      if (resp.status === 429 || resp.status >= 500) {
        const delay = Math.pow(2, attempt) * 1000 + Math.random() * 500;
        console.warn(`[Voyage RateLimit/5xx] Attempt ${attempt}/${maxRetries}. Retrying in ${(delay / 1000).toFixed(1)}s...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`Voyage API error ${resp.status}: ${err.slice(0, 300)}`);
      }

      const json = (await resp.json()) as any;
      const items = json?.data as Array<{ index: number; embedding: number[] }>;
      return items
        .sort((a, b) => a.index - b.index)
        .map((item) => fitToDimension(item.embedding, EMBEDDING_DIM));
    } catch (err: any) {
      if (attempt >= maxRetries) throw err;
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error("Failed to embed batch after multiple retries");
}

function chunkJudgment(fullText: string, title: string, citation: string): string[] {
  const chunks: string[] = [];
  const header = `[Judgment: ${citation}] ${title}\n\n`;
  const clean = (fullText || "").trim();

  if (clean.length <= 2500) {
    chunks.push(header + clean);
    return chunks;
  }

  let start = 0;
  while (start < clean.length) {
    const end = Math.min(start + 2000, clean.length);
    const chunkText = header + clean.slice(start, end);
    chunks.push(chunkText);
    if (end === clean.length) break;
    start += 1700;
  }
  return chunks.slice(0, 15); // max 15 chunks per judgment
}

async function main() {
  console.log(`\n=============================================================`);
  console.log(`⚡ ULTRA-FAST VOYAGE-LAW-2 INCREMENTAL INDEXER: ${LIVE ? "🔴 LIVE MODE" : "🟢 DRY RUN"}`);
  console.log(`=============================================================\n`);

  if (!fs.existsSync(JSON_PATH)) {
    console.error(`❌ Payload file not found at ${JSON_PATH}.`);
    process.exit(1);
  }

  console.log("📂 [1/3] Reading new judgments payload...");
  const newJudgments: any[] = JSON.parse(fs.readFileSync(JSON_PATH, "utf-8"));
  console.log(`   Loaded ${newJudgments.length} judgments from payload.\n`);

  console.log("🔍 [2/3] Checking already-indexed judgments in rag_documents...");
  const indexedRes = await pool.query(`
    SELECT source_document_id 
    FROM rag_documents 
    WHERE user_id = $1 AND status = 'indexed' AND chunk_count > 0
  `, [GLOBAL_JUDGMENTS_USER_ID]);

  const indexedSet = new Set<number>(indexedRes.rows.map((r: any) => Number(r.source_document_id)));
  console.log(`   Found ${indexedSet.size} already-indexed judgments in DB (will be skipped).\n`);

  console.log("🔗 Resolving DB UUIDs for new judgments...");
  const citations = newJudgments.map(j => j.citationString);
  const dbRowsRes = await pool.query(`
    SELECT id, citation_string 
    FROM judgments 
    WHERE citation_string = ANY($1::text[])
  `, [citations]);

  const uuidMap = new Map(dbRowsRes.rows.map(r => [r.citation_string, r.id]));

  const pendingToEmbed: any[] = [];
  for (const j of newJudgments) {
    const dbId = uuidMap.get(j.citationString);
    if (!dbId) continue;
    const sourceDocId = Math.abs(parseInt(String(dbId).replace(/-/g, "").slice(0, 8), 16));
    if (!indexedSet.has(sourceDocId)) {
      pendingToEmbed.push({
        ...j,
        dbId,
        sourceDocId,
      });
    }
  }

  console.log(`   📊 Total Judgments to Embed: ${pendingToEmbed.length}\n`);

  if (pendingToEmbed.length === 0) {
    console.log("✅ All new judgments are already fully indexed!");
    await pool.end();
    return;
  }

  if (!LIVE) {
    console.log("ℹ️  DRY RUN complete. Run with --live to start indexing.");
    await pool.end();
    return;
  }

  console.log(`🚀 [3/3] Streaming Voyage-law-2 embeddings for ${pendingToEmbed.length} judgments...`);
  const DOCS_PER_BATCH = 8;
  const CONCURRENCY = 5;
  let processedDocs = 0;
  let totalChunksInserted = 0;
  let totalErrors = 0;
  const startTime = Date.now();

  const batches: any[][] = [];
  for (let i = 0; i < pendingToEmbed.length; i += DOCS_PER_BATCH) {
    batches.push(pendingToEmbed.slice(i, i + DOCS_PER_BATCH));
  }

  // Helper to process one batch
  async function processOneBatch(batch: any[]) {
    try {
      const prepared: Array<{ doc: any; chunks: string[]; contentHash: string; chunkOffset: number }> = [];
      const allTexts: string[] = [];

      for (const doc of batch) {
        const chunks = chunkJudgment(doc.fullText || "", doc.title, doc.citationString);
        if (chunks.length === 0) continue;
        prepared.push({
          doc,
          chunks,
          contentHash: sha256(doc.fullText || doc.title),
          chunkOffset: allTexts.length,
        });
        allTexts.push(...chunks);
      }

      if (allTexts.length === 0) return;

      // Embed all chunks via Voyage API
      const embeddings = await embedBatchVoyageWithRetry(allTexts);

      // Save each doc and its chunks
      for (const p of prepared) {
        try {
          const ragDocRes = await pool.query(`
            INSERT INTO rag_documents (
              user_id, source_document_id, title, file_name, mime_type, content_hash, status, chunk_count, updated_at
            ) VALUES (
              $1, $2, $3, $4, 'text/plain', $5, 'indexed', $6, NOW()
            )
            ON CONFLICT (user_id, source_document_id) DO UPDATE SET
              status = 'indexed', chunk_count = $6, updated_at = NOW()
            RETURNING id
          `, [
            GLOBAL_JUDGMENTS_USER_ID,
            p.doc.sourceDocId,
            p.doc.citationString + ": " + p.doc.title.slice(0, 100),
            p.doc.citationString,
            p.contentHash,
            p.chunks.length,
          ]);

          const ragDocId = ragDocRes.rows[0].id;

          const values: any[] = [];
          const placeholders: string[] = [];
          let paramIdx = 1;

          for (let cIdx = 0; cIdx < p.chunks.length; cIdx++) {
            const chunkText = p.chunks[cIdx];
            const emb = embeddings[p.chunkOffset + cIdx];
            const embStr = `[${emb.join(",")}]`;

            placeholders.push(`($${paramIdx}, $${paramIdx+1}, $${paramIdx+2}, $${paramIdx+3}, $${paramIdx+4}, $${paramIdx+5}, $${paramIdx+6}::vector, $${paramIdx+7})`);
            values.push(
              ragDocId,
              GLOBAL_JUDGMENTS_USER_ID,
              p.doc.sourceDocId,
              cIdx,
              chunkText,
              Math.ceil(chunkText.length / 4),
              embStr,
              JSON.stringify({
                judgmentId: p.doc.dbId,
                citationString: p.doc.citationString,
                title: p.doc.title,
                court: p.doc.courtNameSnapshot,
                sourceType: "judgment",
              })
            );
            paramIdx += 8;
          }

          if (placeholders.length > 0) {
            await pool.query(`
              INSERT INTO rag_chunks (
                rag_document_id, user_id, source_document_id, chunk_index,
                chunk_text, token_count, embedding, metadata
              ) VALUES ${placeholders.join(", ")}
              ON CONFLICT (rag_document_id, chunk_index) DO UPDATE SET
                chunk_text = EXCLUDED.chunk_text,
                token_count = EXCLUDED.token_count,
                embedding = EXCLUDED.embedding,
                metadata = EXCLUDED.metadata
            `, values);
          }

          processedDocs++;
          totalChunksInserted += p.chunks.length;
        } catch (err: any) {
          totalErrors++;
          console.warn(`[Insert Error] ${p.doc.citationString}: ${err.message}`);
        }
      }
    } catch (batchErr: any) {
      totalErrors++;
      console.error(`[Batch Error]:`, batchErr.message);
    }
  }

  // Worker queue pattern for continuous throughput
  let nextBatchIdx = 0;
  async function worker() {
    while (nextBatchIdx < batches.length) {
      const bIdx = nextBatchIdx++;
      await processOneBatch(batches[bIdx]);

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const pct = ((processedDocs / pendingToEmbed.length) * 100).toFixed(1);
      const speed = (processedDocs / (parseFloat(elapsed) || 1)).toFixed(1);
      const remainingDocs = Math.max(0, pendingToEmbed.length - processedDocs);
      const etaSec = parseFloat(speed) > 0 ? (remainingDocs / parseFloat(speed)).toFixed(0) : "calc";
      const etaMin = (parseFloat(etaSec) / 60).toFixed(1);

      console.log(
        `   📊 [${pct.padStart(5)}%] ${processedDocs.toString().padStart(5)}/${pendingToEmbed.length} judgments | chunks: ${totalChunksInserted} | errors: ${totalErrors} | speed: ${speed} docs/s | ETA: ${etaMin}m`
      );
    }
  }

  // Launch parallel workers
  const workerPromises = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workerPromises);

  console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
  console.log(`║  🎉 VOYAGE LAW 2 INCREMENTAL INDEXING COMPLETE                 ║`);
  console.log(`╚════════════════════════════════════════════════════════════════╝`);
  console.log(`  📖 Processed Judgments:   ${processedDocs}`);
  console.log(`  🧩 Total Chunks Indexed:  ${totalChunksInserted}`);
  console.log(`  ❌ Errors:                ${totalErrors}`);

  await pool.end();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
