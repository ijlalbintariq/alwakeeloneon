import "../server/load-env";
import { pool } from "../server/db";

async function run() {
  console.log("Analyzing duplicate statutes in database...");
  try {
    // 1. Duplicate Titles
    const resTitles = await pool.query(`
      SELECT title, COUNT(*) as count
      FROM statute_documents
      GROUP BY title
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `);
    const duplicateTitlesGroups = resTitles.rows.length;
    const totalDuplicateTitlesRows = resTitles.rows.reduce((sum, row) => sum + Number(row.count), 0);

    // 2. Duplicate Filenames (excluding null/empty)
    const resFilenames = await pool.query(`
      SELECT filename, COUNT(*) as count
      FROM statute_documents
      WHERE filename IS NOT NULL AND filename <> ''
      GROUP BY filename
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `);
    const duplicateFilenamesGroups = resFilenames.rows.length;
    const totalDuplicateFilenamesRows = resFilenames.rows.reduce((sum, row) => sum + Number(row.count), 0);

    // 3. Duplicate Contents (excluding null/empty)
    const resContents = await pool.query(`
      SELECT MD5(content) as content_md5, COUNT(*) as count
      FROM statute_documents
      WHERE content IS NOT NULL AND content <> ''
      GROUP BY MD5(content)
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `);
    const duplicateContentsGroups = resContents.rows.length;
    const totalDuplicateContentsRows = resContents.rows.reduce((sum, row) => sum + Number(row.count), 0);

    console.log("-----------------------------------------");
    console.log("📊 DUPLICATE ANALYSIS:");
    console.log(`- Duplicate Titles:     ${totalDuplicateTitlesRows} records (grouped into ${duplicateTitlesGroups} unique titles)`);
    console.log(`- Duplicate Filenames:  ${totalDuplicateFilenamesRows} records (grouped into ${duplicateFilenamesGroups} unique filenames)`);
    console.log(`- Duplicate Contents:   ${totalDuplicateContentsRows} records (grouped into ${duplicateContentsGroups} unique contents)`);
    console.log("-----------------------------------------");

    if (duplicateTitlesGroups > 0) {
      console.log("\nTop 5 duplicate titles:");
      resTitles.rows.slice(0, 5).forEach((row) => {
        console.log(`- "${row.title}" (appears ${row.count} times)`);
      });
    }
  } catch (err: any) {
    console.error("Error:", err.message);
  }
  await pool.end();
}

run().catch(console.error);
