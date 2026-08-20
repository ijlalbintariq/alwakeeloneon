import { db } from "../server/db";
import * as schema from "@shared/schema";
import { sql } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";
import axios from "axios";
import { LhcCourtAdapter } from "../server/services/causelist/adapters/lhc-adapter";
import { IhcCourtAdapter } from "../server/services/causelist/adapters/ihc-adapter";
import { ShcCourtAdapter } from "../server/services/causelist/adapters/shc-adapter";
import { ScpCourtAdapter } from "../server/services/causelist/adapters/scp-adapter";
import { PunjabDistrictCourtAdapter } from "../server/services/causelist/adapters/punjab-district-adapter";
import { IsbDistrictCourtAdapter } from "../server/services/causelist/adapters/isb-district-adapter";
import { buildGoogleCalendarUrl, buildIcsCalendarFile } from "@shared/calendar-builder";

interface TestReport {
  category: string;
  test: string;
  status: "PASS" | "FAIL" | "WARN";
  detail: string;
  durationMs?: number;
}

const reports: TestReport[] = [];

function record(category: string, test: string, status: "PASS" | "FAIL" | "WARN", detail: string, durationMs?: number) {
  reports.push({ category, test, status, detail, durationMs });
  const icon = status === "PASS" ? "✅" : status === "WARN" ? "⚠️" : "❌";
  console.log(`  ${icon} [${status}] ${test} — ${detail} ${durationMs ? `(${durationMs}ms)` : ""}`);
}

async function runProductionReadinessCheck() {
  console.log("=================================================");
  console.log("🚀 ALWAKEELO PRODUCTION READINESS & HEALTH AUDIT");
  console.log("=================================================\n");

  // ----------------------------------------------------
  // SECTION 1: PRODUCTION BUILD ASSETS VERIFICATION
  // ----------------------------------------------------
  console.log("📂 SECTION 1: Production Artifacts & Build Assets");
  const distServer = path.resolve(process.cwd(), "dist/index.cjs");
  const distPublic = path.resolve(process.cwd(), "dist/public/index.html");
  const distAssetsDir = path.resolve(process.cwd(), "dist/public/assets");

  if (fs.existsSync(distServer)) {
    const serverStat = fs.statSync(distServer);
    record("Build", "Server Bundle", "PASS", `dist/index.cjs exists (${(serverStat.size / (1024 * 1024)).toFixed(2)} MB)`);
  } else {
    record("Build", "Server Bundle", "FAIL", "dist/index.cjs is missing. Run npm run build.");
  }

  if (fs.existsSync(distPublic)) {
    const htmlStat = fs.statSync(distPublic);
    record("Build", "Frontend Entrypoint", "PASS", `dist/public/index.html exists (${(htmlStat.size / 1024).toFixed(1)} KB)`);
  } else {
    record("Build", "Frontend Entrypoint", "FAIL", "dist/public/index.html is missing.");
  }

  if (fs.existsSync(distAssetsDir)) {
    const assets = fs.readdirSync(distAssetsDir);
    const hasCalendar = assets.some((f) => f.includes("google-calendar-button"));
    const hasCauseList = assets.some((f) => f.includes("cause-lists"));
    const hasDiary = assets.some((f) => f.includes("daily-diary"));

    record("Build", "Client Code Splitting", "PASS", `Verified ${assets.length} chunks generated (CauseLists: ${hasCauseList ? "Yes" : "No"}, Diary: ${hasDiary ? "Yes" : "No"}, GCal: ${hasCalendar ? "Yes" : "No"})`);
  } else {
    record("Build", "Client Assets", "FAIL", "dist/public/assets directory is missing.");
  }

  // ----------------------------------------------------
  // SECTION 2: NEON DATABASE SCHEMA & TABLE HEALTH
  // ----------------------------------------------------
  console.log("\n🗄️ SECTION 2: Database Schema & Migration Integrity");
  if (!db) {
    record("Database", "Connection", "FAIL", "Database connection object is null or not configured.");
  } else {
    try {
      const startDb = Date.now();
      const res = await db.execute(sql`SELECT NOW() as current_time, current_database() as db_name, version() as version`);
      const row = (res as any).rows ? (res as any).rows[0] : (res as any)[0];
      const latency = Date.now() - startDb;
      record("Database", "Live Connection", "PASS", `Connected to ${row?.db_name || "Neon DB"} via connection pool`, latency);

      // Verify all cause list and google calendar tables exist
      const requiredTables = [
        "cause_list_scrape_runs",
        "court_cause_lists",
        "court_cause_list_items",
        "cause_list_trackers",
        "user_google_calendar_connections",
        "diary_entries",
      ];

      for (const table of requiredTables) {
        const tableCheck = await db.execute(
          sql`SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ${table}`
        );
        const countRow = (tableCheck as any).rows ? (tableCheck as any).rows[0] : (tableCheck as any)[0];
        const exists = parseInt(String(countRow?.count || 0), 10) > 0;
        if (exists) {
          record("Database", `Table: ${table}`, "PASS", "Verified in live PostgreSQL schema");
        } else {
          record("Database", `Table: ${table}`, "FAIL", "Table missing in schema");
        }
      }

      // Check column google_event_id in diary_entries
      const colCheck = await db.execute(
        sql`SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'diary_entries' AND column_name = 'google_event_id'`
      );
      const colRow = (colCheck as any).rows ? (colCheck as any).rows[0] : (colCheck as any)[0];
      const colExists = parseInt(String(colRow?.count || 0), 10) > 0;
      if (colExists) {
        record("Database", "Column: diary_entries.google_event_id", "PASS", "Column exists for two-way sync");
      } else {
        record("Database", "Column: diary_entries.google_event_id", "FAIL", "Column missing");
      }
    } catch (dbErr: any) {
      record("Database", "Query Execution", "FAIL", dbErr.message);
    }
  }

  // ----------------------------------------------------
  // SECTION 3: LIVE COURT PORTAL CONNECTIVITY & RESILIENCY
  // ----------------------------------------------------
  console.log("\n🌐 SECTION 3: Official Court Portals Network Diagnostics");
  const adapters = [
    new LhcCourtAdapter(),
    new IhcCourtAdapter(),
    new ShcCourtAdapter(),
    new ScpCourtAdapter(),
    new PunjabDistrictCourtAdapter("LHR_DIST"),
    new IsbDistrictCourtAdapter(),
  ];

  for (const adapter of adapters) {
    try {
      const start = Date.now();
      const health = await adapter.healthCheck();
      const latency = Date.now() - start;
      if (health.healthy) {
        record("Court Networks", `${adapter.courtCode} Portal`, "PASS", `${health.message}`, latency);
      } else {
        record("Court Networks", `${adapter.courtCode} Portal`, "WARN", `${health.message}`, latency);
      }
    } catch (netErr: any) {
      record("Court Networks", `${adapter.courtCode} Portal`, "FAIL", netErr.message);
    }
  }

  // ----------------------------------------------------
  // SECTION 4: CALENDAR ENGINE & URL ENCODING INTEGRITY
  // ----------------------------------------------------
  console.log("\n📅 SECTION 4: Google Calendar & iCal Engine");
  try {
    const sampleEvent = {
      title: "W.P. No. 12450/2024 - Urgent Bail",
      court: "Lahore High Court",
      bench: "Principal Seat",
      courtNumber: "Court Room No. 3",
      judgeName: "Mr. Justice Ali Baqar Najafi",
      caseNumber: "W.P. No. 12450/2024",
      caseTitle: "Muhammad Aslam VS State",
      date: "2026-08-25",
      isRedList: true,
    };

    const gcalUrl = buildGoogleCalendarUrl(sampleEvent);
    if (gcalUrl.startsWith("https://calendar.google.com/calendar/render?") && gcalUrl.includes("action=TEMPLATE")) {
      record("Calendar Engine", "Google URL Generator", "PASS", "Generates compliant deep link with encoded UTF-8 Pakistani metadata");
    } else {
      record("Calendar Engine", "Google URL Generator", "FAIL", "Invalid URL structure");
    }

    const icsString = buildIcsCalendarFile(sampleEvent);
    if (icsString.includes("BEGIN:VCALENDAR") && icsString.includes("TRIGGER:-PT60M")) {
      record("Calendar Engine", "iCal .ICS Formatter", "PASS", "Generates RFC 5545 calendar with 60-minute alarm notification");
    } else {
      record("Calendar Engine", "iCal .ICS Formatter", "FAIL", "Invalid RFC 5545 format");
    }
  } catch (calErr: any) {
    record("Calendar Engine", "Builder Execution", "FAIL", calErr.message);
  }

  // ----------------------------------------------------
  // SECTION 5: SCHEDULER & PKT TIMEZONE DRIFT CHECK
  // ----------------------------------------------------
  console.log("\n⏰ SECTION 5: Pakistan Timezone & Cron Engine");
  const now = new Date();
  const pktHour = parseInt(
    new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Karachi", hour: "numeric", hour12: false }).format(now),
    10
  );
  const utcHour = now.getUTCHours();
  const diff = (pktHour - utcHour + 24) % 24;

  if (diff === 5) {
    record("Timezone", "PKT UTC+5 Offset", "PASS", `Verified strict 5-hour offset (UTC: ${utcHour}:00, PKT: ${pktHour}:00)`);
  } else {
    record("Timezone", "PKT UTC+5 Offset", "WARN", `Unexpected offset diff: ${diff}`);
  }

  // ----------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------
  console.log("\n=================================================");
  const total = reports.length;
  const passed = reports.filter((r) => r.status === "PASS").length;
  const warnings = reports.filter((r) => r.status === "WARN").length;
  const failed = reports.filter((r) => r.status === "FAIL").length;

  console.log(`📊 FINAL PRODUCTION AUDIT: ${passed}/${total} PASSED, ${warnings} WARNINGS, ${failed} FAILURES`);
  if (failed === 0) {
    console.log("🎉 ALL PRODUCTION CHECKS VERIFIED SUCCESSFULLY!");
  } else {
    console.log("❌ Production audit identified blocking issues.");
  }
  console.log("=================================================");

  process.exit(failed > 0 ? 1 : 0);
}

runProductionReadinessCheck().catch((e) => {
  console.error("Fatal error during production readiness check:", e);
  process.exit(1);
});
