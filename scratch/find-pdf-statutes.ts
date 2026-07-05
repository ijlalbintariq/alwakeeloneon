import "../server/load-env";
import { pool } from "../server/db";

async function run() {
  console.log("Finding statutes with PDFs...");
  try {
    const res = await pool.query(`
      SELECT sd.id, sd.title, sd.filename, f.original_filename
      FROM statute_documents sd
      JOIN statute_document_files f ON sd.id = f.statute_document_id
      LIMIT 10
    `);
    console.log("Found statutes with PDFs:");
    res.rows.forEach((row) => {
      console.log(`- [ID: ${row.id}] Title: "${row.title}" (File: ${row.original_filename || row.filename})`);
    });
  } catch (err: any) {
    console.error("Error:", err.message);
  }
  await pool.end();
}

run().catch(console.error);
