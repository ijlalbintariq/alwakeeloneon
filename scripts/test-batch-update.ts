import "../server/load-env";
import { db, pool } from "../server/db";
import { judgments } from "../shared/schema";
import { sql, eq, inArray } from "drizzle-orm";
import { parseJudgmentHeader } from "./extract-judgment-metadata";

async function main() {
  console.log("Fetching 5 judgments with null petitioner...");
  const records = await db.select({
    id: judgments.id,
    fullText: sql<string>`substring(full_text from 1 for 2000)`
  })
  .from(judgments)
  .where(sql`petitioner IS NULL`)
  .limit(5);

  console.log(`Fetched ${records.length} records. Parsing...`);
  const batch = records.map((r: any) => {
    const parsed = parseJudgmentHeader(r.fullText);
    return {
      id: r.id,
      petitioner: parsed.petitioner,
      respondent: parsed.respondent,
      decision_date: parsed.decisionDate ? parsed.decisionDate.toISOString() : null,
      court_id: parsed.courtId,
      court_name_snapshot: parsed.courtNameSnapshot
    };
  });

  console.log("Batch to update:", JSON.stringify(batch, null, 2));

  console.log("Running batch update...");
  await db.execute(sql`
    UPDATE judgments AS j
    SET 
      petitioner = v.petitioner,
      respondent = v.respondent,
      decision_date = v.decision_date,
      court_id = v.court_id,
      court_name_snapshot = v.court_name_snapshot,
      updated_at = NOW()
    FROM (
      SELECT 
        (x->>'id')::uuid AS id,
        (x->>'petitioner')::text AS petitioner,
        (x->>'respondent')::text AS respondent,
        (x->>'decision_date')::timestamp AS decision_date,
        (x->>'court_id')::integer AS court_id,
        (x->>'court_name_snapshot')::text AS court_name_snapshot
      FROM json_array_elements(${JSON.stringify(batch)}::json) AS x
    ) AS v
    WHERE j.id = v.id;
  `);

  console.log("Batch update completed! Verification query:");
  const ids = records.map((r: any) => r.id);
  const updated = await db.select({
    id: judgments.id,
    petitioner: judgments.petitioner,
    respondent: judgments.respondent,
    decisionDate: judgments.decisionDate,
    courtId: judgments.courtId,
    courtNameSnapshot: judgments.courtNameSnapshot
  })
  .from(judgments)
  .where(inArray(judgments.id, ids));

  console.log("Updated records:", JSON.stringify(updated, null, 2));

  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
});
