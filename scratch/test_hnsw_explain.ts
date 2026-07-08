/**
 * Debug: Test if HNSW index is being used by running raw SQL queries.
 */
import pg from "pg";
import { embedTextLocal } from "../server/rag/embedding-local";
const { Pool } = pg;

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  console.log("Step 1: Get query embedding...");
  const embedding = await embedTextLocal("punishment for narcotics CNSA 1997");
  const vecLiteral = `[${embedding.join(",")}]`;
  
  // Test 1: Simple direct query (should use HNSW)
  console.log("\n=== Test 1: Simple ORDER BY with WHERE user_id = literal ===");
  const t1 = Date.now();
  const r1 = await pool.query(`
    SELECT id, chunk_text, 1 - (embedding <=> $1::vector) as score
    FROM rag_chunks 
    WHERE user_id = 'global-admin-statute'
    ORDER BY embedding <=> $1::vector
    LIMIT 5
  `, [vecLiteral]);
  console.log(`  Duration: ${Date.now() - t1}ms, rows: ${r1.rows.length}`);
  for (const row of r1.rows) {
    console.log(`  [score=${Number(row.score).toFixed(4)}] ${(row.chunk_text || "").slice(0, 60).replace(/\n/g, " ")}...`);
  }

  // Test 2: EXPLAIN ANALYZE the same query
  console.log("\n=== Test 2: EXPLAIN ANALYZE ===");
  const explain = await pool.query(`
    EXPLAIN ANALYZE
    SELECT id, chunk_text, 1 - (embedding <=> $1::vector) as score
    FROM rag_chunks 
    WHERE user_id = 'global-admin-statute'
    ORDER BY embedding <=> $1::vector
    LIMIT 5
  `, [vecLiteral]);
  for (const row of explain.rows) {
    console.log(`  ${(row as any)["QUERY PLAN"]}`);
  }

  // Test 3: Check if the index is valid
  console.log("\n=== Test 3: Index validity check ===");
  const idxCheck = await pool.query(`
    SELECT indexname, pg_size_pretty(pg_relation_size(indexname::regclass)) as size,
           idx.indisvalid as is_valid, idx.indisready as is_ready
    FROM pg_indexes pi
    JOIN pg_index idx ON idx.indexrelid = (pi.indexname)::regclass::oid
    WHERE pi.tablename = 'rag_chunks' AND pi.indexname LIKE '%statute%'
  `);
  for (const row of idxCheck.rows) {
    console.log(`  ${row.indexname}: size=${row.size} valid=${row.is_valid} ready=${row.is_ready}`);
  }

  await pool.end();
  process.exit(0);
}

main().catch((err) => { console.error("Error:", err); process.exit(1); });
