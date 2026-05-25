import "../server/load-env";
import { db, pool } from "../server/db";
import { judgments } from "../shared/schema";
import { eq, inArray, sql } from "drizzle-orm";

interface ParsedMetadata {
  title: string | null;
  petitioner: string | null;
  respondent: string | null;
  decisionDate: Date | null;
  courtId: number | null;
  courtNameSnapshot: string | null;
}

/**
 * Safely parses decision dates in YYYY-MM-DD, DD-MM-YYYY, and textual date formats.
 */
export function parseDecisionDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d;
  }

  // DD-MM-YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1; // 0-indexed month
    const year = parseInt(dmyMatch[3], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }

  // Textual date format: "28th July 2017" or "28 July 2017"
  // Strip ordinals from day number (st, nd, rd, th)
  const cleaned = trimmed.replace(/\b(\d{1,2})(?:st|nd|rd|th)\b/gi, "$1");
  const d = new Date(cleaned);
  if (!isNaN(d.getTime())) return d;

  return null;
}

/**
 * Maps a court name string to one of the 7 standard courts in courts_ref.
 */
export function mapCourtToRefId(courtName: string): number | null {
  const normalized = courtName.trim().toLowerCase();
  
  if (normalized === "supreme court of pakistan" || normalized === "sc" || normalized.includes("supreme court")) {
    return 1;
  }
  if (normalized === "islamabad high court" || normalized === "ihc" || normalized.includes("islamabad high")) {
    return 2;
  }
  if (normalized === "lahore high court" || normalized === "lhc" || normalized.includes("lahore high")) {
    return 3;
  }
  if (normalized === "sindh high court" || normalized === "shc" || normalized.includes("sindh high")) {
    return 4;
  }
  if (normalized === "peshawar high court" || normalized === "phc" || normalized.includes("peshawar high")) {
    return 5;
  }
  if (normalized === "balochistan high court" || normalized === "bhc" || normalized.includes("balochistan high")) {
    return 6;
  }
  if (normalized === "federal shariat court" || normalized === "fsc" || normalized.includes("federal shariat")) {
    return 7;
  }

  return null;
}

/**
 * Extract Title, Date of Judgment, and Court Name from full text of a judgment.
 */
export function parseJudgmentHeader(fullText: string): ParsedMetadata {
  let title: string | null = null;
  let petitioner: string | null = null;
  let respondent: string | null = null;
  let decisionDate: Date | null = null;
  let courtId: number | null = null;
  let courtNameSnapshot: string | null = null;

  if (!fullText) {
    return { title, petitioner, respondent, decisionDate, courtId, courtNameSnapshot };
  }

  // 1. Title Extraction
  const titleRegex = /(?:^|\n)\s*Title\s*:\s*([\s\S]*?)(?=\n\s*(?:Case No\.?|Reported As|Date of Judgment|Result|JUDGMENT|ORDER|Judge\(s\)|Court Name|Court)\s*:|$)/i;
  const titleMatch = fullText.match(titleRegex);
  if (titleMatch) {
    title = titleMatch[1].trim();
    if (title) {
      // Split using a case-insensitive separator: vs, vs., v, v., versus
      const separatorRegex = /\s+(?:vs\.?|v\.?|versus)\s+/i;
      const sepMatch = separatorRegex.exec(title);
      if (sepMatch) {
        const index = sepMatch.index;
        const sepLength = sepMatch[0].length;
        petitioner = title.substring(0, index).trim();
        respondent = title.substring(index + sepLength).trim();
      } else {
        petitioner = title;
        respondent = null;
      }
    } else {
      title = null;
    }
  }

  // 2. Date of Judgment Extraction
  const dateRegex = /(?:^|\n)\s*Date of Judgment\s*:\s*([^\n]*)/i;
  const dateMatch = fullText.match(dateRegex);
  if (dateMatch) {
    const rawDateStr = dateMatch[1].trim();
    decisionDate = parseDecisionDate(rawDateStr);
  }

  // Fallback 1: Extract year from "Reported As" line
  if (!decisionDate) {
    const reportedAsRegex = /(?:^|\n)\s*Reported As\s*:\s*([^\n]*)/i;
    const reportedAsMatch = fullText.match(reportedAsRegex);
    if (reportedAsMatch) {
      const reportedAsStr = reportedAsMatch[1].trim();
      const yearMatch = reportedAsStr.match(/\b(19\d{2}|20[0-2]\d)\b/);
      if (yearMatch) {
        const year = parseInt(yearMatch[1], 10);
        decisionDate = new Date(year, 0, 1);
      }
    }
  }

  // Fallback 2: Extract year from Case No line (e.g. W.P. No. 30 of 1986)
  if (!decisionDate) {
    const caseNoRegex = /(?:^|\n)\s*Case No\.?\s*:\s*([^\n]*)/i;
    const caseNoMatch = fullText.match(caseNoRegex);
    if (caseNoMatch) {
      const caseNoStr = caseNoMatch[1].trim();
      const yearMatch = caseNoStr.match(/\b(19\d{2}|20[0-2]\d)\b/);
      if (yearMatch) {
        const year = parseInt(yearMatch[1], 10);
        decisionDate = new Date(year, 0, 1);
      }
    }
  }

  // 3. Court Name Extraction
  const courtRegex = /(?:^|\n)\s*(?:Court Name|Court)\s*:\s*([^\n]*)/i;
  const courtMatch = fullText.match(courtRegex);
  if (courtMatch) {
    const rawCourtStr = courtMatch[1].trim();
    if (rawCourtStr) {
      courtNameSnapshot = rawCourtStr;
      courtId = mapCourtToRefId(rawCourtStr);
    }
  }

  return {
    title,
    petitioner,
    respondent,
    decisionDate,
    courtId,
    courtNameSnapshot,
  };
}

async function runWithConcurrency(
  tasks: (() => Promise<void>)[],
  concurrency: number
) {
  let index = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (index < tasks.length) {
      const currentTaskIndex = index++;
      await tasks[currentTaskIndex]();
    }
  });
  await Promise.all(workers);
}

async function main() {
  const args = process.argv.slice(2);
  const limitArgIndex = args.indexOf("--limit") !== -1 ? args.indexOf("--limit") : args.indexOf("-l");
  const limit = limitArgIndex !== -1 ? parseInt(args[limitArgIndex + 1], 10) : null;
  const dryRun = args.includes("--dry-run");

  const startTime = Date.now();
  console.log("==========================================");
  console.log("🚀 RELATIONAL METADATA EXTRACTION PARSER (CONCURRENT)");
  console.log(`Dry Run: ${dryRun ? "ENABLED" : "DISABLED"}`);
  console.log(`Limit: ${limit !== null ? limit : "None"}`);
  console.log("==========================================");

  console.log("Fetching judgment IDs to process...");
  let idQuery = db.select({ id: judgments.id })
    .from(judgments)
    .where(sql`petitioner IS NULL OR decision_date IS NULL OR court_id IS NULL`);
  
  if (limit !== null) {
    idQuery = idQuery.limit(limit);
  }
  const allJudgments = await idQuery;

  const totalToProcess = allJudgments.length;
  console.log(`Found ${totalToProcess} judgments with null petitioner, decision date, or court id to process.`);

  if (totalToProcess === 0) {
    console.log("No judgments to process.");
    await pool.end();
    return;
  }

  const idsToProcess = allJudgments.map((j) => j.id);
  const CHUNK_SIZE = 5000;
  const chunkCount = Math.ceil(idsToProcess.length / CHUNK_SIZE);
  let processedCount = 0;
  let successCount = 0;
  let errorCount = 0;

  const tasks: (() => Promise<void>)[] = [];

  for (let i = 0; i < idsToProcess.length; i += CHUNK_SIZE) {
    const chunkIndex = i / CHUNK_SIZE + 1;
    const chunkIds = idsToProcess.slice(i, i + CHUNK_SIZE);
    
    tasks.push(async () => {
      // Fetch only the first 2000 characters of full text for the current batch chunk
      const records = await db.select({ 
        id: judgments.id, 
        fullText: sql<string>`substring(full_text from 1 for 2000)` 
      })
      .from(judgments)
      .where(inArray(judgments.id, chunkIds));

      const parsedBatch = records.map((r) => {
        try {
          const parsed = parseJudgmentHeader(r.fullText);
          return { id: r.id, parsed, ok: true };
        } catch (err) {
          console.error(`Failed to parse judgment ID ${r.id}:`, err);
          return { id: r.id, parsed: null, ok: false };
        }
      });

      if (dryRun) {
        let success = 0;
        let error = 0;
        for (const item of parsedBatch) {
          if (item.ok && item.parsed) {
            success++;
          } else {
            error++;
          }
        }
        console.log(`[Dry Run] Processed chunk ${chunkIndex}/${chunkCount}`);
        return;
      }

      // Perform batch update in a single multi-row UPDATE query using JSON array expansion
      try {
        const batchData = parsedBatch
          .filter((item) => item.ok && item.parsed)
          .map((item) => ({
            id: item.id,
            petitioner: item.parsed!.petitioner,
            respondent: item.parsed!.respondent,
            decision_date: item.parsed!.decisionDate ? item.parsed!.decisionDate.toISOString() : null,
            court_id: item.parsed!.courtId,
            court_name_snapshot: item.parsed!.courtNameSnapshot,
          }));

        if (batchData.length > 0) {
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
              FROM json_array_elements(${JSON.stringify(batchData)}::json) AS x
            ) AS v
            WHERE j.id = v.id;
          `);
        }
        
        const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`Processed chunk ${chunkIndex}/${chunkCount} (${parsedBatch.length} rows). Elapsed: ${elapsedSec}s`);
      } catch (txErr) {
        console.error(`Batch update failed for chunk ${chunkIndex}:`, txErr);
      }
    });
  }

  // Run tasks with concurrency of 4
  await runWithConcurrency(tasks, 4);

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log("==========================================");
  console.log("🎉 METADATA EXTRACTION COMPLETED");
  console.log(`Total Time Elapsed: ${totalTime}s`);
  console.log("==========================================");

  await pool.end();
}

// Only execute main when run directly
if (process.argv[1] && (process.argv[1].endsWith("extract-judgment-metadata.ts") || process.argv[1].endsWith("extract-judgment-metadata"))) {
  main().catch(async (e) => {
    console.error("Critical error in main:", e);
    await pool.end();
    process.exit(1);
  });
}
