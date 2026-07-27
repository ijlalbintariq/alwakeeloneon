import pg from "pg";
const { Pool } = pg;

async function optimizeIndexes() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });

  try {
    console.log("=== STARTING DATABASE STORAGE OPTIMIZATION ===");

    // 1. Drop old leftover backup tables
    console.log("\n1. Dropping old leftover backup tables (rag_chunks_old, rag_documents_old)...");
    await pool.query("DROP TABLE IF EXISTS rag_chunks_old CASCADE;");
    await pool.query("DROP TABLE IF EXISTS rag_documents_old CASCADE;");
    console.log("   ✅ Leftover backup tables dropped.");

    // 2. Drop duplicate vector index
    console.log("\n2. Dropping duplicate 36 GB vector index (idx_rag_chunks_v2_global_judgments)...");
    await pool.query("DROP INDEX IF EXISTS idx_rag_chunks_v2_global_judgments;");
    console.log("   ✅ Duplicate vector index dropped.");

    // 3. Drop duplicate cosine index if present
    console.log("\n3. Dropping duplicate vector cosine index (idx_rag_chunks_v2_embedding_cosine)...");
    await pool.query("DROP INDEX IF EXISTS idx_rag_chunks_v2_embedding_cosine;");
    console.log("   ✅ Duplicate cosine index dropped.");

    // 4. Re-check table sizes
    console.log("\n4. Fetching updated table and index sizes...");
    const res = await pool.query(`
      SELECT 
        table_name,
        pg_size_pretty(pg_total_relation_size(quote_ident(table_name))) as total_size,
        pg_size_pretty(pg_relation_size(quote_ident(table_name))) as table_size,
        pg_size_pretty(pg_total_relation_size(quote_ident(table_name)) - pg_relation_size(quote_ident(table_name))) as index_size
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY pg_total_relation_size(quote_ident(table_name)) DESC
      LIMIT 10;
    `);

    console.log("\n=== UPDATED TOP 10 DATABASE TABLES BY SIZE ===");
    console.table(res.rows);

  } catch (err) {
    console.error("Optimization error:", err);
  } finally {
    await pool.end();
  }
}

optimizeIndexes();
