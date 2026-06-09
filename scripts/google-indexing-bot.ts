/**
 * Google Indexing API Bot for alwakeelo.com
 *
 * Submits URLs to Google's Indexing API for fast crawling/indexing.
 * Uses the service account: google-indexing-bot@gen-lang-client-0332563597.iam.gserviceaccount.com
 *
 * Usage:
 *   npx tsx scripts/google-indexing-bot.ts                    # Submit all unsubmitted URLs (batched, respects quota)
 *   npx tsx scripts/google-indexing-bot.ts --static           # Submit static pages only
 *   npx tsx scripts/google-indexing-bot.ts --judgments         # Submit judgment pages only
 *   npx tsx scripts/google-indexing-bot.ts --limit 200        # Submit max 200 URLs
 *   npx tsx scripts/google-indexing-bot.ts --dry-run          # Preview URLs without submitting
 *   npx tsx scripts/google-indexing-bot.ts --status           # Check quota status
 *
 * Google Indexing API limits:
 *   - 200 requests per day (publish/update notifications)
 *   - Batch endpoint supports up to 100 items per batch request
 *
 * The bot tracks submitted URLs in a local JSON state file to avoid re-submitting.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Configuration ────────────────────────────────────────────────────────────
const CANONICAL_ORIGIN = 'https://www.alwakeelo.com';
const SERVICE_ACCOUNT_KEY_PATH = path.resolve(
  process.env.GOOGLE_INDEXING_KEY_PATH ||
  '/Users/macbook/Downloads/gen-lang-client-0332563597-850555cc2897.json'
);
const STATE_FILE = path.resolve(__dirname, '../scripts/db-sync/google-indexing-state.json');
const DAILY_QUOTA = 200;
const BATCH_SIZE = 100; // Max per batch API call
const DELAY_BETWEEN_BATCHES_MS = 1500; // Be gentle with the API

// ── State tracking ───────────────────────────────────────────────────────────
interface IndexingState {
  /** URLs submitted today */
  submittedToday: number;
  /** Date string (YYYY-MM-DD) for daily quota tracking */
  quotaDate: string;
  /** Map of URL → last submission timestamp */
  submittedUrls: Record<string, string>;
  /** Last judgment cursor (ID) for incremental runs */
  lastJudgmentCursor: string | null;
  /** Total URLs ever submitted */
  totalSubmitted: number;
}

function loadState(): IndexingState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    }
  } catch { /* fresh start */ }
  return {
    submittedToday: 0,
    quotaDate: '',
    submittedUrls: {},
    lastJudgmentCursor: null,
    totalSubmitted: 0,
  };
}

function saveState(state: IndexingState): void {
  const dir = path.dirname(STATE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function resetQuotaIfNewDay(state: IndexingState): void {
  if (state.quotaDate !== today()) {
    state.quotaDate = today();
    state.submittedToday = 0;
  }
}

// ── Google Auth ──────────────────────────────────────────────────────────────
async function getAuthClient() {
  if (!fs.existsSync(SERVICE_ACCOUNT_KEY_PATH)) {
    throw new Error(`Service account key not found at: ${SERVICE_ACCOUNT_KEY_PATH}`);
  }
  const key = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_KEY_PATH, 'utf-8'));
  const auth = new google.auth.GoogleAuth({
    credentials: key,
    scopes: ['https://www.googleapis.com/auth/indexing'],
  });
  return auth.getClient();
}

// ── URL Submission ───────────────────────────────────────────────────────────
interface SubmitResult {
  url: string;
  status: 'ok' | 'error' | 'skipped';
  message?: string;
}

async function submitUrls(
  urls: string[],
  state: IndexingState,
  dryRun: boolean = false,
): Promise<SubmitResult[]> {
  if (urls.length === 0) return [];

  resetQuotaIfNewDay(state);
  const remaining = DAILY_QUOTA - state.submittedToday;
  if (remaining <= 0 && !dryRun) {
    console.log(`\n⚠️  Daily quota exhausted (${DAILY_QUOTA} submissions today). Try again tomorrow.`);
    return urls.map(url => ({ url, status: 'skipped' as const, message: 'Quota exhausted' }));
  }

  // Filter out already-submitted URLs (submitted within last 24h)
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const newUrls = urls.filter(url => {
    const lastSubmitted = state.submittedUrls[url];
    if (!lastSubmitted) return true;
    return new Date(lastSubmitted).getTime() < cutoff;
  });

  if (newUrls.length === 0) {
    console.log('All URLs already submitted within the last 24 hours.');
    return urls.map(url => ({ url, status: 'skipped' as const, message: 'Already submitted' }));
  }

  const toSubmit = newUrls.slice(0, Math.min(remaining, newUrls.length));
  console.log(`\n📋 Submitting ${toSubmit.length} URLs (${newUrls.length - toSubmit.length} deferred due to quota)`);

  if (dryRun) {
    console.log('\n🏃 DRY RUN — no actual submissions:');
    for (const url of toSubmit.slice(0, 20)) {
      console.log(`  → ${url}`);
    }
    if (toSubmit.length > 20) console.log(`  ... and ${toSubmit.length - 20} more`);
    return toSubmit.map(url => ({ url, status: 'ok' as const, message: 'Dry run' }));
  }

  const authClient = await getAuthClient();
  const results: SubmitResult[] = [];

  // Submit in batches
  for (let i = 0; i < toSubmit.length; i += BATCH_SIZE) {
    const batch = toSubmit.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(toSubmit.length / BATCH_SIZE);
    console.log(`\n📦 Batch ${batchNum}/${totalBatches} (${batch.length} URLs):`);

    for (const url of batch) {
      try {
        const response = await (authClient as any).request({
          url: 'https://indexing.googleapis.com/v3/urlNotifications:publish',
          method: 'POST',
          data: {
            url: url,
            type: 'URL_UPDATED',
          },
        });

        const status = response?.status;
        if (status === 200) {
          state.submittedUrls[url] = new Date().toISOString();
          state.submittedToday += 1;
          state.totalSubmitted += 1;
          results.push({ url, status: 'ok' });
          process.stdout.write('✅');
        } else {
          results.push({ url, status: 'error', message: `HTTP ${status}` });
          process.stdout.write('❌');
        }
      } catch (err: any) {
        const msg = err?.response?.data?.error?.message || err.message || 'Unknown error';
        results.push({ url, status: 'error', message: msg });
        process.stdout.write('❌');

        // If quota exceeded, stop
        if (err?.response?.status === 429) {
          console.log('\n\n⚠️  Quota exceeded (429). Stopping.');
          state.submittedToday = DAILY_QUOTA;
          saveState(state);
          return results;
        }
      }

      // Small delay between individual requests
      await new Promise(r => setTimeout(r, 100));
    }
    console.log(''); // newline after batch

    // Delay between batches
    if (i + BATCH_SIZE < toSubmit.length) {
      console.log(`  ⏳ Waiting ${DELAY_BETWEEN_BATCHES_MS}ms before next batch...`);
      await new Promise(r => setTimeout(r, DELAY_BETWEEN_BATCHES_MS));
    }
  }

  saveState(state);
  return results;
}

// ── URL Generators ───────────────────────────────────────────────────────────

function getStaticUrls(): string[] {
  return [
    '/',
    '/judgments',
    '/judgments/browse',
    '/statute-search',
    '/al-wakeelo',
    '/legal-drafting',
    '/contract-drafting',
    '/citation-search',
    '/install',
    '/privacy',
    '/terms',
    '/cancellation-return-refund-policy',
    '/ownership-statement',
  ].map(p => `${CANONICAL_ORIGIN}${p}`);
}

async function getJudgmentUrls(
  limit: number,
  cursor: string | null,
): Promise<{ urls: string[]; lastCursor: string | null }> {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const query = cursor
      ? `SELECT id FROM judgments WHERE is_active = true AND id > $1 ORDER BY id ASC LIMIT $2`
      : `SELECT id FROM judgments WHERE is_active = true ORDER BY id ASC LIMIT $1`;

    const params = cursor ? [cursor, limit] : [limit];
    const result = await pool.query(query, params);

    const urls = result.rows.map((row: any) => `${CANONICAL_ORIGIN}/judgment/${row.id}`);
    const lastCursor = result.rows.length > 0 ? result.rows[result.rows.length - 1].id : null;

    return { urls, lastCursor };
  } finally {
    await pool.end();
  }
}

async function checkQuotaStatus(state: IndexingState): Promise<void> {
  resetQuotaIfNewDay(state);
  const totalTracked = Object.keys(state.submittedUrls).length;

  console.log('\n📊 Google Indexing API Status');
  console.log('━'.repeat(50));
  console.log(`  Today's date:        ${today()}`);
  console.log(`  Submitted today:     ${state.submittedToday}/${DAILY_QUOTA}`);
  console.log(`  Remaining today:     ${Math.max(0, DAILY_QUOTA - state.submittedToday)}`);
  console.log(`  Total ever submitted: ${state.totalSubmitted}`);
  console.log(`  URLs in state file:  ${totalTracked}`);
  console.log(`  Last judgment cursor: ${state.lastJudgmentCursor || '(none — will start from beginning)'}`);
  console.log(`  State file:          ${STATE_FILE}`);
  console.log(`  Key file:            ${SERVICE_ACCOUNT_KEY_PATH}`);
  console.log(`  Key exists:          ${fs.existsSync(SERVICE_ACCOUNT_KEY_PATH) ? '✅' : '❌'}`);
  console.log('━'.repeat(50));
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const staticOnly = args.includes('--static');
  const judgmentsOnly = args.includes('--judgments');
  const statusOnly = args.includes('--status');
  const limitIdx = args.indexOf('--limit');
  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : DAILY_QUOTA;

  const state = loadState();

  if (statusOnly) {
    await checkQuotaStatus(state);
    return;
  }

  console.log('🤖 Google Indexing Bot for alwakeelo.com');
  console.log('━'.repeat(50));
  resetQuotaIfNewDay(state);
  console.log(`  Quota: ${state.submittedToday}/${DAILY_QUOTA} used today`);
  if (dryRun) console.log('  Mode: DRY RUN (no actual submissions)');

  let allUrls: string[] = [];

  // Collect URLs based on flags
  if (!judgmentsOnly) {
    const staticUrls = getStaticUrls();
    console.log(`\n🏛️  Static pages: ${staticUrls.length} URLs`);
    allUrls.push(...staticUrls);
  }

  if (!staticOnly) {
    const remaining = Math.max(0, limit - allUrls.length);
    if (remaining > 0) {
      console.log(`\n⚖️  Fetching judgment URLs (limit: ${remaining}, cursor: ${state.lastJudgmentCursor || 'start'})...`);
      const { urls: judgmentUrls, lastCursor } = await getJudgmentUrls(remaining, state.lastJudgmentCursor);
      console.log(`   Found: ${judgmentUrls.length} judgment URLs`);
      allUrls.push(...judgmentUrls);

      if (lastCursor && !dryRun) {
        state.lastJudgmentCursor = lastCursor;
      }
    }
  }

  if (allUrls.length === 0) {
    console.log('\nNo URLs to submit.');
    return;
  }

  // Submit
  const results = await submitUrls(allUrls, state, dryRun);

  // Summary
  const ok = results.filter(r => r.status === 'ok').length;
  const errors = results.filter(r => r.status === 'error');
  const skipped = results.filter(r => r.status === 'skipped').length;

  console.log('\n📊 Summary');
  console.log('━'.repeat(50));
  console.log(`  ✅ Submitted: ${ok}`);
  console.log(`  ❌ Errors:    ${errors.length}`);
  console.log(`  ⏭️  Skipped:   ${skipped}`);
  console.log(`  📦 Quota used: ${state.submittedToday}/${DAILY_QUOTA}`);

  if (errors.length > 0) {
    console.log('\n  Error details:');
    for (const err of errors.slice(0, 10)) {
      console.log(`    ${err.url} → ${err.message}`);
    }
    if (errors.length > 10) console.log(`    ... and ${errors.length - 10} more errors`);
  }

  if (!dryRun) {
    saveState(state);
    console.log(`\n💾 State saved. Run again tomorrow to continue with next batch.`);
    if (state.lastJudgmentCursor) {
      console.log(`   Next run will resume from judgment cursor: ${state.lastJudgmentCursor}`);
    }
  }
}

main()
  .catch(err => {
    console.error('\n💥 Fatal error:', err.message || err);
    process.exit(1);
  })
  .then(() => process.exit(0));
