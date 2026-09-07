import { db } from './server/db';
import { sql } from 'drizzle-orm';
async function run() {
  console.log("Creating table...");
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS judge_case_links (
      id SERIAL PRIMARY KEY,
      judgment_id UUID NOT NULL REFERENCES judgments(id) ON DELETE CASCADE,
      judge_name TEXT NOT NULL,
      court_name TEXT,
      year INTEGER NOT NULL
    );
  `);
  
  console.log("Truncating to prevent duplicates...");
  await db.execute(sql`TRUNCATE TABLE judge_case_links;`);
  
  console.log("Creating indexes...");
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_judge_case_links_name ON judge_case_links(judge_name);
    CREATE INDEX IF NOT EXISTS idx_judge_case_links_court ON judge_case_links(court_name);
  `);

  console.log("Backfilling data... This will take a few seconds...");
  console.time("backfill");
  await db.execute(sql`
    INSERT INTO judge_case_links (judgment_id, judge_name, court_name, year)
    SELECT 
      j.id,
      trim(unnest(string_to_array(replace(j.bench, ' and ', ','), ','))) as judge_name,
      COALESCE(c.name, j.court_name_snapshot) as court_name,
      j.year
    FROM judgments j
    LEFT JOIN courts_ref c ON j.court_id = c.id
    WHERE j.is_active = true AND j.bench IS NOT NULL AND j.bench != ''
  `);
  console.timeEnd("backfill");
  console.log("Done.");
  process.exit(0);
}
run();
