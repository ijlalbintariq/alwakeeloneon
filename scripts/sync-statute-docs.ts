/**
 * sync-statute-docs.ts
 *
 * Uploads scraped statute documents to the statute_documents table.
 * Skips any document whose title already exists in the DB.
 *
 * Usage:
 *   npx tsx scripts/sync-statute-docs.ts          # dry-run
 *   npx tsx scripts/sync-statute-docs.ts --live    # insert for real
 */

import "../server/load-env";
import { Pool } from "pg";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename2 = fileURLToPath(import.meta.url);
const __dirname2 = path.dirname(__filename2);

const LIVE = process.argv.includes("--live");
const JSON_PATH = path.resolve(__dirname2, "../statute_docs_to_insert.json");

interface StatuteDoc {
  title: string;
  filename: string;
  content: string;
  category: string;
}

async function main() {
  console.log(`\n🔧 Mode: ${LIVE ? "🔴 LIVE — will INSERT" : "🟢 DRY-RUN — no writes"}\n`);

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  // Load prepared data
  console.log("📂 Loading prepared statute documents...");
  const allDocs: StatuteDoc[] = JSON.parse(fs.readFileSync(JSON_PATH, "utf-8"));
  console.log(`   Loaded ${allDocs.length} documents\n`);

  // Load existing titles from DB
  console.log("🔍 Loading existing statute_documents titles...");
  const existingRes = await pool.query("SELECT lower(trim(title)) as t FROM statute_documents");
  const existingTitles = new Set(existingRes.rows.map((r: any) => r.t));
  console.log(`   Found ${existingTitles.size} existing documents\n`);

  // Filter to missing only
  const toInsert = allDocs.filter(
    (d) => !existingTitles.has(d.title.toLowerCase().trim())
  );
  const skipped = allDocs.length - toInsert.length;
  console.log(`   📊 To insert: ${toInsert.length}`);
  console.log(`   ⏭️  Already exist: ${skipped}\n`);

  if (toInsert.length === 0) {
    console.log("✅ Nothing to insert — all documents already exist.");
    await pool.end();
    return;
  }

  if (!LIVE) {
    console.log("ℹ️  DRY RUN — no data written. Run with --live to insert.");
    await pool.end();
    return;
  }

  // Batch insert in chunks of 50
  const CHUNK_SIZE = 50;
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < toInsert.length; i += CHUNK_SIZE) {
    const chunk = toInsert.slice(i, i + CHUNK_SIZE);

    // Build multi-row VALUES
    const values: any[] = [];
    const placeholders: string[] = [];
    for (let j = 0; j < chunk.length; j++) {
      const offset = j * 4;
      placeholders.push(
        `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`
      );
      values.push(chunk[j].title, chunk[j].filename, chunk[j].content, chunk[j].category);
    }

    try {
      await pool.query(
        `INSERT INTO statute_documents (title, filename, content, category)
         VALUES ${placeholders.join(", ")}
         ON CONFLICT DO NOTHING`,
        values
      );
      inserted += chunk.length;
    } catch (err: any) {
      // Fallback: insert one by one
      for (const doc of chunk) {
        try {
          await pool.query(
            `INSERT INTO statute_documents (title, filename, content, category)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT DO NOTHING`,
            [doc.title, doc.filename, doc.content, doc.category]
          );
          inserted++;
        } catch (e2: any) {
          errors++;
          console.error(`   ❌ Error inserting "${doc.title}": ${e2.message}`);
        }
      }
    }

    if ((i + CHUNK_SIZE) % 500 === 0 || i + CHUNK_SIZE >= toInsert.length) {
      console.log(`  📊 Progress: ${Math.min(i + CHUNK_SIZE, toInsert.length)}/${toInsert.length} | inserted=${inserted} errors=${errors}`);
    }
  }

  // Final count
  const finalRes = await pool.query("SELECT COUNT(*) as cnt FROM statute_documents");
  console.log(`\n╔══════════════════════════════════════════════════════════╗`);
  console.log(`║  STATUTE DOCUMENTS SYNC COMPLETE — ${LIVE ? "LIVE" : "DRY-RUN"}             ║`);
  console.log(`╚══════════════════════════════════════════════════════════╝`);
  console.log(`  📖 Total docs processed: ${allDocs.length}`);
  console.log(`  ✅ New docs inserted:    ${inserted}`);
  console.log(`  ⏭️  Already existed:      ${skipped}`);
  console.log(`  ❌ Errors:               ${errors}`);
  console.log(`  📊 Total in DB now:      ${finalRes.rows[0].cnt}`);

  await pool.end();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
