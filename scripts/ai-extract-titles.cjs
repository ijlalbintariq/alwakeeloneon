#!/usr/bin/env node
/**
 * Use gpt-4o-mini to extract proper Title and Court Name from judgments.full_text
 * for the rows the regex backfill couldn't recover (no clean "Title:" header).
 *
 * Cost estimate (~6800 rows): ~$1.70 in OpenAI costs.
 *
 * Idempotent — only updates rows where current title still fails the
 * looksLikeRealCaseTitle heuristic. Safe to re-run.
 *
 * Usage:
 *   OPENAI_API_KEY=... DATABASE_URL=... node scripts/ai-extract-titles.cjs
 *   ... --dry-run --limit=20  # try 20 rows without writing
 *   ... --batch=20 --limit=500
 */
const { Client } = require('pg');
const OpenAI = require('openai').default || require('openai');

const args = new Map(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] ?? "true"] : [a, "true"];
  })
);
const DRY_RUN = args.get('dry-run') === 'true';
const BATCH = Number(args.get('batch') || 30);
const TOTAL_LIMIT = Number(args.get('limit') || Infinity);

function looksLikeRealCaseTitle(s) {
  if (!s) return false;
  if (/\b(vs?\.?|versus)\b/i.test(s)) return true;
  if (/^[A-Z][A-Z .'-]{3,}/.test(s)) return true;
  return false;
}

async function extractWithAI(openai, fullText) {
  const head = String(fullText || "").slice(0, 4000);
  if (head.length < 100) return null;
  try {
    const resp = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'Extract the case title and court name from a Pakistani judgment text. ' +
            'Return JSON: {"title": "...", "court": "..."}. ' +
            'TITLE: Look for "Title:" header and capture the FULL title (may span multiple lines). ' +
            'If "Title:" is empty, look at "Case No.:" or read the opening prose ' +
            '(judgments often start with "PETITIONER vs RESPONDENT" or "In re: PETITIONER"). ' +
            'Format the title as PETITIONER vs RESPONDENT using actual party names. ' +
            'COURT: Look for "Court Name:" header. ' +
            'Examples: "Supreme Court of Pakistan", "Lahore High Court", "Sindh High Court", "Federal Shariat Court", "Peshawar High Court", "Islamabad High Court". ' +
            'ONLY return null for a field if you genuinely cannot find or infer it. ' +
            'Do not invent party names, but DO combine multi-line titles into one.',
        },
        { role: 'user', content: head },
      ],
      max_tokens: 200,
      temperature: 0,
      response_format: { type: 'json_object' },
    });
    const raw = resp.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(raw);
    const title = parsed.title && typeof parsed.title === 'string' && looksLikeRealCaseTitle(parsed.title)
      ? parsed.title.trim()
      : null;
    const court = parsed.court && typeof parsed.court === 'string' && parsed.court.trim().length > 3
      ? parsed.court.trim()
      : null;
    return { title, court };
  } catch (err) {
    return null;
  }
}

(async () => {
  if (!process.env.DATABASE_URL) { console.error('DATABASE_URL not set'); process.exit(1); }
  if (!process.env.OPENAI_API_KEY) { console.error('OPENAI_API_KEY not set'); process.exit(1); }

  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  console.log(`[ai-extract] mode=${DRY_RUN ? 'DRY-RUN' : 'WRITE'} batch=${BATCH} limit=${TOTAL_LIMIT === Infinity ? 'all' : TOTAL_LIMIT}`);

  let processed = 0;
  let updatedTitle = 0;
  let updatedCourt = 0;
  let nullExtractions = 0;
  let lastId = '00000000-0000-0000-0000-000000000000';
  const startedAt = Date.now();

  while (processed < TOTAL_LIMIT) {
    const fetchSize = Math.min(BATCH, TOTAL_LIMIT - processed);
    const { rows } = await c.query(
      `SELECT id, title, court_name_snapshot, full_text
         FROM judgments
        WHERE id > $1
          AND full_text IS NOT NULL AND LENGTH(full_text) > 100
          AND (
            title IS NULL OR title = '' OR
            title ~* '^case\\s+(reported\\s+at|cited\\s+as|no\\.?)' OR
            (title !~* '\\m(vs?|versus)\\M' AND title !~ '^[A-Z][A-Z]{2,}')
          )
        ORDER BY id
        LIMIT $2`,
      [lastId, fetchSize]
    );
    if (rows.length === 0) break;

    // Process the batch concurrently (gpt-4o-mini handles ~50 RPS easily).
    const results = await Promise.all(
      rows.map(async (r) => {
        lastId = r.id;
        const ext = await extractWithAI(openai, r.full_text);
        return { row: r, ext };
      })
    );
    processed += rows.length;

    const updates = [];
    for (const { row, ext } of results) {
      if (!ext || (!ext.title && !ext.court)) {
        nullExtractions++;
        continue;
      }
      const newTitle = ext.title && !looksLikeRealCaseTitle(row.title) ? ext.title : null;
      const newCourt = ext.court && (!row.court_name_snapshot || !row.court_name_snapshot.trim()) ? ext.court : null;
      if (!newTitle && !newCourt) continue;
      updates.push({ id: row.id, newTitle, newCourt });
      if (newTitle) updatedTitle++;
      if (newCourt) updatedCourt++;
    }

    if (!DRY_RUN && updates.length > 0) {
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

    const elapsed = (Date.now() - startedAt) / 1000;
    const rate = processed / elapsed;
    console.log(`[ai-extract] processed=${processed} title=${updatedTitle} court=${updatedCourt} null=${nullExtractions} rate=${rate.toFixed(1)}/s eta=${((TOTAL_LIMIT - processed) / rate).toFixed(0)}s`);
  }

  const dur = (Date.now() - startedAt) / 1000;
  console.log(`\n[ai-extract] DONE  processed=${processed}  title_updated=${updatedTitle}  court_updated=${updatedCourt}  null=${nullExtractions}  ${DRY_RUN ? '(DRY RUN)' : '(committed)'}  ${dur.toFixed(0)}s`);
  await c.end();
})().catch((e) => {
  console.error('[ai-extract] FAILED:', e);
  process.exit(1);
});
