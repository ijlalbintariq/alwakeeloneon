/**
 * Targeted sync — push ONLY missing 2026 cases to Neon.
 * Reads from the pre-filtered 2026_only.jsonl (1,253 records).
 *
 * Usage:
 *   npx tsx scripts/sync-2026-only.ts              (dry-run)
 *   npx tsx scripts/sync-2026-only.ts --live        (actual insert)
 */

import "../server/load-env";
import { Pool } from "pg";
import * as fs from "fs";
import * as readline from "readline";
import * as path from "path";
import { fileURLToPath } from "url";
import { db } from "../server/db";
import { judgments, lawJournals, courtsRef } from "../shared/schema";
import { sql } from "drizzle-orm";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const JSONL_PATH = path.resolve(__dirname, "../2026_only.jsonl");
const BATCH_SIZE = 50;
const IS_LIVE = process.argv.includes("--live");

const JOURNAL_CODE_MAP: Record<string, string> = {
  PCrLJ:     "PCRLJ",
  "PLC(CS)": "PLC(CS)",
};

function mapCourtId(courtStr: string, courtMap: Map<string, number>): number | null {
  const s = (courtStr || "").toUpperCase();
  if (s.includes("SUPREME-COURT") || s.includes("SUPREME COURT")) return courtMap.get("SC") ?? null;
  if (s.includes("ISLAMABAD"))                                      return courtMap.get("IHC") ?? null;
  if (s.includes("LAHORE-HIGH-COURT") || s.includes("LHC") || s.includes("LAHORE")) return courtMap.get("LHC") ?? null;
  if (s.includes("KARACHI-HIGH-COURT") || s.includes("SINDH") || s.includes("KARACHI")) return courtMap.get("SHC") ?? null;
  if (s.includes("PESHAWAR-HIGH-COURT") || s.includes("PHC") || s.includes("PESHAWAR")) return courtMap.get("PHC") ?? null;
  if (s.includes("QUETTA-HIGH-COURT") || s.includes("BALOCHISTAN") || s.includes("QUETTA")) return courtMap.get("BHC") ?? null;
  if (s.includes("FEDERAL-SHARIAT") || s.includes("FSC"))          return courtMap.get("FSC") ?? null;
  return null;
}

function parsePage(citation: string): number | null {
  if (!citation) return null;
  const parts = citation.trim().split(/\s+/);
  const last = parts[parts.length - 1];
  const n = parseInt(last, 10);
  return isNaN(n) ? null : n;
}

function splitTitle(title: string): { petitioner: string | null; respondent: string | null } {
  const separators = [" VS ", " V. ", " VERSUS ", " vs ", " v. ", " versus "];
  for (const sep of separators) {
    const idx = title.indexOf(sep);
    if (idx !== -1) {
      return {
        petitioner: title.slice(0, idx).trim().slice(0, 500) || null,
        respondent: title.slice(idx + sep.length).trim().slice(0, 500) || null,
      };
    }
  }
  return { petitioner: null, respondent: null };
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log(`║  2026-ONLY Sync — ${IS_LIVE ? "🔴 LIVE MODE" : "🟡 DRY-RUN (no writes)"}              ║`);
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  if (!fs.existsSync(JSONL_PATH)) {
    console.error(`❌ JSONL file not found: ${JSONL_PATH}`);
    process.exit(1);
  }

  // Load lookups
  const journalRows = await db.select().from(lawJournals);
  const journalCodeToId = new Map<string, number>(journalRows.map((j) => [j.code, j.id]));
  console.log(`📰 Loaded ${journalCodeToId.size} journals`);

  const courtRows = await db.select().from(courtsRef);
  const courtCodeToId = new Map<string, number>(courtRows.map((c) => [c.code, c.id]));
  console.log(`🏛️  Loaded ${courtCodeToId.size} courts`);

  // Load existing 2026 keys
  console.log("🔍 Loading existing 2026 judgment keys...");
  const existingRows = await db.execute(
    sql`SELECT year, journal_id, page FROM judgments WHERE year = 2026`
  );
  const existingKeys = new Set<string>(
    existingRows.rows.map((r: any) => `${r.year}:${r.journal_id}:${r.page}`)
  );
  console.log(`   Found ${existingKeys.size} existing 2026 judgments\n`);

  let totalRead = 0;
  let totalNew = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  let batch: any[] = [];

  const insertBatch = async (rows: any[]) => {
    if (!IS_LIVE || rows.length === 0) return;
    const fields = 11;
    const valuePlaceholders = rows
      .map((_, i) =>
        `($${i * fields + 1},$${i * fields + 2},$${i * fields + 3},$${i * fields + 4},$${i * fields + 5},$${i * fields + 6},$${i * fields + 7},$${i * fields + 8},$${i * fields + 9},$${i * fields + 10},$${i * fields + 11})`
      )
      .join(",");
    const params = rows.flatMap((r) => [
      r.year, r.journalId, r.page, r.citationString,
      r.title, r.petitioner, r.respondent,
      r.fullText, r.courtId, r.courtNameSnapshot, true,
    ]);
    const queryText = `
      INSERT INTO judgments
        (year, journal_id, page, citation_string, title, petitioner, respondent, full_text, court_id, court_name_snapshot, is_active)
      VALUES ${valuePlaceholders}
      ON CONFLICT (year, journal_id, page) DO NOTHING
    `;
    try {
      await pool.query(queryText, params);
    } catch (err: any) {
      console.error(`  ⚠️  Batch insert failed, retrying row-by-row...`);
      for (const r of rows) {
        try {
          await pool.query(
            `INSERT INTO judgments
              (year, journal_id, page, citation_string, title, petitioner, respondent, full_text, court_id, court_name_snapshot, is_active)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
             ON CONFLICT (year, journal_id, page) DO NOTHING`,
            [r.year, r.journalId, r.page, r.citationString, r.title, r.petitioner, r.respondent,
             r.fullText, r.courtId, r.courtNameSnapshot, true]
          );
        } catch (rowErr: any) {
          totalErrors++;
          console.error(`  ❌ Failed: ${r.citationString} — ${(rowErr as Error).message?.slice(0, 100)}`);
        }
      }
    }
  };

  const rl = readline.createInterface({
    input: fs.createReadStream(JSONL_PATH, { encoding: "utf-8" }),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line.trim()) continue;
    totalRead++;

    let record: any;
    try {
      record = JSON.parse(line);
    } catch {
      totalErrors++;
      continue;
    }

    const rawJournalCode = record.journal as string;
    const mappedCode = JOURNAL_CODE_MAP[rawJournalCode] ?? rawJournalCode;
    const journalId = journalCodeToId.get(mappedCode);
    if (!journalId) {
      console.warn(`  ⚠️  Unknown journal: "${rawJournalCode}" — ${record.citation}`);
      totalSkipped++;
      continue;
    }

    const year = 2026;
    const page = parsePage(record.citation as string);
    if (!page) {
      totalSkipped++;
      continue;
    }

    const key = `${year}:${journalId}:${page}`;
    if (existingKeys.has(key)) {
      totalSkipped++;
      continue;
    }

    const courtId = mapCourtId(record.court as string, courtCodeToId);
    const title = ((record.title as string) || "").slice(0, 1000);
    const { petitioner, respondent } = splitTitle(title);
    const fullText = ((record.text as string) || "").slice(0, 500_000);

    batch.push({
      year, journalId, page,
      citationString: ((record.citation as string) || "").slice(0, 200),
      title, petitioner, respondent,
      fullText, courtId,
      courtNameSnapshot: ((record.court as string) || "").slice(0, 200),
    });

    existingKeys.add(key);
    totalNew++;

    if (batch.length >= BATCH_SIZE) {
      await insertBatch(batch);
      batch = [];
      console.log(`  📊 Progress: ${totalNew} new | ${totalSkipped} skipped | ${totalErrors} errors`);
    }
  }

  // Flush remaining
  if (batch.length > 0) {
    await insertBatch(batch);
  }

  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log(`║  2026 SYNC COMPLETE — ${IS_LIVE ? "LIVE" : "DRY-RUN"}                             ║`);
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`  📖  Total 2026 records read : ${totalRead}`);
  console.log(`  ✅  New records inserted    : ${totalNew}`);
  console.log(`  ⏭️   Already existed (skip)  : ${totalSkipped}`);
  console.log(`  ❌  Errors                  : ${totalErrors}`);
  if (!IS_LIVE) {
    console.log(`\n  ℹ️  DRY RUN — no data written. Run with --live to insert.`);
  }
  await pool.end();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
