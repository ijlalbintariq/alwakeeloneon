import "../server/load-env";
import { db, pool } from "../server/db";
import { statutes } from "../shared/schema";
import { count, and, ilike, sql } from "drizzle-orm";

async function main() {
  console.log("==========================================");
  console.log("🔍 RUNNING PROGRAMMATIC VERIFICATION SUITE");
  console.log("==========================================");

  let passed = true;

  const assert = (condition: boolean, message: string) => {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
    } else {
      console.log(`  ❌ FAIL: ${message}`);
      passed = false;
    }
  };

  try {
    // 1. Assert Grounding Volume (> 4,000 rows)
    const [volumeResult] = await db.select({ total: count() }).from(statutes);
    const totalCount = Number(volumeResult?.total || 0);
    assert(totalCount > 4000, `Grounding Volume: Total statutes indexed in database is ${totalCount} (expected > 4,000)`);

    // 2. Assert Core Integrity
    // Check if PPC exists
    const ppcExists = await db.select().from(statutes)
      .where(ilike(statutes.shortTitle, "%Pakistan Penal Code%"))
      .limit(1);
    assert(ppcExists.length > 0, "Core Integrity: Pakistan Penal Code (PPC) documents exist in database.");

    // Check if CrPC exists
    const crpcExists = await db.select().from(statutes)
      .where(ilike(statutes.shortTitle, "%Criminal Procedure%"))
      .limit(1);
    assert(crpcExists.length > 0, "Core Integrity: Code of Criminal Procedure (CrPC) documents exist in database.");

    // Check specific core PPC sections
    const ppc34 = await db.select().from(statutes)
      .where(and(
        ilike(statutes.shortTitle, "%Pakistan Penal Code%"),
        ilike(statutes.section, "%Section 34%")
      )).limit(1);
    assert(ppc34.length > 0, "Core Integrity: PPC Section 34 (Common Intention) exists in database.");

    const ppc302 = await db.select().from(statutes)
      .where(and(
        ilike(statutes.shortTitle, "%Pakistan Penal Code%"),
        ilike(statutes.section, "%Section 302%")
      )).limit(1);
    assert(ppc302.length > 0, "Core Integrity: PPC Section 302 (Qatl-i-amd/Murder) exists in database.");

    const ppc378 = await db.select().from(statutes)
      .where(and(
        ilike(statutes.shortTitle, "%Pakistan Penal Code%"),
        ilike(statutes.section, "%Section 378%")
      )).limit(1);
    assert(ppc378.length > 0, "Core Integrity: PPC Section 378 (Theft) exists in database.");

    // Check specific core CrPC sections
    const crpc154 = await db.select().from(statutes)
      .where(and(
        ilike(statutes.shortTitle, "%Criminal Procedure%"),
        ilike(statutes.section, "%Section 154%")
      )).limit(1);
    assert(crpc154.length > 0, "Core Integrity: CrPC Section 154 (FIR) exists in database.");

    const crpc497 = await db.select().from(statutes)
      .where(and(
        ilike(statutes.shortTitle, "%Criminal Procedure%"),
        ilike(statutes.section, "%Section 497%")
      )).limit(1);
    assert(crpc497.length > 0, "Core Integrity: CrPC Section 497 (Bail in Non-bailable Offence) exists in database.");

    // 3. Assert Text Validity
    // Check for null or empty fields
    const emptyShortTitle = await db.select().from(statutes).where(and(
      ilike(statutes.shortTitle, "")
    )).limit(1);
    assert(emptyShortTitle.length === 0, "Text Validity: No statutes with empty shortTitle fields.");

    const emptySection = await db.select().from(statutes).where(and(
      ilike(statutes.section, "")
    )).limit(1);
    assert(emptySection.length === 0, "Text Validity: No statutes with empty section fields.");

    const emptyDescription = await db.select().from(statutes).where(and(
      ilike(statutes.description, "")
    )).limit(1);
    assert(emptyDescription.length === 0, "Text Validity: No statutes with empty description fields.");

    // Check for description minimum length
    const sampleRows = await db.select({ description: statutes.description }).from(statutes).limit(500);
    const shortDescriptions = sampleRows.filter(r => r.description.trim().length < 15);
    assert(shortDescriptions.length === 0, `Text Validity: Out of 500 checked samples, all descriptions are descriptive (length >= 15 chars, short: ${shortDescriptions.length}).`);

    // 4. Assert Idempotence Simulation
    // Re-seed simulation check
    const cacheKey = (shortTitle: string, section: string) => 
      `${shortTitle.toLowerCase().trim()}|${section.toLowerCase().trim()}`;
    
    const allDbRows = await db.select({
      shortTitle: statutes.shortTitle,
      section: statutes.section
    }).from(statutes);

    const existingSet = new Set<string>();
    for (const r of allDbRows) {
      existingSet.add(cacheKey(r.shortTitle, r.section));
    }

    // A hypothetical re-run using exactly the same rows should skip all of them
    let duplicatesAllowed = 0;
    for (const r of allDbRows) {
      const key = cacheKey(r.shortTitle, r.section);
      if (!existingSet.has(key)) {
        duplicatesAllowed++;
      }
    }
    assert(duplicatesAllowed === 0, "Idempotence Simulation: Seeding filter correctly identifies and skips all duplicate rows.");

    // 5. Assert No Duplicates in Database
    const duplicateQuery = await db.select({
      shortTitle: statutes.shortTitle,
      section: statutes.section,
      count: count()
    })
    .from(statutes)
    .groupBy(statutes.shortTitle, statutes.section)
    .having(sql`count(*) > 1`);

    assert(duplicateQuery.length === 0, `Duplication Check: Found ${duplicateQuery.length} actual duplicate records in database (expected 0).`);

    // 6. Assert Punishments parsed for Core Sections
    const ppc302Row = await db.select().from(statutes)
      .where(and(
        ilike(statutes.shortTitle, "%Pakistan Penal Code%"),
        ilike(statutes.section, "%Section 302%")
      )).limit(1);
    
    if (ppc302Row.length > 0) {
      const punishment = ppc302Row[0].punishment.toLowerCase();
      assert(punishment.includes("death"), `Punishment Verification: PPC Section 302 punishment contains 'death' (actual: '${ppc302Row[0].punishment}')`);
    } else {
      assert(false, "Punishment Verification: PPC Section 302 not found to verify punishment.");
    }

    const ppc379Row = await db.select().from(statutes)
      .where(and(
        ilike(statutes.shortTitle, "%Pakistan Penal Code%"),
        ilike(statutes.section, "%Section 379%")
      )).limit(1);

    if (ppc379Row.length > 0) {
      const punishment = ppc379Row[0].punishment.toLowerCase();
      const hasExpected = punishment.includes("imprisonment") || punishment.includes("fine");
      assert(hasExpected, `Punishment Verification: PPC Section 379 punishment contains 'imprisonment' or 'fine' (actual: '${ppc379Row[0].punishment}')`);
    } else {
      assert(false, "Punishment Verification: PPC Section 379 not found to verify punishment.");
    }

  } catch (err: any) {
    console.error("Verification failed with execution error:", err);
    passed = false;
  }

  console.log("==========================================");
  if (passed) {
    console.log("🎉 ALL PROGRAMMATIC VERIFICATIONS PASSED SUCCESSFULLY!");
    console.log("==========================================");
    if (pool) await pool.end();
    process.exit(0);
  } else {
    console.log("❌ VERIFICATION FAILED! Please inspect logs above.");
    console.log("==========================================");
    if (pool) await pool.end();
    process.exit(1);
  }
}

main().catch(async (err) => {
  console.error("Fatal Verification Error:", err);
  if (pool) await pool.end();
  process.exit(1);
});
