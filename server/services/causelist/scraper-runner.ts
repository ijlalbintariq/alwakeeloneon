import { and, eq, sql } from "drizzle-orm";
import { db } from "../../db";
import * as schema from "@shared/schema";
import { CourtAdapter } from "./court-adapter";
import { ScrapeRunStats, ParsedCauseList, ParsedCaseItem } from "./types";
import { archiveCauseListDocument } from "./document-archiver";
import { runCauseListMatcher } from "./causelist-matcher";

export async function runScraperForDate(
  adapter: CourtAdapter,
  targetDate: string
): Promise<ScrapeRunStats> {
  const stats: ScrapeRunStats = {
    documentsFound: 0,
    documentsParsed: 0,
    itemsExtracted: 0,
    itemsInserted: 0,
    itemsUpdated: 0,
    errors: [],
  };

  if (!db) {
    console.error("[ScraperRunner] Database connection unavailable");
    stats.errors.push("Database connection unavailable");
    return stats;
  }

  // 1. Initialize scrape run audit log in DB
  let runId: number | null = null;
  try {
    const [insertedRun] = await db
      .insert(schema.causeListScrapeRuns)
      .values({
        court: adapter.courtCode,
        bench: "All Benches",
        targetDate,
        status: "running",
        documentsFound: 0,
        documentsParsed: 0,
        itemsExtracted: 0,
        itemsInserted: 0,
        itemsUpdated: 0,
      })
      .returning();
    runId = insertedRun.id;
  } catch (err: any) {
    console.error("[ScraperRunner] Failed to create scrape run log:", err.message);
  }

  try {
    console.log(`[ScraperRunner] Starting ${adapter.courtName} sync for ${targetDate}...`);

    // 2. Discover available cause lists
    const docs = await adapter.discoverLists(targetDate);
    stats.documentsFound = docs.length;

    for (const doc of docs) {
      try {
        // 3. Download document buffer
        const { buffer, mimeType, hash } = await adapter.downloadDocument(doc);
        if (buffer.length === 0) {
          continue; // 404 or not published yet
        }

        // 4. Check if exact file hash has already been ingested
        const existingWithHash = await db.query.courtCauseLists.findFirst({
          where: and(
            eq(schema.courtCauseLists.court, doc.court),
            eq(schema.courtCauseLists.bench, doc.bench),
            eq(schema.courtCauseLists.sourceHash, hash)
          ),
        });

        if (existingWithHash) {
          console.log(`[ScraperRunner] Skipping ${doc.bench} (${doc.listType}) — Hash ${hash.slice(0, 8)} already ingested.`);
          continue;
        }

        // 5. Archive raw PDF/HTML to Cloudflare R2
        const archiveResult = await archiveCauseListDocument(buffer, doc, mimeType);

        // 6. Parse document
        const parsedLists = await adapter.parseDocument(buffer, doc);
        stats.documentsParsed += parsedLists.length;

        for (const parsedList of parsedLists) {
          // 7. Validate through quality gate
          const validation = adapter.validate(parsedList);
          if (!validation.isValid) {
            console.warn(
              `[ScraperRunner] Skipping invalid list for ${doc.court} ${doc.bench}:`,
              validation.criticalErrors
            );
            stats.errors.push(`${doc.bench}: ${validation.criticalErrors.join("; ")}`);
            continue;
          }

          // 8. Persist roster header and case items
          const { inserted, updated } = await persistCauseList(parsedList, archiveResult.storageKey, hash);
          stats.itemsExtracted += parsedList.items.length;
          stats.itemsInserted += inserted;
          stats.itemsUpdated += updated;
        }
      } catch (docErr: any) {
        const errorMsg = `Error processing ${doc.bench} (${doc.listType}): ${docErr.message}`;
        console.error(`[ScraperRunner] ${errorMsg}`);
        stats.errors.push(errorMsg);
      }
    }

    // 9. Run automated confidence-based matching only if new items were actually ingested
    if (stats.itemsInserted > 0 || stats.itemsUpdated > 0) {
      try {
        await runCauseListMatcher(targetDate);
      } catch (matchErr: any) {
        console.error("[ScraperRunner] Error during cause list matching:", matchErr.message);
      }
    }

    // 10. Update scrape run log status
    if (runId) {
      const finalStatus = stats.errors.length === 0 ? "success" : stats.itemsInserted > 0 ? "partial" : "failed";
      await db
        .update(schema.causeListScrapeRuns)
        .set({
          status: finalStatus,
          finishedAt: new Date(),
          documentsFound: stats.documentsFound,
          documentsParsed: stats.documentsParsed,
          itemsExtracted: stats.itemsExtracted,
          itemsInserted: stats.itemsInserted,
          itemsUpdated: stats.itemsUpdated,
          errorMessage: stats.errors.length > 0 ? stats.errors.slice(0, 5).join(" | ") : null,
        })
        .where(eq(schema.causeListScrapeRuns.id, runId));
    }

    console.log(
      `[ScraperRunner] Finished ${adapter.courtName} for ${targetDate}. Inserted: ${stats.itemsInserted}, Updated: ${stats.itemsUpdated}, Errors: ${stats.errors.length}`
    );
  } catch (err: any) {
    console.error(`[ScraperRunner] Fatal error during ${adapter.courtName} sync:`, err);
    stats.errors.push(`Fatal error: ${err.message}`);
    if (runId) {
      await db
        .update(schema.causeListScrapeRuns)
        .set({
          status: "failed",
          finishedAt: new Date(),
          errorMessage: err.message,
        })
        .where(eq(schema.causeListScrapeRuns.id, runId));
    }
  }

  return stats;
}

/**
 * Persists a validated cause list and its items into PostgreSQL with conflict resolution
 */
async function persistCauseList(
  parsed: ParsedCauseList,
  storageKey: string | null,
  sourceHash: string
): Promise<{ inserted: number; updated: number }> {
  let inserted = 0;
  let updated = 0;

  // Insert or find roster header
  const [roster] = await db
    .insert(schema.courtCauseLists)
    .values({
      court: parsed.court,
      bench: parsed.bench,
      courtNumber: parsed.courtNumber || null,
      judgeName: parsed.judgeName,
      listType: parsed.listType,
      hearingDate: parsed.hearingDate,
      sourceHash,
      revisionNumber: 1,
      rawPdfUrl: parsed.rawPdfUrl || null,
      storageKey,
      status: "active",
      itemCount: parsed.items.length,
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
        judgeName: parsed.judgeName,
        sourceHash,
        storageKey,
        itemCount: parsed.items.length,
        updatedAt: new Date(),
      },
    })
    .returning();

  const causeListId = roster.id;

  // Insert items in batches
  for (const item of parsed.items) {
    try {
      const res = await db
        .insert(schema.courtCauseListItems)
        .values({
          causeListId,
          serialNumber: item.serialNumber,
          caseNumber: item.caseNumber,
          caseType: item.caseType || null,
          caseYear: item.caseYear || null,
          caseTitle: item.caseTitle,
          petitioner: item.petitioner || null,
          respondent: item.respondent || null,
          petitionerAdvocate: item.petitionerAdvocate || null,
          respondentAdvocate: item.respondentAdvocate || null,
          fixationPurpose: item.fixationPurpose || "For Hearing",
          isRedList: item.isRedList || false,
          rawText: item.rawText || null,
        })
        .onConflictDoUpdate({
          target: [
            schema.courtCauseListItems.causeListId,
            schema.courtCauseListItems.serialNumber,
            schema.courtCauseListItems.caseNumber,
          ],
          set: {
            caseTitle: item.caseTitle,
            petitioner: item.petitioner || null,
            respondent: item.respondent || null,
            petitionerAdvocate: item.petitionerAdvocate || null,
            respondentAdvocate: item.respondentAdvocate || null,
            fixationPurpose: item.fixationPurpose || "For Hearing",
            isRedList: item.isRedList || false,
          },
        })
        .returning();

      if (res.length > 0) {
        inserted++;
      }
    } catch (err: any) {
      console.warn(`[ScraperRunner] Error persisting case item ${item.caseNumber}:`, err.message);
    }
  }

  return { inserted, updated };
}
