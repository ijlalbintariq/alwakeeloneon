import pg from "pg";
const { Pool } = pg;

async function checkOldTables() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });

  try {
    const res1 = await pool.query(`SELECT COUNT(*) FROM rag_chunks_old;`);
    const res2 = await pool.query(`SELECT COUNT(*) FROM rag_documents_old;`);
    console.log(`rag_chunks_old count: ${res1.rows[0].count}`);
    console.log(`rag_documents_old count: ${res2.rows[0].count}`);
  } catch (err) {
    console.error("Error checking old tables:", err);
  } finally {
    await pool.end();
  }
}

checkOldTables();
