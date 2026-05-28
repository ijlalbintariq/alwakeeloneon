/**
 * Phase 2 — Main Sync Script
 * Streams all 187,931 judgments from local JSONL → inserts into Neon PostgreSQL.
 * Strategy: ON CONFLICT (year, journal_id, page) DO NOTHING — skips duplicates safely.
 *
 * Usage:
 *   npx tsx scripts/db-sync/02-sync-all-judgments.ts              (dry-run, no writes)
 *   npx tsx scripts/db-sync/02-sync-all-judgments.ts --live       (actual insert)
 */

import "../../server/load-env";
import { Pool } from "pg";
import * as fs from "fs";
import * as readline from "readline";
import * as path from "path";
import { db } from "../../server/db";
import { judgments, lawJournals, courtsRef } from "../../shared/schema";
import { sql } from "drizzle-orm";

// Native pg pool for high-throughput bulk inserts
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

// ─── Config ──────────────────────────────────────────────────────────────────
const JSONL_PATH = path.resolve(
  process.env.HOME!,
  "Downloads/legal_scraper_data/judgments.jsonl"
);
const BATCH_SIZE = 100;
const IS_LIVE = process.argv.includes("--live");

// ─── Journal Code Mapping (scraped → Neon code) ───────────────────────────
// Some scraped codes differ slightly from Neon codes
const JOURNAL_CODE_MAP: Record<string, string> = {
  PCrLJ:     "PCRLJ",
  "PLC(CS)": "PLC(CS)",
  YLRN:      "YLRN",
  PCRLJN:    "PCRLJN",
  CLCN:      "CLCN",
  "PLC(CS)N":"PLC(CS)N",
  GBLR:      "GBLR",
  PLCN:      "PLCN",
};

// ─── Court Name → court_id Mapping ───────────────────────────────────────
function mapCourtId(
  courtStr: string,
  courtMap: Map<string, number>
): number | null {
  const s = (courtStr || "").toUpperCase();
  if (s.includes("SUPREME-COURT") || s.includes("SUPREME COURT")) return courtMap.get("SC") ?? null;
  if (s.includes("ISLAMABAD"))                                      return courtMap.get("IHC") ?? null;
  if (s.includes("LAHORE-HIGH-COURT") || s.includes("LHC"))        return courtMap.get("LHC") ?? null;
  if (s.includes("KARACHI-HIGH-COURT") || s.includes("SINDH"))     return courtMap.get("SHC") ?? null;
  if (s.includes("PESHAWAR-HIGH-COURT") || s.includes("PHC"))      return courtMap.get("PHC") ?? null;
  if (s.includes("QUETTA-HIGH-COURT") || s.includes("BALOCHISTAN"))return courtMap.get("BHC") ?? null;
  if (s.includes("FEDERAL-SHARIAT") || s.includes("FSC"))          return courtMap.get("FSC") ?? null;
  return null; // tribunals, India courts, etc. → no court_id
}

// ─── Parse page number from citation string ────────────────────────────────
// e.g. "2026 CLC 1" → 1   |   "2026 PCrLJ 123" → 123
function parsePage(citation: string): number | null {
  if (!citation) return null;
  const parts = citation.trim().split(/\s+/);
  const last = parts[parts.length - 1];
  const n = parseInt(last, 10);
  return isNaN(n) ? null : n;
}

// ─── Split title into petitioner / respondent ─────────────────────────────
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

// ─── Main ─────────────────────────────────────────────────────────────────
async function main() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log(`║  Alwakeelo DB Sync — ${IS_LIVE ? "🔴 LIVE MODE" : "🟡 DRY-RUN MODE (no writes)"}         ║`);
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  if (!fs.existsSync(JSONL_PATH)) {
    console.error(`❌ JSONL file not found at: ${JSONL_PATH}`);
    process.exit(1);
  }
  const fileSizeMB = (fs.statSync(JSONL_PATH).size / 1024 / 1024).toFixed(0);
  console.log(`📂 Source: ${JSONL_PATH} (${fileSizeMB} MB)\n`);

  // ── 1. Load journal map from Neon ──────────────────────────────────────
  const journalRows = await db.select().from(lawJournals);
  const journalCodeToId = new Map<string, number>(
    journalRows.map((j) => [j.code, j.id])
  );
  console.log(`📰 Loaded ${journalCodeToId.size} journals from Neon\n`);

  // ── 2. Load court map from Neon ────────────────────────────────────────
  const courtRows = await db.select().from(courtsRef);
  const courtCodeToId = new Map<string, number>(
    courtRows.map((c) => [c.code, c.id])
  );
  console.log(`🏛️  Loaded ${courtCodeToId.size} courts from Neon\n`);

  // ── 3. Load existing (year, journal_id, page) keys from Neon ──────────
  console.log("🔍 Loading existing judgment keys from Neon (for conflict detection)...");
  const existingRows = await db.execute(
    sql`SELECT year, journal_id, page FROM judgments`
  );
  const existingKeys = new Set<string>(
    existingRows.rows.map((r: any) => `${r.year}:${r.journal_id}:${r.page}`)
  );
  console.log(`   Found ${existingKeys.size.toLocaleString()} existing judgments in Neon\n`);

  // ── 4. Stream JSONL and collect new records ────────────────────────────
  console.log("📖 Streaming JSONL file...\n");

  let totalRead     = 0;
  let totalInserted = 0;
  let totalSkipped  = 0;
  let totalErrors   = 0;
  let totalNoJournal = 0;
  let totalNoPage   = 0;

  let batch: any[] = [];

  const insertBatch = async (rows: any[]) => {
    if (!IS_LIVE || rows.length === 0) return;
    // Build a single multi-row parameterized INSERT using native pg
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
      // Retry row-by-row if batch fails (e.g. oversized text)
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

    // Map journal code
    const rawJournalCode = record.journal as string;
    const mappedCode = JOURNAL_CODE_MAP[rawJournalCode] ?? rawJournalCode;
    const journalId = journalCodeToId.get(mappedCode);
    if (!journalId) {
      totalNoJournal++;
      totalSkipped++;
      if (totalNoJournal <= 5) {
        console.warn(`  ⚠️  Unknown journal: "${rawJournalCode}" in record ${record.case_name}`);
      }
      continue;
    }

    // Parse year and page
    const year = parseInt(record.year as string, 10);
    const page = parsePage(record.citation as string);
    if (!page || isNaN(year) || year < 1900 || year > 2030) {
      totalNoPage++;
      totalSkipped++;
      continue;
    }

    // Check conflict
    const key = `${year}:${journalId}:${page}`;
    if (existingKeys.has(key)) {
      totalSkipped++;
      continue;
    }

    // Map court
    const courtId = mapCourtId(record.court as string, courtCodeToId);

    // Split title
    const title = ((record.title as string) || "").slice(0, 1000);
    const { petitioner, respondent } = splitTitle(title);

    // Clean full text (remove header lines added by export script)
    const rawText = (record.text as string) || "";
    const fullText = rawText.slice(0, 500_000); // cap at 500KB per record

    batch.push({
      year,
      journalId,
      page,
      citationString: ((record.citation as string) || "").slice(0, 200),
      title,
      petitioner,
      respondent,
      fullText,
      courtId,
      courtNameSnapshot: ((record.court as string) || "").slice(0, 200),
    });

    // Mark as known to prevent duplicates within the batch itself
    existingKeys.add(key);
    totalInserted++;

    // Flush batch
    if (batch.length >= BATCH_SIZE) {
      await insertBatch(batch);
      batch = [];
    }

    // Progress report every 5000 records
    if (totalRead % 5000 === 0) {
      console.log(
        `  📊 Read: ${totalRead.toLocaleString()} | ` +
        `New: ${totalInserted.toLocaleString()} | ` +
        `Skipped: ${totalSkipped.toLocaleString()} | ` +
        `Errors: ${totalErrors}`
      );
    }
  }

  // Flush remaining batch
  if (batch.length > 0) {
    await insertBatch(batch);
  }

  // ── 5. Final report ────────────────────────────────────────────────────
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log(`║  SYNC COMPLETE — ${IS_LIVE ? "LIVE" : "DRY-RUN"}                                    ║`);
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`  📖  Total records read    : ${totalRead.toLocaleString()}`);
  console.log(`  ✅  New records (inserted) : ${totalInserted.toLocaleString()}`);
  console.log(`  ⏭️   Conflicts skipped      : ${totalSkipped.toLocaleString()}`);
  console.log(`  ⚠️   Unknown journals       : ${totalNoJournal.toLocaleString()}`);
  console.log(`  ❌  Errors                 : ${totalErrors.toLocaleString()}`);
  if (!IS_LIVE) {
    console.log(
      `\n  ℹ️  This was a DRY RUN. No data was written to Neon.`
    );
    console.log(`  ℹ️  To run live: npx tsx scripts/db-sync/02-sync-all-judgments.ts --live`);
  }
  await pool.end();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
