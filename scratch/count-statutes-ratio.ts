import "../server/load-env";
import { pool } from "../server/db";

async function run() {
  console.log("Querying database stats for statutes...");
  try {
    // 1. Total statutes
    const resTotal = await pool.query(`
      SELECT COUNT(*) as total FROM statute_documents
    `);
    const total = Number(resTotal.rows[0].total);

    // 2. Statutes with PDF files
    const resPdf = await pool.query(`
      SELECT COUNT(DISTINCT statute_document_id) as total_pdf 
      FROM statute_document_files
      WHERE mime_type ILIKE '%pdf%' OR original_filename ILIKE '%pdf'
    `);
    const pdfs = Number(resPdf.rows[0].total_pdf);

    // 3. Statutes with non-PDF files (e.g. text/docx)
    const resOtherFiles = await pool.query(`
      SELECT COUNT(DISTINCT statute_document_id) as total_others 
      FROM statute_document_files
      WHERE NOT (mime_type ILIKE '%pdf%' OR original_filename ILIKE '%pdf')
    `);
    const otherFiles = Number(resOtherFiles.rows[0].total_others);

    // 4. Statutes that have text content only (no file at all)
    const textOnly = total - pdfs - otherFiles;

    console.log("-----------------------------------------");
    console.log(`📊 TOTAL STATUTE RECORDS: ${total}`);
    console.log(`📄 STATUTES WITH PDFs:     ${pdfs}`);
    console.log(`📁 STATUTES WITH OTHER FILES: ${otherFiles}`);
    console.log(`✍️  STATUTES IN TEXT ONLY:  ${textOnly}`);
    console.log("-----------------------------------------");
  } catch (err: any) {
    console.error("Error:", err.message);
  }
  await pool.end();
}

run().catch(console.error);
