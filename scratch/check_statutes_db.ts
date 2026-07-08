import "../server/load-env";
import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  // Check statutes table columns
  const cols = await db.execute(sql`
    SELECT column_name, data_type, udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'statutes'
    ORDER BY ordinal_position
  `);
  console.log("=== Statutes table columns ===");
  cols.rows.forEach(c => console.log(`  ${c.column_name}: type=${c.data_type}, udt=${c.udt_name}`));

  // Check for vector indexes on statutes
  const indexes = await db.execute(sql`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'statutes'
  `);
  console.log("\n=== Statutes indexes ===");
  indexes.rows.forEach(i => console.log(`  ${i.indexname}: ${i.indexdef}`));

  // Sample a statute to see if embedding exists
  const sample = await db.execute(sql`
    SELECT id, short_title, section, 
           CASE WHEN embedding IS NOT NULL THEN 'YES' ELSE 'NO' END as has_embedding,
           pg_column_size(embedding) as embedding_bytes
    FROM statutes 
    LIMIT 5
  `);
  console.log("\n=== Sample statutes ===");
  sample.rows.forEach(r => console.log(r));

  // Count statutes with embeddings
  const countEmbed = await db.execute(sql`
    SELECT count(*)::integer as with_embedding FROM statutes WHERE embedding IS NOT NULL
  `);
  console.log("\n=== Statutes with embedding ===", countEmbed.rows[0]);

  const countNull = await db.execute(sql`
    SELECT count(*)::integer as without_embedding FROM statutes WHERE embedding IS NULL
  `);
  console.log("=== Statutes without embedding ===", countNull.rows[0]);
}

main().catch(console.error);
