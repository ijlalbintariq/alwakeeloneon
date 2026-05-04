#!/usr/bin/env node
/**
 * One-off backfill: extract real Title and Court Name from judgments.full_text
 * and write them to the dedicated columns. Permanently fixes ~legacy rows
 * that have placeholder titles like "Case reported at 2005 PCRLJ 1008".
 *
 * Idempotent: only updates rows where the current value is a placeholder or
 * empty. Safe to re-run.
 *
 * Usage:
 *   DATABASE_URL=postgres://... node scripts/backfill-judgment-titles.cjs
 *   DATABASE_URL=... node scripts/backfill-judgment-titles.cjs --dry-run
 *   DATABASE_URL=... node scripts/backfill-judgment-titles.cjs --batch=1000 --limit=10000
 */
const { Client } = require('pg');

const args = new Map(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] ?? "true"] : [a, "true"];
  })
);
const DRY_RUN = args.get('dry-run') === 'true';
const BATCH = Number(args.get('batch') || 500);
const TOTAL_LIMIT = Number(args.get('limit') || Infinity);

function extractFromFullText(fullText) {
  const head = String(fullText || "").slice(0, 1500);
  const grab = (label) => {
    const m = head.match(new RegExp(`(?:^|\\n)\\s*${label}\\s*:\\s*([^\\n]+)`, 'i'));
    return m ? m[1].trim() : "";
  };
  return {
    title: grab('Title'),
    court: grab('Court Name') || grab('Court'),
  };
}

function looksLikeRealCaseTitle(s) {
  if (!s) return false;
  if (/\b(vs?\.?|versus)\b/i.test(s)) return true;
  if (/^[A-Z][A-Z .'-]{3,}/.test(s)) return true;
  return false;
}

function isPlaceholderTitle(t) {
  if (!t) return true;
  const s = String(t).trim();
  if (!s) return true;
  // Class A: literal placeholder phrases.
  if (/^case\s+(?:reported\s+at|cited\s+as|no\.?)\b/i.test(s)) return true;
  // Class B: prose-snippet titles (sentence-like, no vs/versus, no caps name).
  // Treat as placeholder so the backfill replaces them with the full_text Title.
  if (!looksLikeRealCaseTitle(s)) return true;
  return false;
}

(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();

  console.log(`[backfill] mode=${DRY_RUN ? 'DRY-RUN' : 'WRITE'} batch=${BATCH} limit=${TOTAL_LIMIT === Infinity ? 'all' : TOTAL_LIMIT}`);

  const pre = await c.query(`
    SELECT
      COUNT(*) FILTER (WHERE title IS NULL OR title = '' OR title ~* '^case\\s+(reported\\s+at|cited\\s+as|no\\.?)') AS bad_titles,
      COUNT(*) FILTER (WHERE court_name_snapshot IS NULL OR court_name_snapshot = '') AS empty_courts,
      COUNT(*) AS total
    FROM judgments
  `);
  console.log(`[backfill] total=${pre.rows[0].total} bad_titles=${pre.rows[0].bad_titles} empty_courts=${pre.rows[0].empty_courts}`);

  let processed = 0;
  let updatedTitle = 0;
  let updatedCourt = 0;
  let lastId = '00000000-0000-0000-0000-000000000000';

  while (processed < TOTAL_LIMIT) {
    const fetchSize = Math.min(BATCH, TOTAL_LIMIT - processed);
    // WHERE catches both Class A (literal placeholders) and Class B
    // (prose-snippet titles missing vs/versus and not ALL-CAPS-style).
    // The JS-side isPlaceholderTitle() does the final accept/reject.
    const { rows } = await c.query(
      `SELECT id, title, court_name_snapshot, full_text
         FROM judgments
        WHERE id > $1
          AND (
            title IS NULL
            OR title = ''
            OR title ~* '^case\\s+(reported\\s+at|cited\\s+as|no\\.?)'
            OR (
              title !~* '\\m(vs?|versus)\\M'
              AND title !~ '^[A-Z][A-Z]{2,}'
            )
            OR court_name_snapshot IS NULL
            OR court_name_snapshot = ''
          )
        ORDER BY id
        LIMIT $2`,
      [lastId, fetchSize]
    );
    if (rows.length === 0) break;

    for (const r of rows) {
      lastId = r.id;
      processed++;
      const ext = extractFromFullText(r.full_text);
      const newTitle = isPlaceholderTitle(r.title) && ext.title ? ext.title : null;
      const newCourt = (!r.court_name_snapshot || !r.court_name_snapshot.trim()) && ext.court ? ext.court : null;
      if (!newTitle && !newCourt) continue;

      const updates = [];
      const params = [];
      if (newTitle) { params.push(newTitle); updates.push(`title = $${params.length}`); updatedTitle++; }
      if (newCourt) { params.push(newCourt); updates.push(`court_name_snapshot = $${params.length}`); updatedCourt++; }
      params.push(r.id);

      if (!DRY_RUN) {
        await c.query(`UPDATE judgments SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${params.length}`, params);
      }
    }
    console.log(`[backfill] processed=${processed} updated_title=${updatedTitle} updated_court=${updatedCourt}`);
  }

  console.log(`\n[backfill] DONE  processed=${processed}  titles_updated=${updatedTitle}  courts_updated=${updatedCourt}  ${DRY_RUN ? '(DRY RUN — no writes)' : '(writes committed)'}`);
  await c.end();
})().catch((e) => {
  console.error('[backfill] FAILED:', e);
  process.exit(1);
});
