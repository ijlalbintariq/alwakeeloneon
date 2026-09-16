/**
 * citation_audit.ts — how many case_law citations are REAL?
 *
 * Replicates the exact matching the MCP tools do:
 *   SQL-normalized judgments.citation_string  ==  JS normalizeCitation(case_law.citation) variant
 *
 * Reports:
 *   1. table sizes
 *   2. duplicate normalized citations in judgments (breaks even exact matching)
 *   3. verified vs unverified case_law rows
 *   4. how many unverified rows the OLD `LIKE %citation%` fallback would have
 *      silently bound to a WRONG judgment  <-- the blast radius of the bug
 *   5. a sample of unverifiable citations (likely LLM-fabricated)
 *
 * Run:  npx tsx citation_audit.ts
 */
import { readFileSync } from "node:fs";
import { Client } from "pg";

// ---------------------------------------------------------------- env
function loadEnv(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const raw = readFileSync(new URL(".env", import.meta.url), "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*DATABASE_URL\s*=\s*(.*)$/);
    if (!m) continue;
    return m[1].trim().replace(/^["']|["']$/g, "");
  }
  throw new Error("DATABASE_URL not found in env or .env");
}

// ------------------------------------------- normalizeCitation (copy of mcp-server.ts)
function normalizeCitation(raw: string): string[] {
  let s = String(raw || "").toUpperCase().trim();

  s = s.replace(/P\s*\.?\s*CR?\s*\.?\s*L\s*\.?\s*J\s*\.?\s*N(?:OTES?)?/gi, "PCRLJN");
  s = s.replace(/P\s*\.?\s*CR?\s*\.?\s*L\s*\.?\s*J\b/gi, "PCRLJ");
  s = s.replace(/PLC\s*\(?\s*C\.?\s*S\.?\s*\)?\s*N(?:OTES?)?\s*/gi, "PLCCSN ");
  s = s.replace(/PLC\s*\(?\s*C\.?\s*S\.?\s*\)?\s*/gi, "PLCCS ");
  s = s.replace(/Y\.?\s*L\.?\s*R\.?\s*N(?:OTES?)?/gi, "YLRN");
  s = s.replace(/C\.?\s*L\.?\s*C\.?\s*N(?:OTES?)?/gi, "CLCN");
  s = s.replace(/PLC\s*N(?:OTES?)?/gi, "PLCN");
  s = s.replace(/S\.?\s*C\.?\s*M\.?\s*R\.?/gi, "SCMR");
  s = s.replace(/P\.?\s*L\.?\s*D\.?/gi, "PLD");
  s = s.replace(/G\.?\s*B\.?\s*L\.?\s*R\.?/gi, "GBLR");
  s = s.replace(/P\.?\s*S\.?\s*C\.?/gi, "PSC");

  s = s.replace(/[.,()[\]]/g, "");

  const COURT_SEATS = [
    "SUPREME COURT OF PAKISTAN", "SUPREME COURT",
    "LAHORE HIGH COURT", "SINDH HIGH COURT", "PESHAWAR HIGH COURT",
    "BALOCHISTAN HIGH COURT", "ISLAMABAD HIGH COURT", "HIGH COURT",
  ];
  for (const seat of COURT_SEATS) s = s.replace(new RegExp(seat, "gi"), " ");

  const SINGLE_SEATS = [
    "LAHORE", "LAH", "KARACHI", "KAR", "SINDH", "PESHAWAR", "PESH",
    "BALOCHISTAN", "ISLAMABAD", "QUETTA", "MULTAN", "RAWALPINDI",
    "BAHAWALPUR", "ABBOTTABAD", "FAISALABAD", "HYDERABAD", "SUKKUR",
  ];
  s = s.replace(/\bSC\b(?!MR)/g, " ");
  for (const seat of SINGLE_SEATS) s = s.replace(new RegExp(`\\b${seat}\\b`, "gi"), " ");

  s = s.replace(/\s+/g, " ").trim();

  const variants: string[] = [];
  variants.push(s.replace(/\s+/g, ""));

  const journalFirst = s.match(/^([A-Z]+)\s+(\d{4})\s+(.+)$/);
  if (journalFirst) {
    const [, journal, year, rest] = journalFirst;
    const flipped = `${year}${journal}${rest.replace(/\s+/g, "")}`;
    if (!variants.includes(flipped)) variants.push(flipped);
  }
  const yearFirst = s.match(/^(\d{4})\s+([A-Z]+)\s+(.+)$/);
  if (yearFirst) {
    const [, year, journal, rest] = yearFirst;
    const flipped = `${journal}${year}${rest.replace(/\s+/g, "")}`;
    if (!variants.includes(flipped)) variants.push(flipped);
  }
  return [...new Set(variants)].filter(Boolean);
}

// ---------------------------------------------------------------- main
const SQL_NORM =
  "upper(replace(replace(replace(replace(replace(citation_string,' ',''),'.',''),'(',''),')',''),',',''))";

async function main() {
  const client = new Client({
    connectionString: loadEnv(),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  console.log("connected\n");

  // 1. sizes
  const { rows: [sizes] } = await client.query(`
    SELECT (SELECT count(*) FROM judgments)                   AS judgments,
           (SELECT count(*) FROM judgments WHERE is_active)   AS judgments_active,
           (SELECT count(*) FROM case_law)                    AS case_law
  `);
  console.log("== TABLE SIZES ==");
  console.log(`judgments        : ${sizes.judgments} (active ${sizes.judgments_active})`);
  console.log(`case_law         : ${sizes.case_law}\n`);

  // 2. duplicate normalized citations inside judgments
  const { rows: dupes } = await client.query(`
    SELECT ${SQL_NORM} AS n, count(*) AS c
    FROM judgments
    GROUP BY 1 HAVING count(*) > 1
    ORDER BY c DESC LIMIT 10
  `);
  console.log("== DUPLICATE CITATIONS IN judgments ==");
  if (dupes.length === 0) console.log("none — good, citations are unique\n");
  else {
    console.log(`${dupes.length}+ normalized citations map to >1 judgment row:`);
    for (const d of dupes) console.log(`  ${d.n}  x${d.c}`);
    console.log("  ^ exact match picks an ARBITRARY one of these. Dedupe them.\n");
  }

  // 3. load judgments index into memory
  const { rows: jrows } = await client.query(
    `SELECT id, citation_string, ${SQL_NORM} AS n FROM judgments`
  );
  const byNorm = new Map<string, string>();
  const allNorms: string[] = [];
  for (const r of jrows) {
    if (!r.n) continue;
    if (!byNorm.has(r.n)) byNorm.set(r.n, r.id);
    allNorms.push(r.n);
  }

  // 4. walk case_law
  const { rows: crows } = await client.query(
    `SELECT id, citation, title, court FROM case_law ORDER BY id`
  );

  const verified: any[] = [];
  const unverified: any[] = [];
  for (const c of crows) {
    const variants = normalizeCitation(c.citation);
    const hit = variants.find((v) => byNorm.has(v));
    if (hit) verified.push({ ...c, judgmentId: byNorm.get(hit) });
    else unverified.push({ ...c, variants });
  }

  const pct = (n: number) => ((n / Math.max(1, crows.length)) * 100).toFixed(1);
  console.log("== CITATION VERIFICATION ==");
  console.log(`verified   (real judgment exists) : ${verified.length}  (${pct(verified.length)}%)`);
  console.log(`UNVERIFIED (no matching judgment) : ${unverified.length}  (${pct(unverified.length)}%)`);
  console.log("  ^ unverified rows are now withheld by search_case_law by default.\n");

  // 5. blast radius of the old LIKE fallback
  const sample = unverified.slice(0, 300);
  let wouldMisbind = 0;
  const examples: string[] = [];
  for (const u of sample) {
    for (const v of u.variants) {
      if (!v) continue;
      const wrong = allNorms.find((n) => n.includes(v));
      if (wrong) {
        wouldMisbind++;
        if (examples.length < 8) examples.push(`  "${u.citation}"  ->  LIKE matched "${wrong}"`);
        break;
      }
    }
  }
  console.log("== OLD `LIKE %citation%` FALLBACK BLAST RADIUS ==");
  console.log(`of ${sample.length} unverified rows sampled, ${wouldMisbind} would have been`);
  console.log(`silently bound to a DIFFERENT, WRONG judgment by the old code:`);
  for (const e of examples) console.log(e);
  console.log("");

  // 6. sample of unverifiable citations
  console.log("== SAMPLE UNVERIFIABLE CITATIONS (likely fabricated by extraction) ==");
  for (const u of unverified.slice(0, 15)) {
    console.log(`  [case_law:${u.id}] ${u.citation}  |  ${String(u.title).slice(0, 60)}`);
  }

  await client.end();
}

main().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
