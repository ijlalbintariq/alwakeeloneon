import "../server/load-env";
import { pool } from "../server/db";

async function check() {
  console.log("Checking statutes files in database...");
  try {
    const res = await pool.query(`
      SELECT COUNT(*) as total, 
             COUNT(CASE WHEN filename IS NOT NULL THEN 1 END) as with_filename
      FROM admin_knowledge
      WHERE replace(replace(replace(lower(coalesce(category, '')), '-', ''), ' ', ''), '_', '') = 'statute'
    `);
    console.log("Statute documents in admin_knowledge:", res.rows[0]);

    const resFiles = await pool.query(`
      SELECT COUNT(*) as total
      FROM statute_document_files
    `);
    console.log("Files in statute_document_files:", resFiles.rows[0]);
  } catch (err: any) {
    console.error("Error:", err.message);
  }
  await pool.end();
}

check().catch(console.error);
