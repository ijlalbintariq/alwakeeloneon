/**
 * push-missing-judgments-v2.ts
 *
 * Reads /tmp/missing_judgments_to_upload.json and uploads
 * the records to Neon PostgreSQL in parallel batches.
 *
 * Usage:
 *   npx tsx scripts/push-missing-judgments-v2.ts          # dry-run
 *   npx tsx scripts/push-missing-judgments-v2.ts --live   # live upload
 */

import "../server/load-env";
import { Pool } from "pg";
import * as fs from "fs";

const LIVE = process.argv.includes("--live");
const JSON_PATH = "/tmp/missing_judgments_to_upload.json";

async function main() {
  console.log(`\n=============================================================`);
  console.log(`🚀 NEON POSTGRESQL JUDGMENTS UPLOADER: ${LIVE ? "🔴 LIVE MODE" : "🟢 DRY RUN"}`);
  console.log(`=============================================================\n`);

  if (!fs.existsSync(JSON_PATH)) {
    console.error(`❌ Payload file not found at ${JSON_PATH}. Run scripts/export-sqlite-missing.py first.`);
    process.exit(1);
  }

  console.log(`📂 Reading payload from ${JSON_PATH}...`);
  const rawData = fs.readFileSync(JSON_PATH, "utf-8");
  const toInsert: Array<{
    year: number;
    journalId: number;
    page: number;
    citationString: string;
    title: string;
    petitioner: string | null;
    respondent: string | null;
    courtId: number | null;
    courtNameSnapshot: string | null;
    fullText: string;
  }> = JSON.parse(rawData);

  console.log(`   Loaded ${toInsert.length} prepared judgments (${(fs.statSync(JSON_PATH).size / (1024 * 1024)).toFixed(1)} MB)\n`);

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 25,
    connectionTimeoutMillis: 30000,
    idleTimeoutMillis: 30000,
  });

  if (!LIVE) {
    console.log("=== Sample Record Preview ===");
    console.log(JSON.stringify(toInsert[0], (k, v) => (k === "fullText" ? `${String(v).slice(0, 100)}...` : v), 2));
    console.log(`\nℹ️  DRY RUN complete. ${toInsert.length} records ready to be inserted. Run with --live to start upload.`);
    await pool.end();
    return;
  }

  console.log(`📥 Starting live insertion of ${toInsert.length} judgments in concurrent batches...`);
  const BATCH_SIZE = 50;
  let inserted = 0;
  let skipped = 0;
  let errors = 0;
  const startTime = Date.now();

  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    const batch = toInsert.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (doc) => {
        try {
          const res = await pool.query(
            `
            INSERT INTO judgments (
              id, year, journal_id, page, citation_string, title,
              petitioner, respondent, court_id, court_name_snapshot,
              full_text, is_active, created_at, updated_at
            ) VALUES (
              gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, NOW(), NOW()
            )
            ON CONFLICT (year, journal_id, page) DO NOTHING
          `,
            [
              doc.year,
              doc.journalId,
              doc.page,
              doc.citationString,
              doc.title,
              doc.petitioner,
              doc.respondent,
              doc.courtId,
              doc.courtNameSnapshot,
              doc.fullText,
            ]
          );

          if (res.rowCount && res.rowCount > 0) {
            inserted++;
          } else {
            skipped++;
          }
        } catch (err: any) {
          errors++;
          if (errors <= 5) {
            console.error(`   ❌ Error on "${doc.citationString}":`, err.message);
          }
        }
      })
    );

    const doneCount = Math.min(i + BATCH_SIZE, toInsert.length);
    const pct = ((doneCount / toInsert.length) * 100).toFixed(1);
    const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
    const speed = (doneCount / (parseFloat(elapsedSec) || 1)).toFixed(1);

    if (doneCount % 500 === 0 || doneCount >= toInsert.length) {
      console.log(
        `   📊 [${pct.padStart(5)}%] ${doneCount.toString().padStart(6)}/${toInsert.length} | inserted: ${inserted} | skipped: ${skipped} | err: ${errors} | ${elapsedSec}s (${speed} docs/s)`
      );
    }
  }

  const finalRes = await pool.query("SELECT COUNT(*) as cnt FROM judgments");
  console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
  console.log(`║  🎉 UPLOAD COMPLETE — NEON DATABASE UPDATED                    ║`);
  console.log(`╚════════════════════════════════════════════════════════════════╝`);
  console.log(`  📖 Processed:          ${toInsert.length}`);
  console.log(`  ✅ Successfully Added: ${inserted}`);
  console.log(`  ⏭️  Skipped (Existing): ${skipped}`);
  console.log(`  ❌ Errors:             ${errors}`);
  console.log(`  📊 Total Judgments in Neon: ${finalRes.rows[0].cnt}`);

  await pool.end();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
