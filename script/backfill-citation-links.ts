/**
 * Backfill citation_links for all existing judgments.
 *
 * For every judgment with fullText, extract citations via CitationExtractor,
 * resolve them against the judgments table, and insert into citation_links.
 *
 * Usage:  npx tsx script/backfill-citation-links.ts [--batch 500] [--dry-run]
 */

import { db } from "../server/db";
import { sql } from "drizzle-orm";
import { citationExtractor } from "../server/services/citation-extractor";

const BATCH = Number(process.argv.find((a, i) => process.argv[i - 1] === "--batch") || 200);
const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  console.log(`[backfill-citation-links] batch=${BATCH} dryRun=${DRY_RUN}`);

  // Count total judgments with fullText
  const countResult = await db.execute<{ cnt: number }>(
    sql`SELECT count(*)::int as cnt FROM judgments WHERE "full_text" IS NOT NULL`
  );
  const total = Number(countResult.rows[0]?.cnt ?? 0);
  console.log(`[backfill] Total judgments with fullText: ${total}`);

  // Get IDs in batches
  let offset = 0;
  let processed = 0;
  let totalLinks = 0;
  let totalUnresolved = 0;
  let errors = 0;

  while (offset < total) {
    const rowsResult = await db.execute<{ id: string }>(
      sql`SELECT id FROM judgments WHERE "full_text" IS NOT NULL ORDER BY id LIMIT ${BATCH} OFFSET ${offset}`
    );

    if (rowsResult.rows.length === 0) break;

    for (const row of rowsResult.rows) {
      try {
        const jResult = await db.execute<{ fulltext: string }>(
          sql`SELECT "full_text" as fulltext FROM judgments WHERE id = ${row.id}`
        );
        if (!jResult.rows[0]?.fulltext || jResult.rows[0].fulltext.length < 100) continue;

        if (DRY_RUN) {
          const extracted = citationExtractor.extractFromText(jResult.rows[0].fulltext, row.id);
          if (extracted.length > 0) {
            console.log(`  [dry-run] ${row.id}: ${extracted.length} citations found`);
          }
        } else {
          const result = await citationExtractor.processJudgment(row.id, jResult.rows[0].fulltext);
          if (result.totalFound > 0) {
            totalLinks += result.resolved;
            totalUnresolved += result.unresolved;
          }
        }
        processed++;
      } catch (err: any) {
        errors++;
        if (errors <= 5) console.warn(`  [error] ${row.id}: ${err?.message}`);
      }
    }

    offset += rowsResult.rows.length;
    const pct = Math.round((offset / total) * 100);
    console.log(`[backfill] ${pct}% (${processed}/${total}) links=${totalLinks} unresolved=${totalUnresolved} errors=${errors}`);
  }

  console.log(`\n[backfill] DONE. processed=${processed} links=${totalLinks} unresolved=${totalUnresolved} errors=${errors}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("[backfill] FATAL:", err);
  process.exit(1);
});
