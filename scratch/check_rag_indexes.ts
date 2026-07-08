/**
 * Check existing indexes on rag_chunks and create HNSW index for fast vector search.
 */
import pg from "pg";
const { Pool } = pg;

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  // Check table size
  console.log("=== RAG_CHUNKS TABLE INFO ===");
  const countRes = await pool.query("SELECT COUNT(*) as total FROM rag_chunks");
  console.log(`Total rows: ${countRes.rows[0].total}`);

  const sizeRes = await pool.query("SELECT pg_size_pretty(pg_total_relation_size('rag_chunks')) as size");
  console.log(`Table size: ${sizeRes.rows[0].size}`);

  // Check existing indexes
  console.log("\n=== EXISTING INDEXES ===");
  const idxRes = await pool.query(`
    SELECT indexname, indexdef 
    FROM pg_indexes 
    WHERE tablename = 'rag_chunks'
    ORDER BY indexname
  `);
  for (const row of idxRes.rows) {
    console.log(`  ${row.indexname}: ${row.indexdef}`);
  }

  // Check vector dimension
  console.log("\n=== VECTOR DIMENSION CHECK ===");
  const dimRes = await pool.query(`
    SELECT vector_dims(embedding) as dims 
    FROM rag_chunks 
    WHERE embedding IS NOT NULL 
    LIMIT 1
  `);
  console.log(`Embedding dimensions: ${dimRes.rows[0]?.dims || "unknown"}`);

  // Check user_id distribution
  console.log("\n=== USER_ID DISTRIBUTION ===");
  const distRes = await pool.query(`
    SELECT user_id, COUNT(*) as cnt 
    FROM rag_chunks 
    GROUP BY user_id 
    ORDER BY cnt DESC 
    LIMIT 10
  `);
  for (const row of distRes.rows) {
    console.log(`  ${row.user_id}: ${row.cnt} chunks`);
  }

  await pool.end();
  console.log("\nDone.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
