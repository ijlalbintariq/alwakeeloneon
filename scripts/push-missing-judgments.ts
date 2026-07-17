/**
 * push-missing-judgments.ts
 *
 * Reads judgments.jsonl, filters to only citations missing from the production DB,
 * and inserts them in batches.
 *
 * Usage:
 *   npx tsx scripts/push-missing-judgments.ts          # dry-run
 *   npx tsx scripts/push-missing-judgments.ts --live    # insert for real
 */

import "../server/load-env";
import { Pool } from "pg";
import * as fs from "fs";
import * as readline from "readline";

const LIVE = process.argv.includes("--live");
const JSONL_PATH = "/Users/macbook/Downloads/legal_scraper_data/judgments.jsonl";

// Strip null bytes that cause PostgreSQL UTF-8 errors
const sanitize = (s: string) => (s || "").replace(/\0/g, "");

interface JudgmentRecord {
  citation: string;
  title: string;
  court: string;
  year: string;
  journal: string;
  text: string;
  case_name?: string;
}

// Map court strings from scraper to court IDs in DB
const COURT_MAP: Record<string, { id: number; name: string }> = {
  "SUPREME-COURT": { id: 1, name: "Supreme Court of Pakistan" },
  "LAHORE-HIGH-COURT-LAHORE": { id: 2, name: "Lahore High Court" },
  "KARACHI-HIGH-COURT-SINDH": { id: 3, name: "High Court of Sindh" },
  "PESHAWAR-HIGH-COURT": { id: 4, name: "Peshawar High Court" },
  "QUETTA-HIGH-COURT-BALOCHISTAN": { id: 5, name: "High Court of Balochistan" },
  "ISLAMABAD": { id: 6, name: "Islamabad High Court" },
  "SUPREME-COURT-AZAD-KASHMIR": { id: 7, name: "Supreme Court of Azad Kashmir" },
  "FEDERAL-SHARIAT-COURT": { id: 8, name: "Federal Shariat Court" },
};

// Map journal codes to journal IDs in DB (from actual production data)
const JOURNAL_MAP: Record<string, number> = {
  "PLD": 1,
  "SCMR": 2,
  "PLJ": 3,
  "MLD": 4,
  "CLC": 5,
  "PCrLJ": 6,
  "PLC": 7,
  "YLR": 8,
  "NLR": 9,
  "CLD": 10,
  "PTD": 11,
  "PSC": 12,
  "SLR": 13,
  "LHC": 80,
  "IHC": 81,
  "SHC": 82,
  "PHC": 83,
  "BHC": 84,
  "AJKHC": 85,
  "PLC(CS)": 9961,
  "YLRN": 9962,
  "PCrLJN": 9963,
  "PCRLJN": 9963,
  "CLCN": 9964,
  "PLC(CS)N": 9965,
  "GBLR": 9966,
  "PLCN": 9967,
};

function parseCitationPage(citation: string): number | null {
  const parts = citation.trim().split(/\s+/);
  if (parts.length >= 3) {
    const p = parseInt(parts[parts.length - 1]);
    return isNaN(p) ? null : p;
  }
  return null;
}

function parseTitleParts(title: string): { petitioner: string; respondent: string } {
  // Try splitting on "VS" or "Versus"
  const vsMatch = title.match(/^(.+?)\s+(?:VS\.?|Versus|vs\.?)\s+(.+)/i);
  if (vsMatch) {
    return { petitioner: vsMatch[1].trim(), respondent: vsMatch[2].trim() };
  }
  return { petitioner: title, respondent: "" };
}

async function main() {
  console.log(`\n🔧 Mode: ${LIVE ? "🔴 LIVE — will INSERT" : "🟢 DRY-RUN — no writes"}\n`);

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  // 1. Load existing (year, journal_id, page) combos from DB — the true unique key
  console.log("🔍 Loading existing judgment keys from DB...");
  const existingRes = await pool.query(
    "SELECT year, journal_id, page FROM judgments"
  );
  const existingKeys = new Set(
    existingRes.rows.map((r: any) => `${r.year}:${r.journal_id}:${r.page}`)
  );
  console.log(`   Found ${existingKeys.size} existing entries\n`);

  // 2. Read JSONL and filter to missing only
  console.log("📂 Reading JSONL and filtering to missing cases...");
  const toInsert: JudgmentRecord[] = [];
  const rl = readline.createInterface({
    input: fs.createReadStream(JSONL_PATH),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const d: JudgmentRecord = JSON.parse(line);
      const citation = (d.citation || "").trim();
      if (!citation) continue;
      const year = parseInt(d.year) || 0;
      const journal = (d.journal || "").trim();
      const journalId = JOURNAL_MAP[journal] || null;
      const page = parseCitationPage(citation);
      const key = `${year}:${journalId}:${page}`;
      if (!existingKeys.has(key)) {
        toInsert.push(d);
      }
    } catch {
      // skip malformed lines
    }
  }

  console.log(`   📊 Missing cases to insert: ${toInsert.length}\n`);

  if (toInsert.length === 0) {
    console.log("✅ Nothing to insert — all cases already exist.");
    await pool.end();
    return;
  }

  if (!LIVE) {
    // Show breakdown
    const byYear: Record<string, number> = {};
    const byJournal: Record<string, number> = {};
    for (const d of toInsert) {
      byYear[d.year] = (byYear[d.year] || 0) + 1;
      byJournal[d.journal] = (byJournal[d.journal] || 0) + 1;
    }
    console.log("=== MISSING BY YEAR ===");
    for (const [y, c] of Object.entries(byYear).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 10)) {
      console.log(`  ${y}: ${c}`);
    }
    console.log("\n=== MISSING BY JOURNAL ===");
    for (const [j, c] of Object.entries(byJournal).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${j}: ${c}`);
    }
    console.log("\nℹ️  DRY RUN — no data written. Run with --live to insert.");
    await pool.end();
    return;
  }

  // 4. Insert in batches
  const BATCH_SIZE = 50;
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    const batch = toInsert.slice(i, i + BATCH_SIZE);

    for (const d of batch) {
      try {
        const citation = sanitize(d.citation.trim());
        const year = parseInt(d.year) || new Date().getFullYear();
        const journal = (d.journal || "").trim();
        const journalId = JOURNAL_MAP[journal] || null;
        const page = parseCitationPage(citation);
        const title = sanitize(d.title || "").slice(0, 500);
        const { petitioner, respondent } = parseTitleParts(title);
        const courtInfo = COURT_MAP[d.court] || null;
        const courtId = courtInfo?.id || null;
        const courtName = courtInfo?.name || sanitize(d.court || "");
        const fullText = sanitize(d.text || "");

        await pool.query(
          `INSERT INTO judgments (id, year, journal_id, page, citation_string, title, petitioner, respondent, court_id, court_name_snapshot, full_text, is_active, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, NOW(), NOW())`,
          [year, journalId, page, citation, title, sanitize(petitioner), sanitize(respondent), courtId, sanitize(courtName), fullText]
        );
        inserted++;
      } catch (err: any) {
        errors++;
        if (errors <= 10) {
          console.error(`   ❌ Error: "${d.citation}": ${err.message}`);
        }
      }
    }

    if ((i + BATCH_SIZE) % 500 === 0 || i + BATCH_SIZE >= toInsert.length) {
      console.log(`  📊 Progress: ${Math.min(i + BATCH_SIZE, toInsert.length)}/${toInsert.length} | inserted=${inserted} errors=${errors}`);
    }
  }

  // Final count
  const finalRes = await pool.query("SELECT COUNT(*) as cnt FROM judgments");
  console.log(`\n╔══════════════════════════════════════════════════════════╗`);
  console.log(`║  MISSING JUDGMENTS SYNC COMPLETE — ${LIVE ? "LIVE" : "DRY-RUN"}            ║`);
  console.log(`╚══════════════════════════════════════════════════════════╝`);
  console.log(`  📖 Total processed:    ${toInsert.length}`);
  console.log(`  ✅ Inserted:           ${inserted}`);
  console.log(`  ❌ Errors:             ${errors}`);
  console.log(`  📊 Total in DB now:    ${finalRes.rows[0].cnt}`);

  await pool.end();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
