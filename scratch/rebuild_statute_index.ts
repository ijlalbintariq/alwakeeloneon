/**
 * Drop invalid index and recreate WITHOUT CONCURRENTLY.
 */
import pg from "pg";
const { Pool } = pg;

async function main() {
  const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    statement_timeout: 600000, // 10 min timeout for index build
  });

  console.log("Step 1: Dropping invalid index...");
  await pool.query("DROP INDEX IF EXISTS idx_rag_chunks_v2_global_statutes_hnsw");
  console.log("  Dropped.\n");

  console.log("Step 2: Creating HNSW index (non-concurrent, faster)...");
  console.log("  Building on 165,801 statute chunks, 1024 dims, m=16, ef_construction=64");
  const t0 = Date.now();

  await pool.query(`
    CREATE INDEX idx_rag_chunks_v2_global_statutes_hnsw
    ON rag_chunks
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64)
    WHERE (user_id = 'global-admin-statute')
  `);

  const buildSec = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`  ✅ Index built in ${buildSec}s\n`);

  // Verify
  const res = await pool.query(`
    SELECT indexname, pg_size_pretty(pg_relation_size(indexname::regclass)) as idx_size
    FROM pg_indexes 
    WHERE tablename = 'rag_chunks' AND indexname LIKE '%statute%'
  `);
  for (const row of res.rows) {
    console.log(`  Index: ${row.indexname} — Size: ${row.idx_size}`);
  }

  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
