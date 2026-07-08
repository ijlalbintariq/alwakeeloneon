/**
 * Create HNSW partial index on rag_chunks for global-admin-statute.
 * This will speed up Voyage Law-2 statute queries from 50-100s to <100ms.
 */
import pg from "pg";
const { Pool } = pg;

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  console.log("Creating HNSW partial index for global-admin-statute...");
  console.log("This covers 165,801 statute chunks with 1024-dim vectors.");
  console.log("Expected build time: 1-3 minutes on Neon.\n");

  const t0 = Date.now();

  await pool.query(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rag_chunks_v2_global_statutes_hnsw
    ON rag_chunks
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64)
    WHERE (user_id = 'global-admin-statute')
  `);

  const buildMs = Date.now() - t0;
  console.log(`✅ Index created in ${(buildMs / 1000).toFixed(1)}s`);

  // Verify the index exists
  const idxRes = await pool.query(`
    SELECT indexname, indexdef 
    FROM pg_indexes 
    WHERE tablename = 'rag_chunks' AND indexname LIKE '%statute%'
  `);
  for (const row of idxRes.rows) {
    console.log(`  ${row.indexname}: ${row.indexdef}`);
  }

  // Check index size
  const sizeRes = await pool.query(`
    SELECT pg_size_pretty(pg_relation_size('idx_rag_chunks_v2_global_statutes_hnsw')) as idx_size
  `);
  console.log(`  Index size: ${sizeRes.rows[0].idx_size}`);

  await pool.end();
  console.log("\nDone. Re-run the production test to verify speed improvement.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
