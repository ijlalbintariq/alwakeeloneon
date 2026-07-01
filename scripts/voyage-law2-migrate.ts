/**
 * voyage-law2-migrate.ts
 *
 * Shadow migration script: indexes ALL statute documents and judgments
 * into NEW v2 tables (rag_documents_v2, rag_chunks_v2) using Voyage-law-2
 * at 1024 dimensions. Production tables remain untouched.
 *
 * Usage:
 *   npx tsx scripts/voyage-law2-migrate.ts                    # dry-run (creates tables, shows counts)
 *   npx tsx scripts/voyage-law2-migrate.ts --index-statutes   # index statute_documents only
 *   npx tsx scripts/voyage-law2-migrate.ts --index-judgments   # index judgments only
 *   npx tsx scripts/voyage-law2-migrate.ts --index-all         # index everything
 *   npx tsx scripts/voyage-law2-migrate.ts --swap              # swap v2 tables into production
 *   npx tsx scripts/voyage-law2-migrate.ts --status            # show progress
 */

import "../server/load-env";
import { Pool } from "pg";
import { chunkTextByTokens } from "../server/rag/chunker";
import { cleanLegalDocumentText } from "../server/rag/text-cleaner";
import crypto from "crypto";

// ─── Configuration ───────────────────────────────────────────────────────────

const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY || "";
const VOYAGE_MODEL = "voyage-law-2";
const VOYAGE_BASE_URL = "https://api.voyageai.com/v1/embeddings";
const EMBEDDING_DIM = 1024;
const MAX_CHUNKS_PER_DOC = 600;
const BATCH_EMBED_SIZE = 80; // Voyage max 120K tokens/batch — 80 texts keeps worst-case under limit
const DELAY_BETWEEN_BATCHES_MS = 0; // No delay needed — concurrency is controlled explicitly
const VOYAGE_EMBED_CONCURRENCY = 10; // Run 10 Voyage API calls in parallel (safe within 4000 RPM / 6M TPM limits)

const GLOBAL_STATUTE_RAG_USER_ID = "global-admin-statute";
const GLOBAL_JUDGMENTS_RAG_USER_ID = "global-admin-judgments";

// ─── Database ────────────────────────────────────────────────────────────────

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 45,
  connectionTimeoutMillis: 30000,
  idleTimeoutMillis: 30000, // Close idle connections faster to avoid stale sockets
  allowExitOnIdle: false,
  keepAlive: true, // Prevent Neon from dropping idle connections
  keepAliveInitialDelayMillis: 10000, // Send keepalive probe after 10s idle
});

// Handle pool-level errors to prevent unhandled crashes
pool.on("error", (err) => {
  console.error("⚠️ Pool connection error (non-fatal, will reconnect):", err.message);
});

// ─── Voyage Embedding API ────────────────────────────────────────────────────

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

async function embedTextsVoyage(
  texts: string[],
  inputType: "document" | "query" = "document"
): Promise<number[][]> {
  if (!VOYAGE_API_KEY) throw new Error("VOYAGE_API_KEY not set");
  if (texts.length === 0) return [];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000); // 120s timeout for large parallel batches

  try {
    const resp = await fetch(VOYAGE_BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${VOYAGE_API_KEY}`,
      },
      body: JSON.stringify({
        model: VOYAGE_MODEL,
        input: texts.map((t) => t.slice(0, 32000)), // voyage-law-2 supports 16K tokens
        input_type: inputType,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Voyage API error ${resp.status}: ${err.slice(0, 500)}`);
    }

    const json = (await resp.json()) as any;
    const items = json?.data as Array<{ index: number; embedding: number[] }>;
    if (!items || items.length === 0) {
      throw new Error("Voyage API returned no embeddings");
    }

    return items
      .sort((a, b) => a.index - b.index)
      .map((item) => fitToDimension(item.embedding, EMBEDDING_DIM));
  } catch (err: any) {
    clearTimeout(timeoutId);
    throw err;
  }
}

// ─── Shadow Table Management ─────────────────────────────────────────────────

async function createV2Tables(skipSecondaryChunksIndexes = false): Promise<void> {
  await pool.query("CREATE EXTENSION IF NOT EXISTS vector");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS rag_documents_v2 (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      org_id INTEGER NULL,
      source_document_id BIGINT NOT NULL,
      title TEXT NOT NULL,
      file_name TEXT NULL,
      mime_type TEXT NULL,
      content_hash TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      chunk_count BIGINT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (user_id, source_document_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS rag_chunks_v2 (
      id BIGSERIAL PRIMARY KEY,
      rag_document_id BIGINT NOT NULL REFERENCES rag_documents_v2(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      source_document_id BIGINT NOT NULL,
      chunk_index INTEGER NOT NULL,
      token_count INTEGER NOT NULL,
      chunk_text TEXT NOT NULL,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      embedding VECTOR(${EMBEDDING_DIM}) NULL,
      parent_chunk_id BIGINT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (rag_document_id, chunk_index)
    )
  `);

  // Indexes
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_rag_documents_v2_user_source ON rag_documents_v2 (user_id, source_document_id)"
  );

  if (!skipSecondaryChunksIndexes) {
    await pool.query(
      "CREATE INDEX IF NOT EXISTS idx_rag_chunks_v2_user_doc ON rag_chunks_v2 (user_id, source_document_id)"
    );
    await pool.query(
      "CREATE INDEX IF NOT EXISTS idx_rag_chunks_v2_tsv ON rag_chunks_v2 USING gin (to_tsvector('simple', chunk_text))"
    );
    await pool.query(
      "CREATE INDEX IF NOT EXISTS idx_rag_chunks_v2_parent ON rag_chunks_v2 (parent_chunk_id)"
    );
  }

  console.log("✅ Shadow tables rag_documents_v2 & rag_chunks_v2 created");
}

// ─── Upsert Document + Chunks ────────────────────────────────────────────────

async function upsertIndexedRagDocV2(args: {
  userId: string;
  sourceDocumentId: number;
  title: string;
  fileName: string | null;
  mimeType: string | null;
  contentHash: string;
  chunkCount: number;
}): Promise<number> {
  const result = await pool.query(
    `INSERT INTO rag_documents_v2 (user_id, source_document_id, title, file_name, mime_type, content_hash, status, chunk_count)
     VALUES ($1, $2, $3, $4, $5, $6, 'indexed', $7)
     ON CONFLICT (user_id, source_document_id) DO UPDATE SET
       title = EXCLUDED.title,
       content_hash = EXCLUDED.content_hash,
       status = 'indexed',
       chunk_count = EXCLUDED.chunk_count,
       updated_at = now()
     RETURNING id`,
    [args.userId, args.sourceDocumentId, args.title, args.fileName, args.mimeType, args.contentHash, args.chunkCount]
  );
  return Number(result.rows[0].id);
}

function vectorLiteral(values: number[]): string {
  const safe = values.map((n) => (Number.isFinite(n) ? n : 0));
  return `[${safe.join(",")}]`;
}

async function bulkInsertParents(
  ragDocId: number,
  userId: string,
  sourceDocumentId: number,
  parents: Array<{
    chunkIndex: number;
    text: string;
    tokenCount: number;
    metadata: Record<string, unknown>;
  }>
): Promise<Map<number, number>> {
  const parentIdMap = new Map<number, number>();
  if (parents.length === 0) return parentIdMap;

  // Insert parents in batches of 50
  const BULK_SIZE = 50;
  for (let i = 0; i < parents.length; i += BULK_SIZE) {
    const batch = parents.slice(i, i + BULK_SIZE);
    const values: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    for (const chunk of batch) {
      values.push(
        `($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, $${paramIdx + 3}, $${paramIdx + 4}, $${paramIdx + 5}, $${paramIdx + 6}, NULL)`
      );
      params.push(
        ragDocId,
        userId,
        sourceDocumentId,
        chunk.chunkIndex,
        chunk.tokenCount,
        chunk.text,
        JSON.stringify(chunk.metadata)
      );
      paramIdx += 7;
    }

    try {
      const result = await pool.query(
        `INSERT INTO rag_chunks_v2
         (rag_document_id, user_id, source_document_id, chunk_index, token_count, chunk_text, metadata, embedding)
         VALUES ${values.join(", ")}
         ON CONFLICT (rag_document_id, chunk_index) DO UPDATE SET
           chunk_text = EXCLUDED.chunk_text,
           metadata = EXCLUDED.metadata
         RETURNING id, chunk_index`,
        params
      );
      for (const row of result.rows) {
        parentIdMap.set(Number(row.chunk_index), Number(row.id));
      }
    } catch (err: any) {
      console.error(`    ❌ Bulk parent insert failed: ${err?.message?.slice(0, 300)}`);
      // Fallback: insert one by one
      for (const chunk of batch) {
        try {
          const res = await pool.query(
            `INSERT INTO rag_chunks_v2
             (rag_document_id, user_id, source_document_id, chunk_index, token_count, chunk_text, metadata, embedding)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NULL)
             ON CONFLICT (rag_document_id, chunk_index) DO UPDATE SET
               chunk_text = EXCLUDED.chunk_text,
               metadata = EXCLUDED.metadata
             RETURNING id`,
            [ragDocId, userId, sourceDocumentId, chunk.chunkIndex, chunk.tokenCount, chunk.text, JSON.stringify(chunk.metadata)]
          );
          if (res.rows[0]) {
            parentIdMap.set(chunk.chunkIndex, Number(res.rows[0].id));
          }
        } catch { /* skip */ }
      }
    }
  }

  return parentIdMap;
}

async function bulkInsertChildren(
  ragDocId: number,
  userId: string,
  sourceDocumentId: number,
  chunks: Array<{
    chunkIndex: number;
    text: string;
    tokenCount: number;
    embedding: number[];
    metadata: Record<string, unknown>;
    parentChunkId: number | null;
  }>
): Promise<number> {
  if (chunks.length === 0) return 0;

  const BULK_SIZE = 50;
  let totalInserted = 0;

  for (let i = 0; i < chunks.length; i += BULK_SIZE) {
    const batch = chunks.slice(i, i + BULK_SIZE);
    const values: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    for (const chunk of batch) {
      const vecStr = vectorLiteral(chunk.embedding);
      values.push(
        `($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, $${paramIdx + 3}, $${paramIdx + 4}, $${paramIdx + 5}, $${paramIdx + 6}, $${paramIdx + 7}::vector, $${paramIdx + 8})`
      );
      params.push(
        ragDocId,
        userId,
        sourceDocumentId,
        chunk.chunkIndex,
        chunk.tokenCount,
        chunk.text,
        JSON.stringify(chunk.metadata),
        vecStr,
        chunk.parentChunkId
      );
      paramIdx += 9;
    }

    try {
      const result = await pool.query(
        `INSERT INTO rag_chunks_v2
         (rag_document_id, user_id, source_document_id, chunk_index, token_count, chunk_text, metadata, embedding, parent_chunk_id)
         VALUES ${values.join(", ")}
         ON CONFLICT (rag_document_id, chunk_index) DO NOTHING`,
        params
      );
      totalInserted += result.rowCount || batch.length;
    } catch (err: any) {
      console.error(`    ❌ Bulk child insert failed: ${err?.message?.slice(0, 300)}`);
      // Fallback
      for (const chunk of batch) {
        try {
          await pool.query(
            `INSERT INTO rag_chunks_v2
             (rag_document_id, user_id, source_document_id, chunk_index, token_count, chunk_text, metadata, embedding, parent_chunk_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8::vector, $9)
             ON CONFLICT (rag_document_id, chunk_index) DO NOTHING`,
            [
              ragDocId,
              userId,
              sourceDocumentId,
              chunk.chunkIndex,
              chunk.tokenCount,
              chunk.text,
              JSON.stringify(chunk.metadata),
              vectorLiteral(chunk.embedding),
              chunk.parentChunkId,
            ]
          );
          totalInserted++;
        } catch { /* skip */ }
      }
    }
  }

  return totalInserted;
}



// ─── Index a Single Document ─────────────────────────────────────────────────

async function indexDocument(args: {
  userId: string;
  sourceDocumentId: number;
  title: string;
  fileName: string | null;
  content: string;
  metadata: Record<string, unknown>;
}): Promise<{ chunks: number }> {
  const cleaned = cleanLegalDocumentText(args.content);
  if (!cleaned) return { chunks: 0 };

  const allChunks = chunkTextByTokens(cleaned).slice(0, MAX_CHUNKS_PER_DOC);
  if (allChunks.length === 0) return { chunks: 0 };

  const contentHash = sha256(cleaned);
  const ragDocId = await upsertIndexedRagDocV2({
    userId: args.userId,
    sourceDocumentId: args.sourceDocumentId,
    title: args.title,
    fileName: args.fileName,
    mimeType: null,
    contentHash,
    chunkCount: allChunks.length,
  });

  // Delete existing chunks for this doc (in case of re-run)
  await pool.query("DELETE FROM rag_chunks_v2 WHERE rag_document_id = $1", [ragDocId]);

  // Separate parent and child chunks
  const parentChunks = allChunks.filter((c) => c.isParent);
  const childChunks = allChunks.filter((c) => !c.isParent);

  // 1. Prepare parent chunks
  const parentRows = parentChunks.map((p) => ({
    chunkIndex: p.chunkIndex,
    text: p.text,
    tokenCount: p.tokenCount,
    metadata: { ...args.metadata, isParent: true },
  }));

  // Bulk insert parent chunks and get mapped IDs
  const parentIdMap = await bulkInsertParents(ragDocId, args.userId, args.sourceDocumentId, parentRows);

  // 2. Embed child chunks in batches via Voyage API
  const childTexts = childChunks.map((c) => c.text);
  let embeddings: number[][] = [];

  for (let i = 0; i < childTexts.length; i += BATCH_EMBED_SIZE) {
    const batch = childTexts.slice(i, i + BATCH_EMBED_SIZE);
    const batchEmbeds = await embedTextsVoyage(batch, "document");
    embeddings.push(...batchEmbeds);
    if (i + BATCH_EMBED_SIZE < childTexts.length) {
      await sleep(DELAY_BETWEEN_BATCHES_MS);
    }
  }

  // 3. Prepare child chunks with mapped parentChunkId
  const zeroVec = new Array(EMBEDDING_DIM).fill(0);
  const childRows = childChunks.map((c, idx) => {
    const parentDbId = c.parentIndex !== undefined ? parentIdMap.get(c.parentIndex) || null : null;
    return {
      chunkIndex: c.chunkIndex,
      text: c.text,
      tokenCount: c.tokenCount,
      embedding: embeddings[idx] || zeroVec,
      metadata: {
        ...args.metadata,
        ...(c.sectionType ? { sectionType: c.sectionType } : {}),
        ...(c.statuteCitations?.length ? { statuteCitations: c.statuteCitations } : {}),
        ...(c.judgmentResult ? { judgmentResult: c.judgmentResult } : {}),
      },
      parentChunkId: parentDbId,
    };
  });

  // Bulk insert child chunks
  const childInserted = await bulkInsertChildren(ragDocId, args.userId, args.sourceDocumentId, childRows);
  const totalInserted = parentIdMap.size + childInserted;

  return { chunks: totalInserted };
}

// ─── Batch Index Statutes ────────────────────────────────────────────────────

async function indexAllStatutes(): Promise<void> {
  console.log("\n📚 INDEXING ALL STATUTE DOCUMENTS\n");

  // Get total count
  const countResult = await pool.query("SELECT COUNT(*)::int AS total FROM statute_documents");
  const total = Number(countResult.rows[0].total);
  console.log(`  Total statutes: ${total}\n`);

  // Check already indexed
  const indexedResult = await pool.query(
    `SELECT source_document_id FROM rag_documents_v2
     WHERE user_id = $1 AND status = 'indexed' AND chunk_count > 0`,
    [GLOBAL_STATUTE_RAG_USER_ID]
  );
  const indexedIds = new Set(indexedResult.rows.map((r: any) => Number(r.source_document_id)));
  console.log(`  Already indexed in v2: ${indexedIds.size}`);
  console.log(`  Remaining: ~${total - indexedIds.size}\n`);

  const FETCH_BATCH = 100;
  let offset = 0;
  let indexed = 0;
  let failed = 0;
  let skipped = 0;
  const startTime = Date.now();

  while (true) {
    const batch = await pool.query(
      `SELECT id, title, filename, content, category
       FROM statute_documents
       ORDER BY id ASC
       LIMIT $1 OFFSET $2`,
      [FETCH_BATCH, offset]
    );

    if (batch.rows.length === 0) break;

    // Filter out already-indexed docs
    const pending = (batch.rows as any[]).filter((doc) => {
      if (indexedIds.has(Number(doc.id))) { skipped++; return false; }
      return true;
    });

    // Process CONCURRENCY docs in parallel
    const results = await runConcurrent(pending, CONCURRENCY, async (doc: any) => {
      try {
        const result = await indexDocument({
          userId: GLOBAL_STATUTE_RAG_USER_ID,
          sourceDocumentId: Number(doc.id),
          title: doc.title || `Statute ${doc.id}`,
          fileName: doc.filename || null,
          content: doc.content || "",
          metadata: {
            sourceType: "admin-statute",
            category: doc.category || "general",
            statuteDocumentId: Number(doc.id),
            filename: doc.filename || null,
          },
        });
        return result.chunks > 0 ? "ok" : "empty";
      } catch (err: any) {
        console.error(`  ❌ Doc ${doc.id} (${doc.title?.slice(0, 40)}): ${err?.message?.slice(0, 200)}`);
        return "fail";
      }
    });

    for (const r of results) {
      if (r === "ok") indexed++;
      else if (r === "fail") failed++;
      else failed++; // empty
    }

    offset += FETCH_BATCH;
    const processed = indexed + failed + skipped;
    const elapsed = (Date.now() - startTime) / 1000;
    const rate = (indexed + failed) / Math.max(elapsed, 1);
    const remaining = (total - processed) / Math.max(rate, 0.1);
    console.log(
      `  📊 ${processed}/${total} | ✅ ${indexed} indexed | ❌ ${failed} failed | ⏭️ ${skipped} skip | ⏱️ ${(elapsed / 60).toFixed(1)}min | ETA: ${(remaining / 60).toFixed(1)}min`
    );
  }

  console.log(`\n✅ Statutes complete: ${indexed} indexed, ${failed} failed, ${skipped} skipped\n`);
}

// ─── Batch Index Judgments ────────────────────────────────────────────────────


async function bulkInsertParentsForBatch(
  parents: Array<{
    ragDocId: number;
    sourceDocumentId: number;
    chunkIndex: number;
    text: string;
    tokenCount: number;
    metadata: Record<string, unknown>;
  }>
): Promise<Map<string, number>> {
  const parentIdMap = new Map<string, number>();
  if (parents.length === 0) return parentIdMap;

  // Insert parents in batches of 50
  const BULK_SIZE = 50;
  for (let i = 0; i < parents.length; i += BULK_SIZE) {
    const batch = parents.slice(i, i + BULK_SIZE);
    const values: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    for (const chunk of batch) {
      values.push(
        `($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, $${paramIdx + 3}, $${paramIdx + 4}, $${paramIdx + 5}, $${paramIdx + 6}, NULL)`
      );
      params.push(
        chunk.ragDocId,
        GLOBAL_JUDGMENTS_RAG_USER_ID,
        chunk.sourceDocumentId,
        chunk.chunkIndex,
        chunk.tokenCount,
        chunk.text,
        JSON.stringify(chunk.metadata)
      );
      paramIdx += 7;
    }

    try {
      const result = await pool.query(
        `INSERT INTO rag_chunks_v2
         (rag_document_id, user_id, source_document_id, chunk_index, token_count, chunk_text, metadata, embedding)
         VALUES ${values.join(", ")}
         ON CONFLICT (rag_document_id, chunk_index) DO UPDATE SET
           chunk_text = EXCLUDED.chunk_text,
           metadata = EXCLUDED.metadata
         RETURNING id, rag_document_id, chunk_index`,
        params
      );
      for (const row of result.rows) {
        parentIdMap.set(`${row.rag_document_id}:${row.chunk_index}`, Number(row.id));
      }
    } catch (err: any) {
      console.error(`    ❌ Bulk parent insert failed: ${err?.message?.slice(0, 200)}`);
    }
  }

  return parentIdMap;
}

async function bulkInsertChildrenForBatch(
  chunks: Array<{
    ragDocId: number;
    sourceDocumentId: number;
    chunkIndex: number;
    text: string;
    tokenCount: number;
    embedding: number[];
    metadata: Record<string, unknown>;
    parentChunkId: number | null;
  }>
): Promise<number> {
  if (chunks.length === 0) return 0;

  const BULK_SIZE = 50;
  let totalInserted = 0;

  // Split into independent query payloads first
  const queries: Array<{ sql: string; params: any[]; size: number }> = [];

  for (let i = 0; i < chunks.length; i += BULK_SIZE) {
    const batch = chunks.slice(i, i + BULK_SIZE);
    const values: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    for (const chunk of batch) {
      const vecStr = vectorLiteral(chunk.embedding);
      values.push(
        `($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, $${paramIdx + 3}, $${paramIdx + 4}, $${paramIdx + 5}, $${paramIdx + 6}, $${paramIdx + 7}::vector, $${paramIdx + 8})`
      );
      params.push(
        chunk.ragDocId,
        GLOBAL_JUDGMENTS_RAG_USER_ID,
        chunk.sourceDocumentId,
        chunk.chunkIndex,
        chunk.tokenCount,
        chunk.text,
        JSON.stringify(chunk.metadata),
        vecStr,
        chunk.parentChunkId
      );
      paramIdx += 9;
    }

    queries.push({
      sql: `INSERT INTO rag_chunks_v2
            (rag_document_id, user_id, source_document_id, chunk_index, token_count, chunk_text, metadata, embedding, parent_chunk_id)
            VALUES ${values.join(", ")}
            ON CONFLICT (rag_document_id, chunk_index) DO NOTHING`,
      params,
      size: batch.length,
    });
  }

  // Run with controlled concurrency (up to 10 concurrent queries at a time — 4 CU DB can handle this)
  const CONCURRENT_QUERIES = 10;
  for (let i = 0; i < queries.length; i += CONCURRENT_QUERIES) {
    const batchQueries = queries.slice(i, i + CONCURRENT_QUERIES);
    const promises = batchQueries.map(async (q) => {
      try {
        const result = await pool.query(q.sql, q.params);
        totalInserted += result.rowCount ?? q.size;
      } catch (err: any) {
        console.error(`    ❌ Bulk child insert failed: ${err?.message?.slice(0, 200)}`);
      }
    });
    await Promise.all(promises);
  }

  return totalInserted;
}

async function indexJudgmentsBatch(rows: any[]): Promise<{ indexed: number; failed: number }> {
  // 1. Chunk documents in parallel
  const docData = rows.map((row) => {
    const sourceDocumentId = Math.abs(parseInt(String(row.id).replace(/-/g, "").slice(0, 8), 16));

    const parts: string[] = [];
    parts.push(`CITATION: ${row.citation_string || ""}`);
    parts.push(`COURT: ${row.court_name || ""}`);
    if (row.title) parts.push(`TITLE: ${row.title}`);
    if (row.petitioner) parts.push(`PETITIONER: ${row.petitioner}`);
    if (row.respondent) parts.push(`RESPONDENT: ${row.respondent}`);
    if (row.headnotes) parts.push(`HEADNOTES:\n${row.headnotes}`);
    if (row.full_text) parts.push(`JUDGMENT:\n${row.full_text}`);
    const content = parts.join("\n\n");

    const cleaned = cleanLegalDocumentText(content);
    if (!cleaned) return null;

    const allChunks = chunkTextByTokens(cleaned).slice(0, MAX_CHUNKS_PER_DOC);
    if (allChunks.length === 0) return null;

    return {
      sourceDocumentId,
      title: `${row.citation_string || ""} — ${row.title || "Judgment"}`,
      contentHash: sha256(cleaned),
      chunks: allChunks,
      rowId: row.id,
      citationString: row.citation_string || "",
      court: row.court_name || "",
      docTitle: row.title || "",
    };
  }).filter(Boolean) as any[];

  if (docData.length === 0) return { indexed: 0, failed: rows.length };

  // 2. Bulk insert all documents
  const docValues: string[] = [];
  const docParams: any[] = [];
  let dIdx = 1;
  for (const doc of docData) {
    docValues.push(`($${dIdx}, $${dIdx+1}, $${dIdx+2}, NULL, NULL, $${dIdx+3}, 'indexed', $${dIdx+4})`);
    docParams.push(
      GLOBAL_JUDGMENTS_RAG_USER_ID,
      doc.sourceDocumentId,
      doc.title,
      doc.contentHash,
      doc.chunks.length
    );
    dIdx += 5;
  }

  const docIdMap = new Map<number, number>(); // sourceDocumentId -> ragDocId
  try {
    const docRes = await pool.query(
      `INSERT INTO rag_documents_v2 (user_id, source_document_id, title, file_name, mime_type, content_hash, status, chunk_count)
       VALUES ${docValues.join(", ")}
       ON CONFLICT (user_id, source_document_id) DO UPDATE SET
         title = EXCLUDED.title,
         content_hash = EXCLUDED.content_hash,
         status = 'indexed',
         chunk_count = EXCLUDED.chunk_count,
         updated_at = now()
       RETURNING id, source_document_id`,
      docParams
    );
    for (const r of docRes.rows) {
      docIdMap.set(Number(r.source_document_id), Number(r.id));
    }
  } catch (err: any) {
    console.error(`  ❌ Document bulk insert failed: ${err.message}`);
    return { indexed: 0, failed: rows.length };
  }

  // 3. Prepare parent rows across all documents
  const parentRows: any[] = [];
  for (const doc of docData) {
    const ragDocId = docIdMap.get(doc.sourceDocumentId);
    if (!ragDocId) continue;

    const parents = doc.chunks.filter((c: any) => c.isParent);
    for (const p of parents) {
      parentRows.push({
        ragDocId,
        sourceDocumentId: doc.sourceDocumentId,
        chunkIndex: p.chunkIndex,
        text: p.text,
        tokenCount: p.tokenCount,
        metadata: {
          sourceType: "judgment",
          category: "judgment",
          judgmentId: doc.rowId,
          citationString: doc.citationString,
          court: doc.court,
          title: doc.docTitle,
          isParent: true,
        },
      });
    }
  }

  // Delete existing chunks for these docs in case of re-run
  const ragDocIds = Array.from(docIdMap.values());
  if (ragDocIds.length > 0) {
    await pool.query("DELETE FROM rag_chunks_v2 WHERE rag_document_id = ANY($1)", [ragDocIds]);
  }

  // Bulk insert all parent chunks and get mapped IDs
  const parentIdMap = await bulkInsertParentsForBatch(parentRows);

  // 4. Prepare and embed child chunks
  const childRows: any[] = [];
  const childTexts: string[] = [];
  for (const doc of docData) {
    const ragDocId = docIdMap.get(doc.sourceDocumentId);
    if (!ragDocId) continue;

    const children = doc.chunks.filter((c: any) => !c.isParent);
    for (const c of children) {
      childTexts.push(c.text);
      childRows.push({
        ragDocId,
        sourceDocumentId: doc.sourceDocumentId,
        chunkIndex: c.chunkIndex,
        text: c.text,
        tokenCount: c.tokenCount,
        parentIndex: c.parentIndex,
        metadata: {
          sourceType: "judgment",
          category: "judgment",
          judgmentId: doc.rowId,
          citationString: doc.citationString,
          court: doc.court,
          title: doc.docTitle,
          ...(c.sectionType ? { sectionType: c.sectionType } : {}),
          ...(c.statuteCitations?.length ? { statuteCitations: c.statuteCitations } : {}),
          ...(c.judgmentResult ? { judgmentResult: c.judgmentResult } : {}),
        },
      });
    }
  }

  // Embed child texts with controlled concurrency (3 parallel Voyage API calls) for maximum throughput
  const embeddings: number[][] = [];

  // Prepare all embedding batches
  const embBatches: string[][] = [];
  for (let i = 0; i < childTexts.length; i += BATCH_EMBED_SIZE) {
    embBatches.push(childTexts.slice(i, i + BATCH_EMBED_SIZE));
  }

  // Run VOYAGE_EMBED_CONCURRENCY (3) concurrent Voyage API calls at a time, preserving order
  for (let i = 0; i < embBatches.length; i += VOYAGE_EMBED_CONCURRENCY) {
    const group = embBatches.slice(i, i + VOYAGE_EMBED_CONCURRENCY);
    const results = await Promise.all(group.map(async (batch) => {
      let retries = 3;
      while (retries > 0) {
        try {
          return await embedTextsVoyage(batch, "document");
        } catch (err: any) {
          retries--;
          console.warn(`    ⚠️ Voyage embed failed (retries left: ${retries}): ${err.message}`);
          if (retries > 0) await sleep(2000);
          else throw new Error(`Failed to embed texts after 3 retries: ${err.message}`);
        }
      }
      throw new Error("Unreachable");
    }));
    // Promise.all preserves order — results[0] matches group[0], etc.
    for (const r of results) {
      embeddings.push(...r);
    }
  }

  // 5. Bulk insert child chunks with mapped parentChunkId
  const zeroVec = new Array(EMBEDDING_DIM).fill(0);
  const childInsertRows = childRows.map((chunk, idx) => {
    const parentKey = `${chunk.ragDocId}:${chunk.parentIndex}`;
    const parentDbId = chunk.parentIndex !== undefined ? parentIdMap.get(parentKey) || null : null;
    return {
      ragDocId: chunk.ragDocId,
      sourceDocumentId: chunk.sourceDocumentId,
      chunkIndex: chunk.chunkIndex,
      text: chunk.text,
      tokenCount: chunk.tokenCount,
      embedding: embeddings[idx] || zeroVec,
      metadata: chunk.metadata,
      parentChunkId: parentDbId,
    };
  });

  const childInserted = await bulkInsertChildrenForBatch(childInsertRows);
  return { indexed: docData.length, failed: rows.length - docData.length };
}

async function indexAllJudgments(): Promise<void> {
  console.log("\n⚖️  INDEXING ALL JUDGMENTS\n");

  // Get total count
  const countResult = await pool.query("SELECT COUNT(*)::int AS total FROM judgments");
  const total = Number(countResult.rows[0].total);
  console.log(`  Total judgments: ${total}\n`);

  // Check already indexed
  const indexedResult = await pool.query(
    `SELECT source_document_id FROM rag_documents_v2
     WHERE user_id = $1 AND status = 'indexed' AND chunk_count > 0`,
    [GLOBAL_JUDGMENTS_RAG_USER_ID]
  );
  const indexedSourceIds = new Set(indexedResult.rows.map((r: any) => Number(r.source_document_id)));
  console.log(`  Already indexed in v2: ${indexedSourceIds.size}\n`);

  // Initialize keyset pagination to instantly skip already-indexed rows
  let lastId: string | null = null;
  let skipped = 0;
  if (indexedSourceIds.size > 0) {
    const skipRes = await pool.query(
      "SELECT id FROM judgments ORDER BY id ASC LIMIT 1 OFFSET $1",
      [indexedSourceIds.size - 1] // Get the UUID of the last skipped doc (0-indexed)
    );
    if (skipRes.rows.length > 0) {
      lastId = skipRes.rows[0].id;
      skipped = indexedSourceIds.size;
      console.log(`  🚀 Keyset pagination initialized lastId to ${lastId} to instantly skip ${skipped} documents.\n`);
    }
  }

  const FETCH_BATCH = 100; // fetch 100 documents at a time
  const CONCURRENT_BATCHES = 4; // process 4 batches concurrently (maximizes 6M TPM / 4000 RPM Voyage limits)
  const LIMIT = FETCH_BATCH * CONCURRENT_BATCHES; // 400 docs per DB query
  
  let indexed = 0;
  let failed = 0;
  const startTime = Date.now();

  while (true) {
    // Keyset pagination query - extremely fast indexed scan (O(log N))
    const queryStr = `
      SELECT j.id, j.citation_string, j.title, j.petitioner, j.respondent,
             j.headnotes, j.full_text, j.decision_date,
             cr.name AS court_name, lj.code AS journal_code
      FROM judgments j
      LEFT JOIN courts_ref cr ON j.court_id = cr.id
      INNER JOIN law_journals lj ON j.journal_id = lj.id
      ${lastId ? "WHERE j.id > $2" : ""}
      ORDER BY j.id ASC
      LIMIT $1`;
    
    const queryParams = lastId ? [LIMIT, lastId] : [LIMIT];
    const result = await pool.query(queryStr, queryParams);
    const rows = result.rows;

    if (rows.length === 0) break;

    // Update lastId to the id of the last row in this batch
    lastId = rows[rows.length - 1].id;

    // Partition rows into concurrent batches of size FETCH_BATCH
    const batches: any[][] = [];
    for (let i = 0; i < rows.length; i += FETCH_BATCH) {
      batches.push(rows.slice(i, i + FETCH_BATCH));
    }

    // Process batches concurrently
    const processPromises = batches.map(async (batchRows) => {
      // Filter out already-indexed
      const pending = (batchRows as any[]).filter((row) => {
        const sourceDocumentId = Math.abs(parseInt(String(row.id).replace(/-/g, "").slice(0, 8), 16));
        if (indexedSourceIds.has(sourceDocumentId)) { skipped++; return false; }
        return true;
      });

      if (pending.length > 0) {
        try {
          const result = await indexJudgmentsBatch(pending);
          indexed += result.indexed;
          failed += result.failed;
        } catch (err: any) {
          failed += pending.length;
          console.error(`  ❌ Batch index failed: ${err.message}`);
        }
      }
    });

    await Promise.all(processPromises);

    const processed = indexed + failed + skipped;
    const elapsed = (Date.now() - startTime) / 1000;
    const rate = (indexed + failed) / Math.max(elapsed, 1);
    const remaining = (total - processed) / Math.max(rate, 0.1);
    console.log(
      `  📊 ${processed}/${total} | ✅ ${indexed} | ❌ ${failed} | ⏭️ ${skipped} skipped | ⏱️ ${(elapsed / 60).toFixed(1)}min | ETA: ${(remaining / 60).toFixed(1)}min`
    );
  }

  console.log(`\n✅ Judgments complete: ${indexed} indexed, ${failed} failed, ${skipped} skipped\n`);
}

// ─── Status ──────────────────────────────────────────────────────────────────

async function showStatus(): Promise<void> {
  console.log("\n📊 SHADOW MIGRATION STATUS\n");

  // v2 tables
  try {
    const docs = await pool.query(
      `SELECT user_id, status, COUNT(*) AS cnt, SUM(chunk_count) AS chunks
       FROM rag_documents_v2 GROUP BY user_id, status ORDER BY user_id`
    );
    console.log("  rag_documents_v2:");
    for (const row of docs.rows as any[]) {
      console.log(`    ${row.user_id} | ${row.status} | ${row.cnt} docs | ${row.chunks} chunks`);
    }

    const chunks = await pool.query(
      `SELECT user_id, COUNT(*) AS total,
              COUNT(embedding) FILTER (WHERE embedding IS NOT NULL) AS with_embed
       FROM rag_chunks_v2 GROUP BY user_id ORDER BY user_id`
    );
    console.log("\n  rag_chunks_v2:");
    for (const row of chunks.rows as any[]) {
      console.log(`    ${row.user_id} | ${row.total} chunks | ${row.with_embed} embedded`);
    }
  } catch {
    console.log("  ⚠️  v2 tables don't exist yet. Run without flags first to create them.");
  }

  // Production tables for comparison
  const prodDocs = await pool.query(
    `SELECT user_id, status, COUNT(*) AS cnt, SUM(chunk_count) AS chunks
     FROM rag_documents GROUP BY user_id, status ORDER BY user_id`
  );
  console.log("\n  Production rag_documents (for comparison):");
  for (const row of prodDocs.rows as any[]) {
    console.log(`    ${row.user_id} | ${row.status} | ${row.cnt} docs | ${row.chunks} chunks`);
  }

  // Source totals
  const statutes = await pool.query("SELECT COUNT(*)::int AS cnt FROM statute_documents");
  const judgments = await pool.query("SELECT COUNT(*)::int AS cnt FROM judgments");
  console.log(`\n  Source data: ${statutes.rows[0].cnt} statutes, ${judgments.rows[0].cnt} judgments`);
}

// ─── Swap Tables ─────────────────────────────────────────────────────────────

async function swapTables(): Promise<void> {
  console.log("\n🔄 SWAPPING V2 TABLES INTO PRODUCTION\n");

  // Verify v2 has data
  const v2Docs = await pool.query(
    "SELECT COUNT(*)::int AS cnt FROM rag_documents_v2 WHERE status = 'indexed'"
  );
  const v2Count = Number(v2Docs.rows[0].cnt);
  if (v2Count === 0) {
    console.error("❌ v2 tables have no indexed documents. Run indexing first.");
    return;
  }

  console.log(`  v2 has ${v2Count} indexed documents. Swapping...`);

  // Transaction: rename tables atomically
  await pool.query("BEGIN");
  try {
    // Backup current production
    await pool.query("ALTER TABLE IF EXISTS rag_chunks RENAME TO rag_chunks_old");
    await pool.query("ALTER TABLE IF EXISTS rag_documents RENAME TO rag_documents_old");

    // Promote v2 to production
    await pool.query("ALTER TABLE rag_chunks_v2 RENAME TO rag_chunks");
    await pool.query("ALTER TABLE rag_documents_v2 RENAME TO rag_documents");

    // Rename constraints and indexes to match production names
    // (The foreign key and unique constraints will keep their old names but still work)

    await pool.query("COMMIT");
    console.log("\n✅ SWAP COMPLETE!");
    console.log("  Old tables backed up as: rag_documents_old, rag_chunks_old");
    console.log("  New tables are now: rag_documents, rag_chunks");
    console.log("\n⚠️  NEXT STEPS:");
    console.log("  1. Update .env: RAG_EMBEDDING_PROVIDER=voyage");
    console.log("  2. Update .env: RAG_EMBEDDING_DIM=1024");
    console.log("  3. Restart your app");
    console.log("  4. Test search quality");
    console.log("  5. If all good: DROP TABLE rag_documents_old CASCADE; DROP TABLE rag_chunks_old CASCADE;");
  } catch (err) {
    await pool.query("ROLLBACK");
    console.error("❌ Swap failed, rolled back:", err);
  }
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runConcurrent<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await fn(items[idx]);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const doStatutes = args.includes("--index-statutes") || args.includes("--index-all");
  const doJudgments = args.includes("--index-judgments") || args.includes("--index-all");
  const doSwap = args.includes("--swap");
  const doStatus = args.includes("--status");

  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║  VOYAGE-LAW-2 SHADOW MIGRATION (1024 dimensions)       ║");
  console.log("╚══════════════════════════════════════════════════════════╝");

  if (!VOYAGE_API_KEY) {
    console.error("❌ VOYAGE_API_KEY not set in .env");
    await pool.end();
    process.exit(1);
  }

  if (doStatus) {
    await showStatus();
    await pool.end();
    return;
  }

  if (doSwap) {
    await swapTables();
    await pool.end();
    return;
  }

  // Always ensure v2 tables exist (skip chunk indexes if we are doing judgments to avoid creating and immediately dropping them)
  await createV2Tables(doJudgments);

  if (!doStatutes && !doJudgments) {
    console.log("\n  DRY RUN — tables created. Use flags to start indexing:");
    console.log("    --index-statutes   Index statute documents");
    console.log("    --index-judgments   Index judgments");
    console.log("    --index-all        Index everything");
    console.log("    --status           Show progress");
    console.log("    --swap             Swap v2 tables into production\n");
    await showStatus();
    await pool.end();
    return;
  }

  if (doStatutes) {
    await indexAllStatutes();
  }

  if (doJudgments) {
    // 1. Drop indexes for maximum insertion speed
    console.log("\n⚡ Dropping secondary indexes on rag_chunks_v2 to maximize ingestion speed...");
    await pool.query("DROP INDEX IF EXISTS idx_rag_chunks_v2_tsv");
    await pool.query("DROP INDEX IF EXISTS idx_rag_chunks_v2_user_doc");
    await pool.query("DROP INDEX IF EXISTS idx_rag_chunks_v2_parent");

    // 2. Index all judgments
    await indexAllJudgments();

    // 3. Recreate indexes at the end
    console.log("\n⚡ Rebuilding index: idx_rag_chunks_v2_user_doc...");
    let t0 = Date.now();
    await pool.query("CREATE INDEX IF NOT EXISTS idx_rag_chunks_v2_user_doc ON rag_chunks_v2 (user_id, source_document_id)");
    console.log(`  ✅ idx_rag_chunks_v2_user_doc rebuilt in ${((Date.now() - t0)/1000).toFixed(1)}s`);

    console.log("⚡ Rebuilding GIN index: idx_rag_chunks_v2_tsv (this may take 1-2 minutes)...");
    t0 = Date.now();
    await pool.query("CREATE INDEX IF NOT EXISTS idx_rag_chunks_v2_tsv ON rag_chunks_v2 USING gin (to_tsvector('simple', chunk_text))");
    console.log(`  ✅ idx_rag_chunks_v2_tsv GIN index rebuilt in ${((Date.now() - t0)/1000).toFixed(1)}s`);

    console.log("⚡ Rebuilding index: idx_rag_chunks_v2_parent...");
    t0 = Date.now();
    await pool.query("CREATE INDEX IF NOT EXISTS idx_rag_chunks_v2_parent ON rag_chunks_v2 (parent_chunk_id)");
    console.log(`  ✅ idx_rag_chunks_v2_parent rebuilt in ${((Date.now() - t0)/1000).toFixed(1)}s`);
  }

  await showStatus();
  await pool.end();
}

main().catch(async (err) => {
  console.error("Fatal error:", err);
  await pool.end();
  process.exit(1);
});
