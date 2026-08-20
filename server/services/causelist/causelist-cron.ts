import { CourtAdapter } from "./court-adapter";
import { LhcCourtAdapter } from "./adapters/lhc-adapter";
import { IhcCourtAdapter } from "./adapters/ihc-adapter";
import { ShcCourtAdapter } from "./adapters/shc-adapter";
import { ScpCourtAdapter } from "./adapters/scp-adapter";
import { PunjabDistrictCourtAdapter } from "./adapters/punjab-district-adapter";
import { IsbDistrictCourtAdapter } from "./adapters/isb-district-adapter";
import { runScraperForDate } from "./scraper-runner";
import { CourtCode, ScrapeRunStats } from "./types";

// Active adapters registry for all superior and district courts in Pakistan
const COURT_ADAPTERS: Record<CourtCode, CourtAdapter> = {
  LHC: new LhcCourtAdapter(),
  IHC: new IhcCourtAdapter(),
  SHC: new ShcCourtAdapter(),
  SCP: new ScpCourtAdapter(),
  LHR_DIST: new PunjabDistrictCourtAdapter("LHR_DIST"),
  ISB_DIST: new IsbDistrictCourtAdapter(),
  RWP_DIST: new PunjabDistrictCourtAdapter("RWP_DIST"),
  FSD_DIST: new PunjabDistrictCourtAdapter("FSD_DIST"),
  KHI_DIST: null as any,
  PHC: null as any,
  BHC: null as any,
};

let isSyncRunning = false;
let lastRanSlots: Record<string, string> = {}; // slotKey -> dateKey

export function getPktTime(date = new Date()): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  dayOfWeek: number;
  dateKey: string;
} {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
    weekday: "short",
  });

  const parts = formatter.formatToParts(date);
  const findVal = (type: string) => parts.find((p) => p.type === type)?.value || "";

  const year = parseInt(findVal("year"), 10);
  const month = parseInt(findVal("month"), 10);
  const day = parseInt(findVal("day"), 10);
  const hour = parseInt(findVal("hour"), 10);
  const minute = parseInt(findVal("minute"), 10);

  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  const dateKey = `${year}-${mm}-${dd}`;
  const dayOfWeek = date.getDay(); // 0 = Sun, 6 = Sat

  return { year, month, day, hour, minute, dayOfWeek, dateKey };
}

export function getNextWorkingDayStr(baseDate = new Date()): string {
  const pkt = getPktTime(baseDate);
  const next = new Date(Date.UTC(pkt.year, pkt.month - 1, pkt.day + 1));
  const dayOfWeek = next.getUTCDay();

  // If Sunday (0), move to Monday
  if (dayOfWeek === 0) {
    next.setUTCDate(next.getUTCDate() + 1);
  }

  const y = next.getUTCFullYear();
  const m = String(next.getUTCMonth() + 1).padStart(2, "0");
  const d = String(next.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getTodayStr(baseDate = new Date()): string {
  const pkt = getPktTime(baseDate);
  return pkt.dateKey;
}

/**
 * Executes scraping for all active courts or a specific court
 */
export async function runCauseListSync(
  courtCode?: CourtCode,
  customTargetDate?: string
): Promise<Record<string, ScrapeRunStats>> {
  if (isSyncRunning) {
    console.log("[CauseListCron] Sync is already in progress, skipping concurrent trigger");
    return {};
  }

  isSyncRunning = true;
  const results: Record<string, ScrapeRunStats> = {};

  try {
    const targetDate = customTargetDate || getNextWorkingDayStr();
    console.log(`[CauseListCron] Triggering sync for target date: ${targetDate}...`);

    const adaptersToRun = courtCode
      ? [COURT_ADAPTERS[courtCode]].filter(Boolean)
      : Object.values(COURT_ADAPTERS).filter(Boolean);

    for (const adapter of adaptersToRun) {
      try {
        const stats = await runScraperForDate(adapter, targetDate);
        results[adapter.courtCode] = stats;
      } catch (err: any) {
        console.error(`[CauseListCron] Error running adapter for ${adapter.courtCode}:`, err);
        results[adapter.courtCode] = {
          documentsFound: 0,
          documentsParsed: 0,
          itemsExtracted: 0,
          itemsInserted: 0,
          itemsUpdated: 0,
          errors: [err.message],
        };
      }
    }
  } finally {
    isSyncRunning = false;
  }

  return results;
}

/**
 * Multi-wave cron schedule checker
 */
async function checkScheduleAndRun(): Promise<void> {
  const pkt = getPktTime();
  const todayKey = pkt.dateKey;

  // Wave 1: 18:00 PKT (18:00 - 18:15 window) -> Tomorrow's Regular List
  if (pkt.hour === 18 && pkt.minute < 15 && lastRanSlots["wave1"] !== todayKey) {
    lastRanSlots["wave1"] = todayKey;
    const targetDate = getNextWorkingDayStr();
    console.log(`[CauseListCron] Wave 1 trigger (18:00 PKT) for target: ${targetDate}`);
    await runCauseListSync(undefined, targetDate);
  }

  // Wave 2: 20:30 PKT (20:30 - 20:45 window) -> Main Evening Sync
  if (pkt.hour === 20 && pkt.minute >= 30 && pkt.minute < 45 && lastRanSlots["wave2"] !== todayKey) {
    lastRanSlots["wave2"] = todayKey;
    const targetDate = getNextWorkingDayStr();
    console.log(`[CauseListCron] Wave 2 trigger (20:30 PKT) for target: ${targetDate}`);
    await runCauseListSync(undefined, targetDate);
  }

  // Wave 3: 22:30 PKT (22:30 - 22:45 window) -> Late Night Additions & Urgent Lists
  if (pkt.hour === 22 && pkt.minute >= 30 && pkt.minute < 45 && lastRanSlots["wave3"] !== todayKey) {
    lastRanSlots["wave3"] = todayKey;
    const targetDate = getNextWorkingDayStr();
    console.log(`[CauseListCron] Wave 3 trigger (22:30 PKT) for target: ${targetDate}`);
    await runCauseListSync(undefined, targetDate);
  }

  // Wave 4: 07:30 PKT (07:30 - 07:45 window) -> Morning Supplementary / Emergency Lists
  if (pkt.hour === 7 && pkt.minute >= 30 && pkt.minute < 45 && lastRanSlots["wave4"] !== todayKey) {
    lastRanSlots["wave4"] = todayKey;
    const targetDate = getTodayStr();
    console.log(`[CauseListCron] Wave 4 trigger (07:30 PKT) for target: ${targetDate}`);
    await runCauseListSync(undefined, targetDate);
  }
}

/**
 * Initializes the automated multi-wave cron worker
 */
export function startCauseListScheduler(): void {
  console.log("[CauseListCron] Multi-wave Cause List scheduler started (18:00, 20:30, 22:30, 07:30 PKT).");

  // Check every 5 minutes
  setInterval(() => {
    checkScheduleAndRun().catch((err) =>
      console.error("[CauseListCron] Scheduler error:", err?.message || err)
    );
  }, 5 * 60 * 1000);

  // Initial check after 45 seconds startup delay
  setTimeout(() => {
    checkScheduleAndRun().catch((err) =>
      console.error("[CauseListCron] Startup check error:", err?.message || err)
    );
  }, 45 * 1000);
}
