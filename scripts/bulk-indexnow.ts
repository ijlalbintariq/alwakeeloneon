/**
 * Bulk IndexNow Submission Script
 *
 * Submits all 223k+ judgment URLs to IndexNow (Bing/Yandex) for instant indexing.
 * No daily quota — can submit 10,000 URLs per batch.
 *
 * Usage:
 *   node --env-file=.env --import tsx scripts/bulk-indexnow.ts              # Submit all unsubmitted
 *   node --env-file=.env --import tsx scripts/bulk-indexnow.ts --dry-run    # Preview without submitting
 *   node --env-file=.env --import tsx scripts/bulk-indexnow.ts --limit 5000 # Limit URLs
 *   node --env-file=.env --import tsx scripts/bulk-indexnow.ts --status     # Check progress
 *   node --env-file=.env --import tsx scripts/bulk-indexnow.ts --reset      # Reset cursor, start over
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import { submitToIndexNow } from "../server/indexnow.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CANONICAL_ORIGIN = "https://www.alwakeelo.com";
const STATE_FILE = path.resolve(__dirname, "db-sync/indexnow-state.json");
const BATCH_SIZE = 10_000;
const DELAY_BETWEEN_BATCHES_MS = 12_000; // 12s between batches (be polite)

// ── State ────────────────────────────────────────────────────────────────────
interface State {
  lastCursor: string | null;
  totalSubmitted: number;
  lastRunAt: string | null;
  staticSubmitted: boolean;
}

function loadState(): State {
  try {
    if (fs.existsSync(STATE_FILE)) return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
  } catch { /* fresh */ }
  return { lastCursor: null, totalSubmitted: 0, lastRunAt: null, staticSubmitted: false };
}

function saveState(state: State): void {
  const dir = path.dirname(STATE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ── URL generators ───────────────────────────────────────────────────────────
function getStaticUrls(): string[] {
  return [
    "/", "/judgments", "/judgments/browse", "/statute-search",
    "/al-wakeelo", "/legal-drafting", "/contract-drafting",
    "/citation-search", "/install", "/privacy", "/terms",
    "/cancellation-return-refund-policy", "/ownership-statement",
  ].map((p) => `${CANONICAL_ORIGIN}${p}`);
}

async function getJudgmentBatch(
  pool: pg.Pool,
  cursor: string | null,
  limit: number,
): Promise<{ urls: string[]; lastCursor: string | null; total: number }> {
  const countResult = await pool.query(
    "SELECT count(*)::int as total FROM judgments WHERE is_active = true",
  );
  const total = countResult.rows[0].total;

  const query = cursor
    ? "SELECT id FROM judgments WHERE is_active = true AND id > $1 ORDER BY id ASC LIMIT $2"
    : "SELECT id FROM judgments WHERE is_active = true ORDER BY id ASC LIMIT $1";
  const params = cursor ? [cursor, limit] : [limit];
  const result = await pool.query(query, params);

  const urls = result.rows.map((r: any) => `${CANONICAL_ORIGIN}/judgment/${r.id}`);
  const last = result.rows.length > 0 ? result.rows[result.rows.length - 1].id : null;
  return { urls, lastCursor: last, total };
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const statusOnly = args.includes("--status");
  const reset = args.includes("--reset");
  const limitIdx = args.indexOf("--limit");
  const maxUrls = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : Infinity;

  const state = loadState();

  if (reset) {
    const fresh: State = { lastCursor: null, totalSubmitted: 0, lastRunAt: null, staticSubmitted: false };
    saveState(fresh);
    console.log("✅ State reset. Next run will start from the beginning.");
    return;
  }

  if (statusOnly) {
    console.log("\n📊 IndexNow Bulk Submission Status");
    console.log("━".repeat(50));
    console.log(`  Total submitted:  ${state.totalSubmitted}`);
    console.log(`  Last cursor:      ${state.lastCursor || "(start)"}`);
    console.log(`  Last run:         ${state.lastRunAt || "(never)"}`);
    console.log(`  Static pages:     ${state.staticSubmitted ? "✅" : "❌ not yet"}`);
    console.log(`  State file:       ${STATE_FILE}`);
    console.log("━".repeat(50));
    return;
  }

  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  console.log("🚀 IndexNow Bulk Submission — alwakeelo.com");
  console.log("━".repeat(55));
  if (dryRun) console.log("  Mode: DRY RUN");
  console.log(`  Previous submissions: ${state.totalSubmitted}`);
  console.log(`  Cursor: ${state.lastCursor || "(start)"}`);

  // Step 1: Static pages (once)
  if (!state.staticSubmitted) {
    const staticUrls = getStaticUrls();
    console.log(`\n🏛️  Static pages: ${staticUrls.length} URLs`);
    if (!dryRun) {
      const result = await submitToIndexNow(staticUrls);
      console.log(`  → Submitted: ${result.submitted}, Errors: ${result.errors}`);
      if (result.submitted > 0) {
        state.staticSubmitted = true;
        state.totalSubmitted += result.submitted;
      }
    } else {
      console.log("  → [DRY RUN] Would submit:", staticUrls.slice(0, 3).join(", "), "...");
    }
  }

  // Step 2: Judgments in batches
  let batchNum = 0;
  let totalThisRun = 0;

  while (totalThisRun < maxUrls) {
    const batchLimit = Math.min(BATCH_SIZE, maxUrls - totalThisRun);
    const { urls, lastCursor, total } = await getJudgmentBatch(pool, state.lastCursor, batchLimit);

    if (urls.length === 0) {
      console.log("\n✅ All judgments submitted! No more pages.");
      break;
    }

    batchNum += 1;
    const remaining = total - state.totalSubmitted;
    console.log(
      `\n⚖️  Batch ${batchNum}: ${urls.length} URLs (${state.totalSubmitted + totalThisRun}/${total} done, ~${remaining} remaining)`,
    );

    if (dryRun) {
      console.log(`  → [DRY RUN] First URL: ${urls[0]}`);
      console.log(`  → [DRY RUN] Last URL:  ${urls[urls.length - 1]}`);
      totalThisRun += urls.length;
      state.lastCursor = lastCursor;
      continue;
    }

    const result = await submitToIndexNow(urls);
    console.log(`  → Submitted: ${result.submitted}, Errors: ${result.errors}`);

    for (const d of result.details) {
      const emoji = d.status >= 200 && d.status < 300 ? "✅" : "❌";
      console.log(`     ${emoji} ${d.endpoint} → HTTP ${d.status} (batch ${d.batch})`);
    }

    totalThisRun += urls.length;
    state.totalSubmitted += result.submitted;
    state.lastCursor = lastCursor;
    state.lastRunAt = new Date().toISOString();
    saveState(state);

    // Stop on errors
    if (result.errors > 0 && result.submitted === 0) {
      console.log("\n⚠️  Stopping due to errors. Run again to retry.");
      break;
    }

    // Delay between batches
    if (urls.length === batchLimit && totalThisRun < maxUrls) {
      console.log(`  ⏳ Waiting ${DELAY_BETWEEN_BATCHES_MS / 1000}s before next batch...`);
      await new Promise((r) => setTimeout(r, DELAY_BETWEEN_BATCHES_MS));
    }
  }

  await pool.end();

  // Summary
  console.log("\n📊 Summary");
  console.log("━".repeat(55));
  console.log(`  Submitted this run:   ${totalThisRun}`);
  console.log(`  Total ever submitted: ${state.totalSubmitted}`);
  console.log(`  Next cursor:          ${state.lastCursor || "(complete)"}`);
  if (!dryRun) {
    saveState(state);
    console.log(`\n💾 State saved. Run again to continue.`);
  }
}

main()
  .catch((err) => {
    console.error("\n💥 Fatal:", err.message || err);
    process.exit(1);
  })
  .then(() => process.exit(0));
