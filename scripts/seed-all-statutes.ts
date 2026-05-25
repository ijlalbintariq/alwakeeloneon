import "../server/load-env";
import { db, pool } from "../server/db";
import { statutes } from "../shared/schema";
import * as fs from "fs/promises";
import * as path from "path";
import { and, ilike } from "drizzle-orm";

type StatuteEntry = {
  shortTitle: string;
  section: string;
  description: string;
  punishment: string;
};

async function main() {
  console.log("==========================================");
  console.log("🚀 STARTING IDEMPOTENT STATUTE BULK SEEDER");
  console.log("==========================================");

  // 1. Read parsed sections from JSON
  const jsonPath = path.resolve(process.cwd(), "parsed_sections.json");
  let parsedSections: StatuteEntry[] = [];
  try {
    const rawData = await fs.readFile(jsonPath, "utf-8");
    parsedSections = JSON.parse(rawData);
    console.log(`Loaded ${parsedSections.length} parsed sections from: ${jsonPath}`);
  } catch (err: any) {
    console.error(`Failed to read parsed sections from ${jsonPath}:`, err?.message || err);
    process.exit(1);
  }

  // 2. Fetch all existing statutes from the database to build a fast in-memory lookup cache
  console.log("Fetching existing statutes from database...");
  const existingRows = await db.select({
    shortTitle: statutes.shortTitle,
    section: statutes.section
  }).from(statutes);

  console.log(`Found ${existingRows.length} existing statutes in the database.`);

  const cacheKey = (shortTitle: string, section: string) => 
    `${shortTitle.toLowerCase().trim()}|${section.toLowerCase().trim()}`;

  const existingSet = new Set<string>();
  for (const row of existingRows) {
    existingSet.add(cacheKey(row.shortTitle, row.section));
  }

  // 3. Filter out entries that already exist in the database
  const toInsert: StatuteEntry[] = [];
  let skipped = 0;

  for (const entry of parsedSections) {
    const key = cacheKey(entry.shortTitle, entry.section);
    if (existingSet.has(key)) {
      skipped++;
    } else {
      toInsert.push(entry);
    }
  }

  console.log(`Filtering complete:`);
  console.log(`  ⏭️  Already exist (will skip): ${skipped}`);
  console.log(`  ➕  New statutes to insert:    ${toInsert.length}`);

  if (toInsert.length === 0) {
    console.log("No new statutes to seed. Database is up to date.");
    if (pool) await pool.end();
    return;
  }

  // 4. Batch-insert new statutes inside a database transaction block to ensure atomic seeding
  console.log(`Inserting ${toInsert.length} new statutes inside a transaction...`);
  const chunkSize = 100;
  let inserted = 0;

  try {
    await db.transaction(async (tx) => {
      for (let i = 0; i < toInsert.length; i += chunkSize) {
        const chunk = toInsert.slice(i, i + chunkSize);
        // Use onConflictDoNothing to guarantee idempotence and concurrent safety
        await tx.insert(statutes).values(chunk).onConflictDoNothing();
        inserted += chunk.length;
        if (inserted % 500 === 0 || inserted === toInsert.length) {
          console.log(`  ✅ ${inserted}/${toInsert.length} new records processed in transaction...`);
        }
      }
    });

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📊 SEEDING EXECUTION SUMMARY`);
    console.log(`  ✅ Successfully Processed/Seeded: ${inserted}`);
    console.log(`  ⏭️  Skipped (Existing Lookup):     ${skipped}`);
    console.log(`  📈 Final Total in file:            ${parsedSections.length}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  } catch (err: any) {
    console.error("❌ Seeding transaction failed and was rolled back:", err?.message || err);
    if (pool) await pool.end();
    process.exit(1);
  }

  if (pool) await pool.end();
  process.exit(0);
}

main().catch(async (err) => {
  console.error("Fatal Seeding Error:", err);
  if (pool) await pool.end();
  process.exit(1);
});
