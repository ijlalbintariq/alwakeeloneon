/**
 * Quick check: is the HNSW index created yet?
 */
import pg from "pg";
const { Pool } = pg;

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000 });

  try {
    const res = await pool.query(`
      SELECT indexname, indexdef, pg_size_pretty(pg_relation_size(indexname::regclass)) as idx_size
      FROM pg_indexes 
      WHERE tablename = 'rag_chunks' AND indexname LIKE '%statute%'
    `);
    
    if (res.rows.length === 0) {
      console.log("❌ No statute index found yet — still building or failed.");
    } else {
      for (const row of res.rows) {
        console.log(`✅ ${row.indexname} (${row.idx_size})`);
        console.log(`   ${row.indexdef}`);
      }
    }

    // Check for any ongoing index builds
    const buildRes = await pool.query(`
      SELECT pid, now() - query_start as duration, query 
      FROM pg_stat_activity 
      WHERE query ILIKE '%CREATE INDEX%' AND state = 'active'
    `);
    if (buildRes.rows.length > 0) {
      console.log("\n🔨 Active index builds:");
      for (const row of buildRes.rows) {
        console.log(`   PID=${row.pid} duration=${row.duration} query=${(row.query || "").slice(0, 100)}...`);
      }
    } else {
      console.log("\nNo active CREATE INDEX operations found.");
    }
  } catch (err: any) {
    console.error("Error:", err.message);
  }

  await pool.end();
  process.exit(0);
}

main();
