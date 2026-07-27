import pg from "pg";
const { Pool } = pg;

async function checkTableSizes() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });

  try {
    const res = await pool.query(`
      SELECT 
        table_name,
        pg_size_pretty(pg_total_relation_size(quote_ident(table_name))) as total_size,
        pg_size_pretty(pg_relation_size(quote_ident(table_name))) as table_size,
        pg_size_pretty(pg_total_relation_size(quote_ident(table_name)) - pg_relation_size(quote_ident(table_name))) as index_size
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY pg_total_relation_size(quote_ident(table_name)) DESC
      LIMIT 15;
    `);

    console.log("\n=== TOP 15 DATABASE TABLES BY SIZE ===");
    console.table(res.rows);
  } catch (err) {
    console.error("Query failed:", err);
  } finally {
    await pool.end();
  }
}

checkTableSizes();
