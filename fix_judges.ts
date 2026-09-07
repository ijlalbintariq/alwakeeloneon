import { db } from './server/db';
import { sql } from 'drizzle-orm';
async function run() {
  const search = "Zullah";
  const limit = 5;
  const offset = 0;
  
  const searchCondition = search ? sql`AND judge_name ILIKE ${'%' + search + '%'}` : sql``;

  const q = sql`
    WITH unnested AS (
      SELECT 
        trim(unnest(string_to_array(j.bench, ','))) as judge_name,
        j.year,
        COALESCE(c.name, j.court_name_snapshot) as court_name
      FROM judgments j
      LEFT JOIN courts_ref c ON j.court_id = c.id
      WHERE j.is_active = true AND j.bench IS NOT NULL AND j.bench != ''
    )
    SELECT
      judge_name,
      count(*)::int as case_count,
      array_agg(DISTINCT court_name) FILTER (WHERE court_name IS NOT NULL) as courts,
      min(year)::int as earliest_year,
      max(year)::int as latest_year
    FROM unnested
    WHERE judge_name != '' ${searchCondition}
    GROUP BY judge_name
    ORDER BY case_count DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  
  console.time('query');
  const res = await db.execute(q);
  console.timeEnd('query');
  console.log(res.rows);
  process.exit(0);
}
run();
