import { pool } from "./db";
import { runCauseListSync, getNextWorkingDayStr, getTodayStr } from "./services/causelist/causelist-cron";

async function runOnce() {
  console.log("==========================================");
  console.log("   AL WAKEELO CAUSE LIST SCRAPER ACTION   ");
  console.log("==========================================");

  try {
    // 1. Verify Database Connection First
    console.log("[Action] Verifying Neon DB connection...");
    await pool.query("SELECT 1");
    console.log("[Action] Neon PostgreSQL connected successfully.");

    // 2. Determine target date based on time of day
    const wave = process.env.SCRAPER_WAVE || "evening"; // 'evening' or 'morning'
    const targetDate = wave === "morning" ? getTodayStr() : getNextWorkingDayStr();
    
    console.log(`[Action] Running automated sync for wave: ${wave} | target date: ${targetDate}`);
    
    // 3. Run the synchronous scrape across all courts
    await runCauseListSync(undefined, targetDate);
    
    console.log("[Action] Sync complete. Exiting cleanly.");
    process.exit(0);
  } catch (err) {
    console.error("[Action] FATAL ERROR during execution:", err);
    process.exit(1);
  }
}

runOnce();
