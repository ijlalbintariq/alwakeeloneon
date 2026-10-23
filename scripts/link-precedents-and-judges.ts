import "../server/load-env";
import { pool, db } from "../server/db";
import { citationExtractor } from "../server/services/citation-extractor";
import { citationLinks, unresolvedCitations, judgeCaseLinks, judgments } from "../shared/schema";
import { sql, eq } from "drizzle-orm";
import * as fs from "fs";

const PAYLOAD_PATH = "/tmp/missing_judgments_to_upload.json";

function cleanJudgeName(raw: string): string | null {
  if (!raw) return null;
  let str = raw.trim();
  // Strip common honorifics & titles
  str = str.replace(/^(?:Hon[\'o]u?rable\s+|Mr\.\s+|Mrs\.\s+|Miss\s+|Dr\.\s+|Chief\s+Justice\s+|Justice\s+)+/gi, "");
  // Strip trailing suffixes like JJ, J., CJ, CJP
  str = str.replace(/[,.\s]+(?:JJ?|CJP|CJ|J\.|JJ\.)\s*$/gi, "");
  // Collapse whitespace and newlines
  str = str.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();

  if (str.length < 3 || str.length > 50) return null;

  const lower = str.toLowerCase();
  const blacklisted = [
    "advocate", "petitioner", "respondent", "versus", "order", "judgment",
    "section", "court", "state", "federation", "appeal", "petition", "writ",
    "bench", "dated", "annexure", "appellant", "applicant", "complainant"
  ];
  if (blacklisted.some(b => lower.includes(b))) return null;

  // Title case the name
  const titleCased = str
    .split(" ")
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");

  return `Justice ${titleCased}`;
}

function extractJudges(fullText: string, title: string): string[] {
  const judges = new Set<string>();

  // 1. Full text header: Present: Judge 1 and Judge 2, JJ
  const header = (fullText || "").slice(0, 2000);
  const presMatch = header.match(/Present\s*:\s*([^\n\r]+?)(?:,?\s*JJ?|\.|\r\n\r\n|\n\n|JUDGMENT|ORDER)/i);
  if (presMatch) {
    const rawGroup = presMatch[1];
    const parts = rawGroup.split(/\s+and\s+|,|&/i);
    for (const p of parts) {
      const c = cleanJudgeName(p);
      if (c) judges.add(c);
    }
  }

  // 2. Full text header: Before: Judge 1, J
  if (judges.size === 0) {
    const befMatch = header.match(/Before\s*:\s*([^\n\r]+?)(?:,?\s*JJ?|\.|\r\n\r\n|\n\n|JUDGMENT|ORDER)/i);
    if (befMatch) {
      const parts = befMatch[1].split(/\s+and\s+|,|&/i);
      for (const p of parts) {
        const c = cleanJudgeName(p);
        if (c) judges.add(c);
      }
    }
  }

  // 3. Full text header: Judge(s): ...
  if (judges.size === 0) {
    const jdgMatch = header.match(/Judge\(?s?\)?\s*:\s*([^\n\r]+?)(?:,?\s*JJ?|\.|\r\n\r\n|\n\n|JUDGMENT|ORDER)/i);
    if (jdgMatch) {
      const parts = jdgMatch[1].split(/\s+and\s+|,|&/i);
      for (const p of parts) {
        const c = cleanJudgeName(p);
        if (c) judges.add(c);
      }
    }
  }

  // 4. From Title: Honorable Justice <Name>
  if (judges.size === 0 && title && /Justice/i.test(title)) {
    const titleMatches = Array.from(title.matchAll(/(?:Hon[\'o]u?rable\s+)?Justice\s+([A-Za-z\s\.\-]+?)(?=\s+(?:Syed|Mr\.|Malik|Advocate|Rana|Ch\.|Qayyum|Altaf|Kashif|Zia|Nemo|,|\d|$))/gi));
    for (const tm of titleMatches) {
      const c = cleanJudgeName(tm[1]);
      if (c) judges.add(c);
    }
  }

  return Array.from(judges);
}

async function main() {
  console.log("===============================================================");
  console.log("🚀 ACTIVATING PRECEDENT GRAPH, MOST CITED & JUDGES DIRECTORY");
  console.log("===============================================================\n");

  if (!fs.existsSync(PAYLOAD_PATH)) {
    console.error(`Payload file ${PAYLOAD_PATH} not found!`);
    process.exit(1);
  }

  const payload: Array<{ year: number; journalId: number; page: number }> = JSON.parse(
    fs.readFileSync(PAYLOAD_PATH, "utf-8")
  );
  console.log(`📂 Loaded ${payload.length} target judgments from upload payload.`);

  const keyList = payload.map(p => `${p.year}:${p.journalId}:${p.page}`);

  // Fetch full records from Neon DB
  console.log("🔍 Fetching judgment records from Neon PostgreSQL...");
  const { rows } = await pool.query(
    `
    SELECT id, year, journal_id, page, citation_string, title, court_name_snapshot, full_text
    FROM judgments
    WHERE concat(year, ':', journal_id, ':', page) = ANY($1::text[])
  `,
    [keyList]
  );

  console.log(`   Found ${rows.length} judgments in Neon DB to process.\n`);

  let totalCitationLinks = 0;
  let totalUnresolvedCitations = 0;
  let totalJudgeLinks = 0;
  const distinctJudges = new Set<string>();

  const BATCH_SIZE = 25;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (row) => {
        // --- 1. Link Judges & Update Bench ---
        const judgesList = extractJudges(row.full_text, row.title);
        if (judgesList.length > 0) {
          const benchStr = judgesList.join(", ");
          await pool.query(
            `UPDATE judgments SET bench = $1, updated_at = NOW() WHERE id = $2`,
            [benchStr, row.id]
          );

          for (const judgeName of judgesList) {
            distinctJudges.add(judgeName);
            await pool.query(
              `
              INSERT INTO judge_case_links (judgment_id, judge_name, court_name, year)
              VALUES ($1, $2, $3, $4)
            `,
              [row.id, judgeName, row.court_name_snapshot, row.year]
            );
            totalJudgeLinks++;
          }
        }

        // --- 2. Extract Citations & Populate Precedent Graph ---
        if (row.full_text && row.full_text.length >= 100) {
          try {
            const result = await citationExtractor.processJudgment(row.id, row.full_text);
            totalCitationLinks += result.resolved;
            totalUnresolvedCitations += result.unresolved;
          } catch (e: any) {
            console.warn(`   Citation link error on ${row.citation_string}:`, e.message);
          }
        }
      })
    );

    const done = Math.min(i + BATCH_SIZE, rows.length);
    const pct = ((done / rows.length) * 100).toFixed(1);
    console.log(`   📊 [${pct.padStart(5)}%] ${done}/${rows.length} judgments linked | Citations: ${totalCitationLinks} | Judge links: ${totalJudgeLinks}`);
  }

  console.log("\n===============================================================");
  console.log("🎉 LINKING & ENRICHMENT COMPLETE");
  console.log("===============================================================");
  console.log(`  📖 Judgments Processed:        ${rows.length}`);
  console.log(`  🔗 Precedent Links Created:    ${totalCitationLinks}`);
  console.log(`  ❓ Unresolved Citations Added: ${totalUnresolvedCitations}`);
  console.log(`  👨‍⚖️ Judge-Case Links Created:   ${totalJudgeLinks}`);
  console.log(`  🏛️ Distinct Judges Connected:  ${distinctJudges.size}`);

  // Test Verification Queries
  console.log("\n--- Verification: Precedent Graph Sample ---");
  const graphSample = await pool.query(`
    SELECT j_src.citation_string as source_cit, cl.citation_type, j_tgt.citation_string as target_cit
    FROM citation_links cl
    JOIN judgments j_src ON cl.source_judgment_id = j_src.id
    JOIN judgments j_tgt ON cl.target_judgment_id = j_tgt.id
    WHERE concat(j_src.year, ':', j_src.journal_id, ':', j_src.page) = ANY($1::text[])
    LIMIT 3;
  `, [keyList]);
  console.log(graphSample.rows);

  console.log("\n--- Verification: Judges Directory Sample ---");
  const judgeSample = await pool.query(`
    SELECT jcl.judge_name, jcl.court_name, j.citation_string, j.year
    FROM judge_case_links jcl
    JOIN judgments j ON jcl.judgment_id = j.id
    WHERE concat(j.year, ':', j.journal_id, ':', j.page) = ANY($1::text[])
    LIMIT 5;
  `, [keyList]);
  console.log(judgeSample.rows);

  await pool.end();
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
