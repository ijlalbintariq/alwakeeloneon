import { Router, Request, Response } from "express";
import { and, eq, ilike, or, sql, desc, asc } from "drizzle-orm";
import { db } from "../db";
import * as schema from "@shared/schema";
import { isAuthenticated } from "../replit_integrations/auth/replitAuth";
import { runCauseListSync, getNextWorkingDayStr, getTodayStr } from "../services/causelist/causelist-cron";
import { LhcCourtAdapter } from "../services/causelist/adapters/lhc-adapter";
import { IhcCourtAdapter } from "../services/causelist/adapters/ihc-adapter";
import { ShcCourtAdapter } from "../services/causelist/adapters/shc-adapter";
import { ScpCourtAdapter } from "../services/causelist/adapters/scp-adapter";
import { PunjabDistrictCourtAdapter } from "../services/causelist/adapters/punjab-district-adapter";
import { IsbDistrictCourtAdapter } from "../services/causelist/adapters/isb-district-adapter";
import { CourtCode } from "../services/causelist/types";

const router = Router();
const adapters = {
  LHC: new LhcCourtAdapter(),
  IHC: new IhcCourtAdapter(),
  SHC: new ShcCourtAdapter(),
  SCP: new ScpCourtAdapter(),
  LHR_DIST: new PunjabDistrictCourtAdapter("LHR_DIST"),
  ISB_DIST: new IsbDistrictCourtAdapter(),
  RWP_DIST: new PunjabDistrictCourtAdapter("RWP_DIST"),
  FSD_DIST: new PunjabDistrictCourtAdapter("FSD_DIST"),
};

/**
 * GET /api/cause-lists
 * Filter cause lists by court, bench, date, judge, courtroom
 */
router.get("/cause-lists", async (req: Request, res: Response) => {
  if (!db) return res.status(503).json({ message: "Database unavailable" });

  try {
    const court = String(req.query.court || "LHC");
    const bench = req.query.bench ? String(req.query.bench) : undefined;
    const dateStr = req.query.date ? String(req.query.date) : getTodayStr();
    const judge = req.query.judge ? String(req.query.judge) : undefined;
    const courtNumber = req.query.courtNumber ? String(req.query.courtNumber) : undefined;
    const listType = req.query.listType ? String(req.query.listType) : undefined;

    const startOfDay = new Date(`${dateStr}T00:00:00.000Z`);
    const endOfDay = new Date(`${dateStr}T23:59:59.999Z`);

    const conditions: any[] = [
      eq(schema.courtCauseLists.court, court),
      sql`TO_CHAR(${schema.courtCauseLists.hearingDate}, 'YYYY-MM-DD') = ${dateStr}`,
      eq(schema.courtCauseLists.status, "active"),
    ];

    if (bench && bench !== "all") {
      conditions.push(ilike(schema.courtCauseLists.bench, `%${bench}%`));
    }
    if (judge) {
      conditions.push(ilike(schema.courtCauseLists.judgeName, `%${judge}%`));
    }
    if (courtNumber) {
      conditions.push(ilike(schema.courtCauseLists.courtNumber, `%${courtNumber}%`));
    }
    if (listType && listType !== "all") {
      conditions.push(eq(schema.courtCauseLists.listType, listType));
    }

    const lists = await db
      .select()
      .from(schema.courtCauseLists)
      .where(and(...conditions))
      .orderBy(asc(schema.courtCauseLists.courtNumber), asc(schema.courtCauseLists.judgeName));

    return res.json({
      court,
      bench: bench || "All Benches",
      targetDate: dateStr,
      count: lists.length,
      causeLists: lists,
    });
  } catch (err: any) {
    console.error("[CauseListAPI] Error fetching cause lists:", err);
    return res.status(500).json({ message: "Failed to fetch cause lists", error: err.message });
  }
});

/**
 * GET /api/cause-lists/search
 * Search across all cases by Case Number, Advocate Name, or Party Name
 */
router.get("/cause-lists/search", async (req: Request, res: Response) => {
  if (!db) return res.status(503).json({ message: "Database unavailable" });

  try {
    const q = String(req.query.q || "").trim();
    if (!q || q.length < 2) {
      return res.json({ query: q, total: 0, items: [] });
    }

    const court = req.query.court ? String(req.query.court) : undefined;
    const bench = req.query.bench ? String(req.query.bench) : undefined;
    const dateStr = req.query.date ? String(req.query.date) : undefined;
    const limit = Math.min(parseInt(String(req.query.limit || "50"), 10), 100);

    const conditions: any[] = [
      or(
        ilike(schema.courtCauseListItems.caseNumber, `%${q}%`),
        ilike(schema.courtCauseListItems.caseTitle, `%${q}%`),
        ilike(schema.courtCauseListItems.petitionerAdvocate, `%${q}%`),
        ilike(schema.courtCauseListItems.respondentAdvocate, `%${q}%`)
      ),
    ];

    if (court && court !== "all") {
      conditions.push(eq(schema.courtCauseLists.court, court));
    }
    if (bench && bench !== "all") {
      conditions.push(ilike(schema.courtCauseLists.bench, `%${bench}%`));
    }
    if (dateStr) {
      conditions.push(
        sql`TO_CHAR(${schema.courtCauseLists.hearingDate}, 'YYYY-MM-DD') = ${dateStr}`
      );
    }

    const items = await db
      .select({
        id: schema.courtCauseListItems.id,
        causeListId: schema.courtCauseListItems.causeListId,
        serialNumber: schema.courtCauseListItems.serialNumber,
        caseNumber: schema.courtCauseListItems.caseNumber,
        caseType: schema.courtCauseListItems.caseType,
        caseYear: schema.courtCauseListItems.caseYear,
        caseTitle: schema.courtCauseListItems.caseTitle,
        petitioner: schema.courtCauseListItems.petitioner,
        respondent: schema.courtCauseListItems.respondent,
        petitionerAdvocate: schema.courtCauseListItems.petitionerAdvocate,
        respondentAdvocate: schema.courtCauseListItems.respondentAdvocate,
        fixationPurpose: schema.courtCauseListItems.fixationPurpose,
        isRedList: schema.courtCauseListItems.isRedList,
        court: schema.courtCauseLists.court,
        bench: schema.courtCauseLists.bench,
        courtNumber: schema.courtCauseLists.courtNumber,
        judgeName: schema.courtCauseLists.judgeName,
        listType: schema.courtCauseLists.listType,
        hearingDate: schema.courtCauseLists.hearingDate,
      })
      .from(schema.courtCauseListItems)
      .innerJoin(
        schema.courtCauseLists,
        eq(schema.courtCauseListItems.causeListId, schema.courtCauseLists.id)
      )
      .where(and(...conditions))
      .orderBy(desc(schema.courtCauseLists.hearingDate), asc(schema.courtCauseListItems.serialNumber))
      .limit(limit);

    return res.json({
      query: q,
      total: items.length,
      items,
    });
  } catch (err: any) {
    console.error("[CauseListAPI] Search error:", err);
    return res.status(500).json({ message: "Search failed", error: err.message });
  }
});

/**
 * GET /api/cause-lists/:id
 * Get full courtroom cause list with all case items
 */
router.get("/cause-lists/:id", async (req: Request, res: Response) => {
  if (!db) return res.status(503).json({ message: "Database unavailable" });

  try {
    const listId = parseInt(String(req.params.id || ""), 10);
    if (isNaN(listId)) {
      return res.status(400).json({ message: "Invalid cause list ID" });
    }

    const causeList = await db.query.courtCauseLists.findFirst({
      where: eq(schema.courtCauseLists.id, listId),
    });

    if (!causeList) {
      return res.status(404).json({ message: "Cause list not found" });
    }

    const items = await db
      .select()
      .from(schema.courtCauseListItems)
      .where(eq(schema.courtCauseListItems.causeListId, listId))
      .orderBy(asc(schema.courtCauseListItems.serialNumber));

    return res.json({
      causeList,
      items,
    });
  } catch (err: any) {
    console.error("[CauseListAPI] Error fetching cause list details:", err);
    return res.status(500).json({ message: "Failed to fetch cause list details", error: err.message });
  }
});

/**
 * GET /api/cause-lists/user/trackers
 * Get user's active case/advocate trackers
 */
router.get("/cause-lists/user/trackers", isAuthenticated, async (req: Request, res: Response) => {
  if (!db) return res.status(503).json({ message: "Database unavailable" });

  try {
    const userId = (req.session as any).userId as string;
    const trackers = await db
      .select()
      .from(schema.causeListTrackers)
      .where(and(eq(schema.causeListTrackers.userId, userId), eq(schema.causeListTrackers.isActive, true)))
      .orderBy(desc(schema.causeListTrackers.createdAt));

    return res.json({ trackers });
  } catch (err: any) {
    console.error("[CauseListAPI] Error fetching trackers:", err);
    return res.status(500).json({ message: "Failed to fetch trackers", error: err.message });
  }
});

/**
 * POST /api/cause-lists/user/trackers
 * Add a new case or advocate tracker
 */
router.post("/cause-lists/user/trackers", isAuthenticated, async (req: Request, res: Response) => {
  if (!db) return res.status(503).json({ message: "Database unavailable" });

  try {
    const userId = (req.session as any).userId as string;
    const { trackType, query, court, notifyEmail, notifyDailyDiary } = req.body;

    if (!trackType || !query || String(query).trim().length < 2) {
      return res.status(400).json({ message: "trackType and a valid query are required" });
    }

    if (!["case_number", "advocate_name"].includes(trackType)) {
      return res.status(400).json({ message: "trackType must be 'case_number' or 'advocate_name'" });
    }

    const [tracker] = await db
      .insert(schema.causeListTrackers)
      .values({
        userId,
        trackType,
        query: String(query).trim(),
        court: court || null,
        notifyEmail: notifyEmail !== false,
        notifyDailyDiary: notifyDailyDiary !== false,
        isActive: true,
      })
      .returning();

    return res.status(201).json({ tracker });
  } catch (err: any) {
    console.error("[CauseListAPI] Error creating tracker:", err);
    return res.status(500).json({ message: "Failed to create tracker", error: err.message });
  }
});

/**
 * DELETE /api/cause-lists/user/trackers/:id
 * Delete a tracker
 */
router.delete("/cause-lists/user/trackers/:id", isAuthenticated, async (req: Request, res: Response) => {
  if (!db) return res.status(503).json({ message: "Database unavailable" });

  try {
    const userId = (req.session as any).userId as string;
    const trackerId = parseInt(String(req.params.id || ""), 10);
    if (isNaN(trackerId)) {
      return res.status(400).json({ message: "Invalid tracker ID" });
    }

    const result = await db
      .delete(schema.causeListTrackers)
      .where(and(eq(schema.causeListTrackers.id, trackerId), eq(schema.causeListTrackers.userId, userId)))
      .returning();

    if (result.length === 0) {
      return res.status(404).json({ message: "Tracker not found or unauthorized" });
    }

    return res.json({ success: true, deletedId: trackerId });
  } catch (err: any) {
    console.error("[CauseListAPI] Error deleting tracker:", err);
    return res.status(500).json({ message: "Failed to delete tracker", error: err.message });
  }
});

/**
 * GET /api/cause-lists/user/my-hearings
 * Get all upcoming hearings matching the user's cases or tracked advocate names
 */
router.get("/cause-lists/user/my-hearings", isAuthenticated, async (req: Request, res: Response) => {
  if (!db) return res.status(503).json({ message: "Database unavailable" });

  try {
    const userId = (req.session as any).userId as string;
    const dateStr = req.query.date ? String(req.query.date) : getTodayStr();

    const hearings = await db
      .select({
        id: schema.diaryEntries.id,
        date: schema.diaryEntries.date,
        time: schema.diaryEntries.time,
        title: schema.diaryEntries.title,
        description: schema.diaryEntries.description,
        priority: schema.diaryEntries.priority,
        completed: schema.diaryEntries.completed,
        causeListItemId: schema.diaryEntries.causeListItemId,
        caseNumber: schema.courtCauseListItems.caseNumber,
        caseTitle: schema.courtCauseListItems.caseTitle,
        petitionerAdvocate: schema.courtCauseListItems.petitionerAdvocate,
        respondentAdvocate: schema.courtCauseListItems.respondentAdvocate,
        court: schema.courtCauseLists.court,
        bench: schema.courtCauseLists.bench,
        judgeName: schema.courtCauseLists.judgeName,
        courtNumber: schema.courtCauseLists.courtNumber,
        serialNumber: schema.courtCauseListItems.serialNumber,
      })
      .from(schema.diaryEntries)
      .innerJoin(
        schema.courtCauseListItems,
        eq(schema.diaryEntries.causeListItemId, schema.courtCauseListItems.id)
      )
      .innerJoin(
        schema.courtCauseLists,
        eq(schema.courtCauseListItems.causeListId, schema.courtCauseLists.id)
      )
      .where(
        and(
          eq(schema.diaryEntries.userId, userId),
          sql`${schema.diaryEntries.date} >= ${dateStr}`
        )
      )
      .orderBy(asc(schema.diaryEntries.date), asc(schema.courtCauseListItems.serialNumber));

    return res.json({
      targetDate: dateStr,
      count: hearings.length,
      hearings,
    });
  } catch (err: any) {
    console.error("[CauseListAPI] Error fetching my hearings:", err);
    return res.status(500).json({ message: "Failed to fetch hearings", error: err.message });
  }
});

/**
 * GET /api/admin/cause-lists/runs
 * Get recent scrape run logs (Observability)
 */
router.get("/admin/cause-lists/runs", async (_req: Request, res: Response) => {
  if (!db) return res.status(503).json({ message: "Database unavailable" });

  try {
    const runs = await db
      .select()
      .from(schema.causeListScrapeRuns)
      .orderBy(desc(schema.causeListScrapeRuns.startedAt))
      .limit(50);

    return res.json({ runs });
  } catch (err: any) {
    console.error("[CauseListAPI] Error fetching scrape runs:", err);
    return res.status(500).json({ message: "Failed to fetch scrape runs", error: err.message });
  }
});

/**
 * POST /api/admin/cause-lists/trigger
 * Manually trigger scraping for a specific court and target date
 */
router.post("/admin/cause-lists/trigger", async (req: Request, res: Response) => {
  try {
    const court = req.body.court as CourtCode | undefined;
    const targetDate = req.body.targetDate ? String(req.body.targetDate) : undefined;

    const dateToSync = targetDate || getNextWorkingDayStr();
    console.log(`[CauseListAPI] Admin manually triggered sync for ${court || "All Courts"} on ${dateToSync}`);

    const stats = await runCauseListSync(court, dateToSync);
    return res.json({
      success: true,
      targetDate: dateToSync,
      stats,
    });
  } catch (err: any) {
    console.error("[CauseListAPI] Manual sync trigger error:", err);
    return res.status(500).json({ message: "Manual sync failed", error: err.message });
  }
});

/**
 * GET /api/admin/cause-lists/health
 * Check health & latency of court portals
 */
router.get("/admin/cause-lists/health", async (_req: Request, res: Response) => {
  try {
    const [lhcHealth, ihcHealth, shcHealth, scpHealth, lhrDistHealth, isbDistHealth] = await Promise.all([
      adapters.LHC.healthCheck(),
      adapters.IHC.healthCheck(),
      adapters.SHC.healthCheck(),
      adapters.SCP.healthCheck(),
      adapters.LHR_DIST.healthCheck(),
      adapters.ISB_DIST.healthCheck(),
    ]);

    return res.json({
      timestamp: new Date().toISOString(),
      courts: {
        LHC: lhcHealth,
        IHC: ihcHealth,
        SHC: shcHealth,
        SCP: scpHealth,
        LHR_DIST: lhrDistHealth,
        ISB_DIST: isbDistHealth,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ message: "Health check error", error: err.message });
  }
});

export default router;
