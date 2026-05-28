/**
 * Phase 3 — Fix corrupted year values in Neon judgments table.
 * Records with year > 2026 or year < 1900 are typos/scrape errors.
 * Tries to auto-correct from citation_string, otherwise hides the record.
 */
import "../../server/load-env";
import { db } from "../../server/db";
import { judgments } from "../../shared/schema";
import { sql, and, or, lt, gt } from "drizzle-orm";

async function main() {
  console.log("=== Phase 3: Fix Corrupted Year Values ===\n");

  const rows = await db.execute(sql`
    SELECT id, year, citation_string, title
    FROM judgments
    WHERE year < 1900 OR year > 2026
    ORDER BY year DESC
  `);

  console.log(`Found ${rows.rows.length} records with invalid years\n`);

  let fixed = 0;
  let deactivated = 0;

  for (const row of rows.rows as any[]) {
    // Try to extract year from citation_string e.g. "1997 SCMR 492"
    const match = (row.citation_string as string)?.match(/^(\d{4})\s/);
    const citYear = match ? parseInt(match[1], 10) : null;

    if (citYear && citYear >= 1900 && citYear <= 2026) {
      // Fix it using the citation year
      await db.execute(sql`
        UPDATE judgments SET year = ${citYear} WHERE id = ${row.id}
      `);
      console.log(`  ✅ Fixed  year ${row.year} → ${citYear} | ${row.citation_string}`);
      fixed++;
    } else {
      // Can't determine correct year — hide from search
      await db.execute(sql`
        UPDATE judgments SET is_active = false WHERE id = ${row.id}
      `);
      console.log(`  ⚠️  Hidden year=${row.year} (no fix found) | ${row.citation_string}`);
      deactivated++;
    }
  }

  console.log(`\nDone. Fixed: ${fixed}, Hidden: ${deactivated}`);
}

main().catch(console.error).finally(() => process.exit(0));
