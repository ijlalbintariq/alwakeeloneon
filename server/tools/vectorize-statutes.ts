import "../load-env";
import { pool, db } from "../db";
import { statutes } from "@shared/schema";
import { embedTextsLocal } from "../rag/embedding-local";
import { ensureRagSchema } from "../rag/vector-store";
import { asc, sql } from "drizzle-orm";

async function main() {
  const args = process.argv.slice(2);
  const getArg = (name: string, def: number) => {
    const idx = args.indexOf(`--${name}`);
    return idx >= 0 && args[idx + 1] ? parseInt(args[idx + 1], 10) : def;
  };
  const LIMIT = getArg("limit", Infinity);
  
  // High rate limits -> Use large batches and concurrency
  const BATCH_SIZE = 128;
  const CONCURRENCY = 5;

  console.log(`\n=== Statutes Vectorization Pipeline (Voyage Law-2) ===`);
  console.log(`Batch size: ${BATCH_SIZE}, Concurrency: ${CONCURRENCY}, Limit: ${LIMIT === Infinity ? "ALL" : LIMIT}\n`);

  await ensureRagSchema();

  // 1. Ensure the global parent document exists
  let ragDocumentId: number;
  const docResult = await pool.query(`
    SELECT id FROM rag_documents 
    WHERE user_id = 'global-admin-statute-sections' AND source_document_id = 1
    LIMIT 1
  `);

  if (docResult.rows.length > 0) {
    ragDocumentId = Number(docResult.rows[0].id);
    console.log(`Using existing parent RAG document ID: ${ragDocumentId}`);
  } else {
    const insertDoc = await pool.query(`
      INSERT INTO rag_documents (user_id, source_document_id, title, content_hash, status)
      VALUES ('global-admin-statute-sections', 1, 'Global Statute Sections Index', 'global-statutes-sections-v1', 'indexed')
      RETURNING id
    `);
    ragDocumentId = Number(insertDoc.rows[0].id);
    console.log(`Created new parent RAG document ID: ${ragDocumentId}`);
  }

  // 2. Fetch already indexed statute section IDs to skip them (idempotency)
  console.log("Fetching already indexed statute IDs from rag_chunks...");
  const indexedQuery = await pool.query(`
    SELECT (metadata->>'statuteId')::int as id 
    FROM rag_chunks 
    WHERE user_id = 'global-admin-statute-sections' 
      AND metadata->>'statuteId' IS NOT NULL
  `);
  const indexedIds = new Set<number>(
    indexedQuery.rows.map((r: any) => Number(r.id)).filter((id: number) => !isNaN(id) && id > 0)
  );
  console.log(`Found ${indexedIds.size} already indexed statute sections.`);

  // 3. Count total statutes in DB
  const [countRow] = await db.select({ total: sql<number>`count(*)` }).from(statutes);
  const totalInDb = Number(countRow?.total || 0);
  console.log(`Total statutes in database: ${totalInDb}`);

  // 4. Fetch all statutes and filter out already indexed ones
  console.log("Fetching and filtering statute records...");
  const allStatutes = await db
    .select({
      id: statutes.id,
      shortTitle: statutes.shortTitle,
      section: statutes.section,
      description: statutes.description,
      punishment: statutes.punishment,
    })
    .from(statutes)
    .orderBy(asc(statutes.id));

  const pending = allStatutes.filter((s: any) => !indexedIds.has(s.id));
  const toProcess = pending.slice(0, LIMIT);
  console.log(`Pending to process: ${pending.length}, will index: ${toProcess.length}\n`);

  if (toProcess.length === 0) {
    console.log("✅ All statute sections are already indexed!");
    process.exit(0);
  }

  // 5. Index in parallel batches
  let processed = 0;
  let indexed = 0;
  let failed = 0;
  const t0 = Date.now();

  // Find the current max chunk index to prevent duplicate index constraints
  const maxIdxResult = await pool.query(`
    SELECT MAX(chunk_index) as max_idx 
    FROM rag_chunks 
    WHERE rag_document_id = $1
  `, [ragDocumentId]);
  let currentChunkIndex = Number(maxIdxResult.rows[0]?.max_idx ?? -1) + 1;

  for (let offset = 0; offset < toProcess.length; offset += BATCH_SIZE * CONCURRENCY) {
    const activeSlice = toProcess.slice(offset, offset + BATCH_SIZE * CONCURRENCY);
    
    // Split the slice into concurrent batches
    const batches: any[][] = [];
    for (let b = 0; b < activeSlice.length; b += BATCH_SIZE) {
      batches.push(activeSlice.slice(b, b + BATCH_SIZE));
    }

    const results = await Promise.allSettled(
      batches.map(async (batch) => {
        // Prepare texts for embedding
        const texts = batch.map((s) => {
          return `STATUTE: ${s.shortTitle}\nSECTION: ${s.section}\nDESCRIPTION:\n${s.description}\nPUNISHMENT: ${s.punishment || "None"}`;
        });

        // Generate embeddings
        const embeddings = await embedTextsLocal(texts);

        // Prepare database entries
        const dbChunks = batch.map((s, idx) => {
          const text = texts[idx];
          const tokenCount = Math.round(text.split(/\s+/).length * 1.3);
          return {
            chunkIndex: 0, // Placeholder, updated sequentially below
            tokenCount,
            text,
            embedding: embeddings[idx],
            metadata: {
              sourceType: "statute",
              category: "statute",
              statuteId: s.id,
              shortTitle: s.shortTitle,
              section: s.section,
            },
          };
        });

        return dbChunks;
      })
    );

    // Collect all chunk data and assign sequential chunk_index values to respect uniqueness
    const chunkBatchToInsert: any[] = [];
    for (const result of results) {
      if (result.status === "fulfilled") {
        for (const chunk of result.value) {
          chunk.chunkIndex = currentChunkIndex++;
          chunkBatchToInsert.push(chunk);
        }
      } else {
        console.error(`[Pipeline Error] Batch failed:`, result.reason?.message || result.reason);
        failed += BATCH_SIZE;
      }
    }

    if (chunkBatchToInsert.length > 0) {
      const values: any[] = [];
      const placeholders: string[] = [];
      let paramCount = 1;

      for (const chunk of chunkBatchToInsert) {
        placeholders.push(`($${paramCount}, $${paramCount + 1}, $${paramCount + 2}, $${paramCount + 3}, $${paramCount + 4}, $${paramCount + 5}, $${paramCount + 6}, $${paramCount + 7})`);
        values.push(
          ragDocumentId,
          "global-admin-statute-sections",
          1, // source_document_id
          chunk.chunkIndex,
          chunk.tokenCount,
          chunk.text,
          JSON.stringify(chunk.metadata),
          chunk.embedding ? `[${chunk.embedding.join(",")}]` : null
        );
        paramCount += 8;
      }

      const insertQuery = `
        INSERT INTO rag_chunks (rag_document_id, user_id, source_document_id, chunk_index, token_count, chunk_text, metadata, embedding)
        VALUES ${placeholders.join(", ")}
      `;

      await pool.query(insertQuery, values);
      indexed += chunkBatchToInsert.length;
      processed += chunkBatchToInsert.length;
      console.log(`[Indexed] Processed ${processed}/${toProcess.length} sections...`);
    }
  }

  // 6. Rebuild cosine similarity index to optimize search performance
  console.log("\nRebuilding database index (idx_rag_chunks_embedding_cosine)...");
  const tIndex0 = Date.now();
  await pool.query("REINDEX INDEX idx_rag_chunks_embedding_cosine");
  console.log(`Index rebuilt successfully in ${((Date.now() - tIndex0) / 1000).toFixed(1)}s.`);

  const durationSec = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n=== Statutes Vectorization Finished in ${durationSec}s ===`);
  console.log(`Succeeded: ${indexed}, Failed: ${failed}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
