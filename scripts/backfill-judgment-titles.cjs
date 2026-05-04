#!/usr/bin/env node
/**
 * One-off backfill: extract real Title and Court Name from judgments.full_text
 * and write them to the dedicated columns. Permanently fixes legacy rows
 * that have placeholder titles like "Case reported at 2005 PCRLJ 1008" or
 * prose-snippet titles ("settled that considerations for the cancellation...").
 *
 * Idempotent: only updates rows whose current value is missing/placeholder,
 * and only when full_text exposes a clean replacement. Safe to re-run.
 *
 * Performance: bulk UPDATE FROM VALUES — one SQL per batch instead of one
 * per row. ~50-100x faster than the per-row version (Neon roundtrip latency
 * was the bottleneck).
 *
 * Usage:
 *   DATABASE_URL=postgres://... node scripts/backfill-judgment-titles.cjs
 *   DATABASE_URL=... node scripts/backfill-judgment-titles.cjs --dry-run
 *   DATABASE_URL=... node scripts/backfill-judgment-titles.cjs --batch=2000 --limit=10000
 */
const { Client } = require('pg');

const args = new Map(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] ?? "true"] : [a, "true"];
  })
);
const DRY_RUN = args.get('dry-run') === 'true';
const BATCH = Number(args.get('batch') || 2000);
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
  if (/^case\s+(?:reported\s+at|cited\s+as|no\.?)\b/i.test(s)) return true;
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
      COUNT(*) FILTER (WHERE
        title IS NULL OR title = ''
        OR title ~* '^case\\s+(reported\\s+at|cited\\s+as|no\\.?)'
        OR (title !~* '\\m(vs?|versus)\\M' AND title !~ '^[A-Z][A-Z]{2,}')
      ) AS bad_titles,
      COUNT(*) FILTER (WHERE court_name_snapshot IS NULL OR court_name_snapshot = '') AS empty_courts,
      COUNT(*) AS total
    FROM judgments
  `);
  console.log(`[backfill] total=${pre.rows[0].total} bad_titles=${pre.rows[0].bad_titles} empty_courts=${pre.rows[0].empty_courts}`);

  let processed = 0;
  let updatedTitle = 0;
  let updatedCourt = 0;
  let lastId = '00000000-0000-0000-0000-000000000000';
  const startedAt = Date.now();

  while (processed < TOTAL_LIMIT) {
    const fetchSize = Math.min(BATCH, TOTAL_LIMIT - processed);
    const t0 = Date.now();
    const { rows } = await c.query(
      `SELECT id, title, court_name_snapshot, full_text
         FROM judgments
        WHERE id > $1
          AND (
            title IS NULL OR title = ''
            OR title ~* '^case\\s+(reported\\s+at|cited\\s+as|no\\.?)'
            OR (title !~* '\\m(vs?|versus)\\M' AND title !~ '^[A-Z][A-Z]{2,}')
            OR court_name_snapshot IS NULL OR court_name_snapshot = ''
          )
        ORDER BY id
        LIMIT $2`,
      [lastId, fetchSize]
    );
    if (rows.length === 0) break;

    // Build the batch update payload.
    const updates = []; // { id, newTitle?, newCourt? }
    for (const r of rows) {
      lastId = r.id;
      processed++;
      const ext = extractFromFullText(r.full_text);
      const newTitle = isPlaceholderTitle(r.title) && ext.title && looksLikeRealCaseTitle(ext.title) ? ext.title : null;
      const newCourt = (!r.court_name_snapshot || !r.court_name_snapshot.trim()) && ext.court ? ext.court : null;
      if (!newTitle && !newCourt) continue;
      updates.push({ id: r.id, newTitle, newCourt });
      if (newTitle) updatedTitle++;
      if (newCourt) updatedCourt++;
    }

    if (!DRY_RUN && updates.length > 0) {
      // Single bulk UPDATE per batch via VALUES list. Each row contributes
      //   ($n::uuid, $n+1::text, $n+2::text)
      // and the SET uses COALESCE to leave columns unchanged when the new
      // value is NULL (i.e. that field didn't need update).
      const params = [];
      const tuples = [];
      for (const u of updates) {
        const ti = params.length + 1;
        const tt = params.length + 2;
        const tc = params.length + 3;
        params.push(u.id, u.newTitle, u.newCourt);
        tuples.push(`($${ti}::uuid, $${tt}::text, $${tc}::text)`);
      }
      const sql = `
        UPDATE judgments AS j
           SET title = COALESCE(u.new_title, j.title),
               court_name_snapshot = COALESCE(u.new_court, j.court_name_snapshot),
               updated_at = NOW()
          FROM (VALUES ${tuples.join(',')}) AS u(id, new_title, new_court)
         WHERE j.id = u.id
      `;
      await c.query(sql, params);
    }

    const ms = Date.now() - t0;
    const rate = processed / ((Date.now() - startedAt) / 1000);
    console.log(`[backfill] processed=${processed} updated_title=${updatedTitle} updated_court=${updatedCourt} batch_ms=${ms} rate=${rate.toFixed(0)}/s`);
  }

  console.log(`\n[backfill] DONE  processed=${processed}  titles_updated=${updatedTitle}  courts_updated=${updatedCourt}  ${DRY_RUN ? '(DRY RUN — no writes)' : '(writes committed)'}  elapsed=${((Date.now()-startedAt)/1000).toFixed(1)}s`);
  await c.end();
})().catch((e) => {
  console.error('[backfill] FAILED:', e);
  process.exit(1);
});
