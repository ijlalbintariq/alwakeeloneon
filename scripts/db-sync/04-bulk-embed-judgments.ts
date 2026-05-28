/**
 * OPTIMIZED Bulk Judgment Embedding Script
 * ------------------------------------------
 * Directly embeds judgments into rag_chunks in bulk — bypasses the slow
 * per-judgment indexJudgmentDocument() overhead.
 *
 * Key optimizations:
 * - Fetches judgments in SQL pages (no N+1 queries)
 * - Batches embedding calls (8 texts at once per MiniLM call)
 * - Single INSERT per judgment (not multiple round-trips)
 * - 8 parallel workers
 * - Resumable via progress file
 *
 * Usage:
 *   npx tsx scripts/db-sync/04-bulk-embed-judgments.ts
 */

import "../../server/load-env";
import { Pool } from "pg";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { embedTextsLocal } from "../../server/rag/embedding-local";
import { ensureRagSchema } from "../../server/rag/vector-store";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ─── Config ───────────────────────────────────────────────────────────────────
const CONCURRENCY     = 8;     // parallel embedding workers
const PAGE_SIZE       = 200;   // judgments fetched per SQL page
const EMBED_BATCH     = 8;     // texts per MiniLM embedding call
const PROGRESS_FILE   = path.resolve(__dirname, "embed-progress.json");
const JUDGMENTS_USER  = "global-admin-judgments";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 15,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function sha256(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
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

function saveProgress(done: Set<string>) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify({ done: [...done], savedAt: new Date().toISOString() }), "utf-8");
}

// Build the rich text for a judgment (same as indexJudgmentDocument does)
function buildJudgmentText(row: any): string {
  const parts: string[] = [];
  parts.push(`CITATION: ${row.citation_string}`);
  if (row.court_name) parts.push(`COURT: ${row.court_name}`);
  if (row.title)      parts.push(`TITLE: ${row.title}`);
  if (row.petitioner) parts.push(`PETITIONER: ${row.petitioner}`);
  if (row.respondent) parts.push(`RESPONDENT: ${row.respondent}`);
  if (row.headnotes)  parts.push(`HEADNOTES:\n${row.headnotes}`);
  if (row.full_text)  parts.push(`JUDGMENT:\n${row.full_text.slice(0, 8000)}`); // cap at 8k chars
  return parts.join("\n\n").slice(0, 12000); // MiniLM limit
}

// Compute numeric source_document_id from UUID (same as indexJudgmentDocument)
function uuidToSourceId(uuid: string): number {
  return Math.abs(parseInt(uuid.replace(/-/g, "").slice(0, 8), 16));
}

// Run N tasks concurrently
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
  console.log("║   Alwakeelo — Optimized Bulk Embedding (MiniLM, Free)     ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  // Ensure RAG schema (creates tables if not exist)
  await ensureRagSchema();

  // Load progress
  const done = loadProgress();
  console.log(`📂 Progress file : ${PROGRESS_FILE}`);
  console.log(`✅ Already done  : ${done.size.toLocaleString()} judgments\n`);

  // Also check what's already in rag_documents for judgments user
  const ragDone = await pool.query(`
    SELECT rd.source_document_id
    FROM rag_documents rd
    WHERE rd.user_id = $1 AND rd.status = 'indexed' AND rd.chunk_count > 0
  `, [JUDGMENTS_USER]);
  const ragDoneIds = new Set(ragDone.rows.map((r: any) => String(r.source_document_id)));
  console.log(`🗄️  Already in RAG DB : ${ragDoneIds.size.toLocaleString()} judgments\n`);

  // Count total pending
  const countRes = await pool.query(`
    SELECT COUNT(*) as total FROM judgments
    WHERE is_active = true AND full_text IS NOT NULL AND full_text != ''
  `);
  const total = parseInt(countRes.rows[0].total);
  console.log(`📊 Total active judgments : ${total.toLocaleString()}`);
  console.log(`⏭️  Skipping done          : ${done.size.toLocaleString()}`);
  console.log(`🔄 Pending                : ${(total - done.size).toLocaleString()}\n`);

  let offset      = 0;
  let totalIndexed = 0;
  let totalFailed  = 0;
  const startTime  = Date.now();

  while (true) {
    // Fetch a page of judgments
    const page = await pool.query(`
      SELECT
        j.id,
        j.citation_string,
        j.title,
        j.petitioner,
        j.respondent,
        j.headnotes,
        LEFT(j.full_text, 8000) as full_text,
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

    // Filter out already-done
    const pagePending = page.rows.filter((row: any) => !done.has(row.id));
    if (pagePending.length === 0) continue;

    // Embed in parallel
    await withConcurrency(pagePending, CONCURRENCY, async (row: any) => {
      try {
        const text          = buildJudgmentText(row);
        const contentHash   = sha256(text);
        const sourceDocId   = uuidToSourceId(row.id);
        const title         = `${row.citation_string} — ${row.title || "Judgment"}`;

        // Upsert rag_document
        const ragDocRes = await pool.query(`
          INSERT INTO rag_documents
            (user_id, source_document_id, title, file_name, mime_type, content_hash, status, chunk_count)
          VALUES ($1, $2, $3, NULL, NULL, $4, 'pending', 0)
          ON CONFLICT (user_id, source_document_id) DO UPDATE
            SET content_hash = EXCLUDED.content_hash,
                status = 'pending',
                updated_at = now()
          RETURNING id
        `, [JUDGMENTS_USER, sourceDocId, title.slice(0, 500), contentHash]);

        const ragDocId = ragDocRes.rows[0].id;

        // Delete existing chunks for this document
        await pool.query(`DELETE FROM rag_chunks WHERE rag_document_id = $1`, [ragDocId]);

        // Chunk the text (simple: split into 512-char chunks with overlap)
        const CHUNK_SIZE = 1200; // chars
        const OVERLAP    = 100;
        const chunks: string[] = [];
        for (let i = 0; i < text.length; i += CHUNK_SIZE - OVERLAP) {
          const chunk = text.slice(i, i + CHUNK_SIZE).trim();
          if (chunk.length > 50) chunks.push(chunk);
          if (chunks.length >= 20) break; // max 20 chunks per judgment
        }

        if (chunks.length === 0) {
          done.add(row.id);
          return;
        }

        // Embed all chunks in one batch call
        const embeddings = await embedTextsLocal(chunks);

        // Bulk insert chunks
        const chunkValues: any[] = [];
        const chunkParams: any[] = [];
        let p = 1;
        for (let i = 0; i < chunks.length; i++) {
          const vecLiteral = `[${embeddings[i].map(n => Number.isFinite(n) ? n : 0).join(",")}]`;
          chunkValues.push(`($${p},$${p+1},$${p+2},$${p+3},$${p+4},$${p+5},$${p+6}::vector,$${p+7})`);
          chunkParams.push(
            ragDocId,
            JUDGMENTS_USER,
            sourceDocId,
            i,
            chunks[i].length,
            chunks[i],
            vecLiteral,
            JSON.stringify({
              sourceType: "judgment",
              judgmentId: row.id,
              citationString: row.citation_string,
              court: row.court_name || "",
              title: row.title || "",
            })
          );
          p += 8;
        }

        await pool.query(`
          INSERT INTO rag_chunks
            (rag_document_id, user_id, source_document_id, chunk_index, token_count, chunk_text, embedding, metadata)
          VALUES ${chunkValues.join(",")}
          ON CONFLICT (rag_document_id, chunk_index) DO NOTHING
        `, chunkParams);

        // Mark as indexed
        await pool.query(`
          UPDATE rag_documents
          SET status = 'indexed', chunk_count = $1, updated_at = now()
          WHERE id = $2
        `, [chunks.length, ragDocId]);

        done.add(row.id);
        totalIndexed++;

      } catch (err: any) {
        totalFailed++;
      }
    });

    // Save progress every page
    saveProgress(done);

    // Progress report
    const elapsed  = (Date.now() - startTime) / 1000;
    const rate     = totalIndexed / Math.max(1, elapsed);
    const pending  = total - done.size;
    const etaMin   = pending > 0 ? Math.round(pending / Math.max(0.01, rate) / 60) : 0;

    console.log(
      `  📦 Offset: ${offset.toLocaleString().padStart(7)} | ` +
      `✅ Indexed: ${totalIndexed.toLocaleString().padStart(7)} | ` +
      `❌ Failed: ${totalFailed} | ` +
      `⚡ Rate: ${rate.toFixed(1)}/s | ` +
      `⏱️  ETA: ~${etaMin} min`
    );
  }

  // Final summary
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║  EMBEDDING COMPLETE ✅                                     ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log(`  ✅ Indexed  : ${totalIndexed.toLocaleString()}`);
  console.log(`  ❌ Failed   : ${totalFailed}`);
  console.log(`  📁 Total    : ${done.size.toLocaleString()}`);
  console.log(`  ⏱️  Duration : ${((Date.now() - startTime) / 60000).toFixed(1)} minutes`);

  await pool.end();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
