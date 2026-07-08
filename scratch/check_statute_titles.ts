import "../server/load-env";
import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  // Get distinct short_titles
  const res = await db.execute(sql`
    SELECT DISTINCT short_title, count(*)::integer as section_count
    FROM statutes
    GROUP BY short_title
    ORDER BY section_count DESC
    LIMIT 50
  `);
  console.log("=== Top 50 statutes by section count ===");
  res.rows.forEach((r, i) => console.log(`${i+1}. "${r.short_title}" (${r.section_count} sections)`));

  // Check if specific acts exist
  const specific = await db.execute(sql`
    SELECT DISTINCT short_title FROM statutes 
    WHERE short_title ILIKE '%contract%' 
       OR short_title ILIKE '%specific relief%'
       OR short_title ILIKE '%transfer of property%'
       OR short_title ILIKE '%land revenue%'
       OR short_title ILIKE '%partition%'
    ORDER BY short_title
  `);
  console.log("\n=== Relevant statutes for land/contract queries ===");
  specific.rows.forEach(r => console.log(`  "${r.short_title}"`));
}

main().catch(console.error);
