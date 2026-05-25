import "../server/load-env";
import { db, pool } from "../server/db";
import { judgments } from "../shared/schema";
import { sql } from "drizzle-orm";
import { parseJudgmentHeader } from "./extract-judgment-metadata";
import assert from "node:assert/strict";

function datesMatch(d1: Date | null, d2: Date | null): boolean {
  if (!d1 && !d2) return true;
  if (!d1 || !d2) return false;
  return d1.getTime() === d2.getTime();
}

async function main() {
  console.log("==========================================");
  console.log("🔍 PROGRAMMATIC CASE METADATA VERIFICATION SUITE");
  console.log("==========================================");

  let allChecksPassed = true;

  try {
    // 1. Fetch total judgments count
    const totalCountRes = await db.select({ count: sql<number>`count(*)` }).from(judgments);
    const totalCount = totalCountRes[0]?.count || 0;
    console.log(`Total Judgments in Database: ${totalCount}`);

    if (totalCount === 0) {
      throw new Error("No judgments found in the database. Ingestion must be run first.");
    }

    // 2. Metadata Coverage Check
    const coveredCountRes = await db.select({ count: sql<number>`count(*)` })
      .from(judgments)
      .where(sql`petitioner IS NOT NULL AND respondent IS NOT NULL AND decision_date IS NOT NULL`);
    const coveredCount = coveredCountRes[0]?.count || 0;
    const metadataCoveragePct = (coveredCount / totalCount) * 100;

    console.log("\n--- METRIC: Metadata Coverage ---");
    console.log(`Judgments with populated structured fields: ${coveredCount} / ${totalCount}`);
    console.log(`Coverage Percentage: ${metadataCoveragePct.toFixed(2)}%`);
    
    if (metadataCoveragePct >= 90.0) {
      console.log("✅ PASS: Metadata Coverage is >= 90%");
    } else {
      console.log("❌ FAIL: Metadata Coverage is < 90%");
      allChecksPassed = false;
    }

    // 3. Court Mapping Check
    const courtMappedCountRes = await db.select({ count: sql<number>`count(*)` })
      .from(judgments)
      .where(sql`court_id IS NOT NULL`);
    const courtMappedCount = courtMappedCountRes[0]?.count || 0;
    const courtMappingPct = (courtMappedCount / totalCount) * 100;

    console.log("\n--- METRIC: Court Mapping ---");
    console.log(`Judgments with mapped court_id: ${courtMappedCount} / ${totalCount}`);
    console.log(`Mapping Percentage: ${courtMappingPct.toFixed(2)}%`);

    if (courtMappingPct >= 80.0) {
      console.log("✅ PASS: Court Mapping is >= 80%");
    } else {
      console.log("❌ FAIL: Court Mapping is < 80%");
      allChecksPassed = false;
    }

    // 4. Citation Grounding Check
    const remainingMatchingCountRes = await db.execute(sql`
      SELECT COUNT(*)::integer AS count
      FROM unresolved_citations AS u
      JOIN judgments AS j ON LOWER(TRIM(j.citation_string)) = LOWER(TRIM(u.raw_citation))
      WHERE u.status = 'pending'
    `);
    const remainingMatchingCount = remainingMatchingCountRes.rows[0]?.count || 0;

    console.log("\n--- METRIC: Citation Grounding ---");
    console.log(`Pending citations in backlog with corresponding judgments: ${remainingMatchingCount}`);

    if (remainingMatchingCount === 0) {
      console.log("✅ PASS: Citation backlog resolved completely (0 pending matches)");
    } else {
      console.log(`❌ FAIL: Citation backlog is not fully resolved (${remainingMatchingCount} matching pending citations found)`);
      allChecksPassed = false;
    }

    // 5. Random 50 Samples Integrity Check
    console.log("\n--- METRIC: Random 50 Samples Integrity Check ---");
    console.log("Selecting 50 random judgments...");
    const samples = await db.select({
      id: judgments.id,
      fullText: judgments.fullText,
      petitioner: judgments.petitioner,
      respondent: judgments.respondent,
      decisionDate: judgments.decisionDate,
      courtId: judgments.courtId,
      courtNameSnapshot: judgments.courtNameSnapshot,
      citationString: judgments.citationString
    })
    .from(judgments)
    .orderBy(sql`random()`)
    .limit(50);

    let sampleFailures = 0;

    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i];
      const parsed = parseJudgmentHeader(sample.fullText);

      let sampleMatch = true;
      const details: string[] = [];

      if (parsed.petitioner !== sample.petitioner) {
        sampleMatch = false;
        details.push(`petitioner: parsed="${parsed.petitioner}", db="${sample.petitioner}"`);
      }
      if (parsed.respondent !== sample.respondent) {
        sampleMatch = false;
        details.push(`respondent: parsed="${parsed.respondent}", db="${sample.respondent}"`);
      }
      if (!datesMatch(parsed.decisionDate, sample.decisionDate)) {
        sampleMatch = false;
        details.push(`decisionDate: parsed="${parsed.decisionDate ? parsed.decisionDate.toISOString() : null}", db="${sample.decisionDate ? sample.decisionDate.toISOString() : null}"`);
      }
      if (parsed.courtId !== sample.courtId) {
        sampleMatch = false;
        details.push(`courtId: parsed="${parsed.courtId}", db="${sample.courtId}"`);
      }

      if (sampleMatch) {
        console.log(`[${i + 1}/50] ID: ${sample.id} - ${sample.citationString} : OK`);
      } else {
        sampleFailures++;
        console.error(`[${i + 1}/50] ID: ${sample.id} - ${sample.citationString} : ❌ MISMATCH DETECTED`);
        for (const detail of details) {
          console.error(`  -> ${detail}`);
        }
      }
    }

    console.log(`\nSample Integrity Results: ${50 - sampleFailures} / 50 passed`);

    if (sampleFailures === 0) {
      console.log("✅ PASS: All 50 random samples passed integrity checks perfectly.");
    } else {
      console.log(`❌ FAIL: ${sampleFailures} samples failed integrity checks.`);
      allChecksPassed = false;
    }

    console.log("\n==========================================");
    if (allChecksPassed) {
      console.log("🎉 ALL VERIFICATION METRICS PASSED SUCCESSFULLY!");
      process.exitCode = 0;
    } else {
      console.error("❌ VERIFICATION SUITE FAILED - Check errors above.");
      process.exitCode = 1;
    }
    console.log("==========================================");

  } catch (err) {
    console.error("Critical error in verification suite:", err);
    process.exitCode = 1;
  } finally {
    console.log("🔌 Closing connection pool...");
    await pool.end();
    console.log("👋 Done.");
  }
}

main();
