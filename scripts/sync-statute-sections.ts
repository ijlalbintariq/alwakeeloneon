/**
 * sync-statute-sections.ts
 *
 * Uploads parsed statute sections to the statutes table.
 * Uses ON CONFLICT DO NOTHING on the (short_title, section) unique index.
 *
 * Usage:
 *   npx tsx scripts/sync-statute-sections.ts          # dry-run
 *   npx tsx scripts/sync-statute-sections.ts --live    # insert for real
 */

import "../server/load-env";
import { Pool } from "pg";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename2 = fileURLToPath(import.meta.url);
const __dirname2 = path.dirname(__filename2);

const LIVE = process.argv.includes("--live");
const JSON_PATH = path.resolve(__dirname2, "../statute_sections_to_insert.json");

interface StatuteSection {
  shortTitle: string;
  section: string;
  description: string;
  punishment: string;
}

async function main() {
  console.log(`\n🔧 Mode: ${LIVE ? "🔴 LIVE — will INSERT" : "🟢 DRY-RUN — no writes"}\n`);

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  // Load prepared data
  console.log("📂 Loading prepared statute sections...");
  const allSections: StatuteSection[] = JSON.parse(fs.readFileSync(JSON_PATH, "utf-8"));
  console.log(`   Loaded ${allSections.length} sections\n`);

  // Load existing (shortTitle, section) pairs from DB
  console.log("🔍 Loading existing statutes (shortTitle, section) pairs...");
  const existingRes = await pool.query(
    "SELECT lower(trim(short_title)) || '|||' || lower(trim(section)) as k FROM statutes"
  );
  const existingKeys = new Set(existingRes.rows.map((r: any) => r.k));
  console.log(`   Found ${existingKeys.size} existing sections\n`);

  // Filter to missing only
  const toInsert = allSections.filter((s) => {
    const key = `${s.shortTitle.toLowerCase().trim()}|||${s.section.toLowerCase().trim()}`;
    return !existingKeys.has(key);
  });
  const skipped = allSections.length - toInsert.length;
  console.log(`   📊 To insert: ${toInsert.length}`);
  console.log(`   ⏭️  Already exist: ${skipped}\n`);

  if (toInsert.length === 0) {
    console.log("✅ Nothing to insert — all sections already exist.");
    await pool.end();
    return;
  }

  if (!LIVE) {
    console.log("ℹ️  DRY RUN — no data written. Run with --live to insert.");
    await pool.end();
    return;
  }

  // Strip null bytes that cause PostgreSQL UTF-8 errors
  const sanitize = (s: string) => s.replace(/\0/g, "");

  // Batch insert in chunks of 100
  const CHUNK_SIZE = 100;
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < toInsert.length; i += CHUNK_SIZE) {
    const chunk = toInsert.slice(i, i + CHUNK_SIZE);

    const values: any[] = [];
    const placeholders: string[] = [];
    for (let j = 0; j < chunk.length; j++) {
      const offset = j * 4;
      placeholders.push(
        `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`
      );
      values.push(
        sanitize(chunk[j].shortTitle),
        sanitize(chunk[j].section),
        sanitize(chunk[j].description),
        sanitize(chunk[j].punishment)
      );
    }

    try {
      const res = await pool.query(
        `INSERT INTO statutes (short_title, section, description, punishment)
         VALUES ${placeholders.join(", ")}
         ON CONFLICT (short_title, section) DO NOTHING`,
        values
      );
      inserted += res.rowCount || 0;
    } catch (err: any) {
      // Fallback: insert one by one
      for (const sec of chunk) {
        try {
          const res = await pool.query(
            `INSERT INTO statutes (short_title, section, description, punishment)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (short_title, section) DO NOTHING`,
            [sanitize(sec.shortTitle), sanitize(sec.section), sanitize(sec.description), sanitize(sec.punishment)]
          );
          inserted += res.rowCount || 0;
        } catch (e2: any) {
          errors++;
          if (errors <= 5) {
            console.error(`   ❌ Error: "${sec.shortTitle}" §${sec.section}: ${e2.message}`);
          }
        }
      }
    }

    if ((i + CHUNK_SIZE) % 5000 === 0 || i + CHUNK_SIZE >= toInsert.length) {
      console.log(`  📊 Progress: ${Math.min(i + CHUNK_SIZE, toInsert.length)}/${toInsert.length} | inserted=${inserted} errors=${errors}`);
    }
  }

  // Final count
  const finalRes = await pool.query("SELECT COUNT(*) as cnt FROM statutes");
  console.log(`\n╔══════════════════════════════════════════════════════════╗`);
  console.log(`║  STATUTE SECTIONS SYNC COMPLETE — ${LIVE ? "LIVE" : "DRY-RUN"}              ║`);
  console.log(`╚══════════════════════════════════════════════════════════╝`);
  console.log(`  📖 Total sections processed: ${allSections.length}`);
  console.log(`  ✅ New sections inserted:    ${inserted}`);
  console.log(`  ⏭️  Already existed:          ${skipped}`);
  console.log(`  ❌ Errors:                   ${errors}`);
  console.log(`  📊 Total in DB now:          ${finalRes.rows[0].cnt}`);

  await pool.end();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
