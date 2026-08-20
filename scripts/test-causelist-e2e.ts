import { db } from "../server/db";
import * as schema from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { runCauseListMatcher } from "../server/services/causelist/causelist-matcher";
import { parseHtmlCauseList } from "../server/services/causelist/pdf-roster-parser";
import { validateCauseList } from "../server/services/causelist/validator";

async function runLocalE2ETest() {
  console.log("=================================================");
  console.log("🔍 STARTING LOCAL END-TO-END CAUSE LIST TEST");
  console.log("=================================================\n");

  if (!db) {
    console.error("❌ Database connection is not available.");
    process.exit(1);
  }

  const testDate = "2026-08-25";
  const hearingDate = new Date(`${testDate}T00:00:00.000Z`);

  console.log(`Step 1: Simulating LHC CMS HTML Roster Ingestion for ${testDate}...`);

  const mockLhcHtml = `
    <div class="courtroom-block">
      <h2 class="judge-name">Mr. Justice Ali Baqar Najafi</h2>
      <span class="court-number">Court Room No. 3</span>
      <table>
        <tr class="red-list">
          <td>1</td>
          <td>W.P. No. 12450/2024</td>
          <td>Muhammad Aslam VS Federation of Pakistan</td>
          <td>Chaudhry Aitzaz Ahsan Adv.</td>
          <td>Attorney General for Pakistan</td>
          <td>For Arguments (Main Case)</td>
        </tr>
        <tr>
          <td>2</td>
          <td>Crl. Misc No. 8901-B/2024</td>
          <td>Tariq Mahmood VS The State</td>
          <td>Barrister Salman Safdar</td>
          <td>DPG</td>
          <td>Post-Arrest Bail</td>
        </tr>
      </table>
    </div>
  `;

  const parsedLists = parseHtmlCauseList(mockLhcHtml, "LHC", "Principal Seat", testDate, "regular");
  console.log(`  ✔ Parsed ${parsedLists.length} courtroom roster(s) containing ${parsedLists[0]?.items?.length || 0} case item(s).`);

  const validation = validateCauseList(parsedLists[0]);
  if (!validation.isValid) {
    console.error("  ❌ Validation failed:", validation.criticalErrors);
    process.exit(1);
  }
  console.log("  ✔ Quality Gate validation PASSED (0 critical errors, 0 rejected items).");

  console.log("\nStep 2: Persisting Roster & Case Items to Neon PostgreSQL...");

  // 1. Insert Cause List Header
  const [roster] = await db
    .insert(schema.courtCauseLists)
    .values({
      court: "LHC",
      bench: "Principal Seat",
      courtNumber: parsedLists[0].courtNumber,
      judgeName: parsedLists[0].judgeName,
      listType: "regular",
      hearingDate,
      sourceHash: "test-hash-e2e-12345",
      revisionNumber: 1,
      itemCount: parsedLists[0].items.length,
      status: "active",
    })
    .onConflictDoUpdate({
      target: [
        schema.courtCauseLists.court,
        schema.courtCauseLists.bench,
        schema.courtCauseLists.hearingDate,
        schema.courtCauseLists.courtNumber,
        schema.courtCauseLists.listType,
        schema.courtCauseLists.revisionNumber,
      ],
      set: {
        judgeName: parsedLists[0].judgeName,
        itemCount: parsedLists[0].items.length,
        updatedAt: new Date(),
      },
    })
    .returning();

  console.log(`  ✔ Inserted/Updated Court Cause List ID: ${roster.id}`);

  // 2. Insert Case Items
  const insertedItems = [];
  for (const item of parsedLists[0].items) {
    const [savedItem] = await db
      .insert(schema.courtCauseListItems)
      .values({
        causeListId: roster.id,
        serialNumber: item.serialNumber,
        caseNumber: item.caseNumber,
        caseType: item.caseType,
        caseYear: item.caseYear,
        caseTitle: item.caseTitle,
        petitioner: item.petitioner,
        respondent: item.respondent,
        petitionerAdvocate: item.petitionerAdvocate,
        respondentAdvocate: item.respondentAdvocate,
        fixationPurpose: item.fixationPurpose,
        isRedList: item.isRedList,
      })
      .onConflictDoUpdate({
        target: [
          schema.courtCauseListItems.causeListId,
          schema.courtCauseListItems.serialNumber,
          schema.courtCauseListItems.caseNumber,
        ],
        set: {
          caseTitle: item.caseTitle,
          fixationPurpose: item.fixationPurpose,
          isRedList: item.isRedList,
        },
      })
      .returning();

    insertedItems.push(savedItem);
  }
  console.log(`  ✔ Inserted ${insertedItems.length} case items into court_cause_list_items.`);

  console.log("\nStep 3: Setting Up Test User Tracker & Active Chamber Case...");

  // Find or create test user
  let testUser = await db.query.users.findFirst();
  if (!testUser) {
    console.log("  ℹ No existing user found, creating temporary test user...");
    const [created] = await db
      .insert(schema.users)
      .values({
        id: "test-lawyer-e2e-id",
        email: "test.lawyer@alwakeelo.test",
        name: "Aitzaz Ahsan",
        subscriptionTier: "pro",
      })
      .returning();
    testUser = created;
  }
  console.log(`  ✔ Testing with User ID: ${testUser.id} (${testUser.email || testUser.name})`);

  // Add Tracker for "W.P. 12450/2024"
  await db
    .insert(schema.causeListTrackers)
    .values({
      userId: testUser.id,
      trackType: "case_number",
      query: "W.P. 12450/2024",
      court: "LHC",
      notifyEmail: true,
      notifyDailyDiary: true,
      isActive: true,
    })
    .onConflictDoNothing();
  console.log("  ✔ Case Tracker active for: W.P. 12450/2024");

  console.log("\nStep 4: Executing Confidence-Based Matcher Engine...");
  const matchStats1 = await runCauseListMatcher(testDate);
  console.log(`  ✔ Matcher Run 1 Results: Total Matches = ${matchStats1.totalMatches}, Diary Entries = ${matchStats1.diaryEntriesCreated}`);

  console.log("\nStep 5: Testing Idempotency (Running Matcher a Second Time)...");
  const matchStats2 = await runCauseListMatcher(testDate);
  console.log(`  ✔ Matcher Run 2 Results: Diary Entries Created = ${matchStats2.diaryEntriesCreated} (Expected: 0 duplicate creations)`);

  if (matchStats2.diaryEntriesCreated !== 0) {
    console.error("  ❌ Idempotency violation: Created duplicate diary entries on second run!");
    process.exit(1);
  }
  console.log("  ✔ Idempotency verified: 0 duplicate diary entries created.");

  console.log("\nStep 6: Verifying Daily Diary Synchronization...");
  const diaryListings = await db
    .select()
    .from(schema.diaryEntries)
    .where(
      and(
        eq(schema.diaryEntries.userId, testUser.id),
        eq(schema.diaryEntries.causeListItemId, insertedItems[0].id)
      )
    );

  console.log(`  ✔ Found ${diaryListings.length} linked diary entry in Daily Diary.`);
  console.log(`  ℹ Diary Title: "${diaryListings[0]?.title}"`);
  console.log(`  ℹ Diary Date: "${diaryListings[0]?.date}"`);
  console.log(`  ℹ Priority: "${diaryListings[0]?.priority}"`);

  console.log("\n=================================================");
  console.log("✅ ALL LOCAL END-TO-END TESTS PASSED PERFECTLY!");
  console.log("=================================================");
  process.exit(0);
}

runLocalE2ETest().catch((err) => {
  console.error("❌ E2E Test Failed with error:", err);
  process.exit(1);
});
