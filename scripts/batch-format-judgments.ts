import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { formatJudgmentText, verifyWordIntegrity } from "../server/lib/judgmentFormatter";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

async function main() {
  console.log("=== Starting Judgment Formatting Batch Job ===");
  
  // Create table columns if they don't exist
  await pool.query(`
    ALTER TABLE judgments 
    ADD COLUMN IF NOT EXISTS formatted_text TEXT,
    ADD COLUMN IF NOT EXISTS format_version VARCHAR(10) DEFAULT 'v1'
  `);
  
  // Count total to process
  const { rows: countRows } = await pool.query(`
    SELECT COUNT(*) as total 
    FROM judgments 
    WHERE full_text IS NOT NULL AND (formatted_text IS NULL OR format_version = 'v1' OR format_version IS NULL)
  `);
  const total = parseInt(countRows[0].total, 10);
  
  console.log(`Found ${total} judgments to format.`);
  
  if (total === 0) {
    console.log("Nothing to do! Exiting.");
    process.exit(0);
  }

  const BATCH_SIZE = 50;
  let processed = 0;
  let success = 0;
  let failed = 0;
  
  console.log(`Processing in batches of ${BATCH_SIZE}...`);
  
  while (true) {
    const { rows } = await pool.query(`
      SELECT id, full_text 
      FROM judgments 
      WHERE full_text IS NOT NULL AND (formatted_text IS NULL OR format_version = 'v1' OR format_version IS NULL)
      LIMIT $1
    `, [BATCH_SIZE]);
    
    if (rows.length === 0) break;
    
    // Process batch in memory
    const updates = rows.map(row => {
      try {
        const formatted = formatJudgmentText(row.full_text);
        const integrity = verifyWordIntegrity(row.full_text, formatted);
        
        if (integrity.match) {
          return { id: row.id, formatted_text: formatted, format_version: 'v2', status: 'ok' };
        } else {
          return { id: row.id, status: 'fail_integrity' };
        }
      } catch (e) {
        return { id: row.id, status: 'error' };
      }
    });
    
    // Save successes
    const okUpdates = updates.filter(u => u.status === 'ok');
    
    if (okUpdates.length > 0) {
      // Build bulk update query
      const values = okUpdates.map((u, i) => `($${i*3 + 1}::uuid, $${i*3 + 2}::text, $${i*3 + 3}::varchar)`).join(', ');
      const flatParams = okUpdates.flatMap(u => [u.id, u.formatted_text, u.format_version]);
      
      const updateQuery = `
        UPDATE judgments AS j 
        SET formatted_text = v.formatted_text, format_version = v.format_version
        FROM (VALUES ${values}) AS v(id, formatted_text, format_version)
        WHERE j.id = v.id
      `;
      
      await pool.query(updateQuery, flatParams);
      success += okUpdates.length;
    }
    
    failed += (updates.length - okUpdates.length);
    processed += rows.length;
    
    console.log(`Progress: ${processed} / ${total} | Success: ${success} | Failed: ${failed} (${((processed/total)*100).toFixed(1)}%)`);
  }
  
  console.log("=== Batch Job Complete ===");
  console.log(`Total processed: ${processed}`);
  console.log(`Successfully updated: ${success}`);
  console.log(`Skipped (integrity fail/error): ${failed}`);
  process.exit(0);
}

main().catch(err => {
  console.error("Fatal error during batch:", err);
  process.exit(1);
});
