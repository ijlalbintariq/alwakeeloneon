// Test what the regex patterns actually look like
const REPORT_CODES = [
  "PLD", "SCMR", "YLR", "MLD", "CLC", "PCRLJ", "PLJ", "PLC", "NLR",
  "PSC", "ALD", "KLR", "PTD", "PTCL", "PLS", "GBLR", "TAX", "CLD", "SLR",
  "AIR",
];

function buildFlexibleReportPattern(code) {
  return String(code || "").replace(/[^A-Za-z]/g, "").split("").map((ch) => `${ch}\\.?`).join("\\s*");
}

const REPORT_ABBRS = REPORT_CODES.map(buildFlexibleReportPattern).join("|");
const YEAR_PATTERN  = "(?:19|20)\\d{2}";
const PAGE_PATTERN  = "\\d{1,6}";
const SEP           = "\\s*[,;:/-]?\\s*";
const COURT_NAMES = "Supreme\\s+Court|Lahore|Sindh|Peshawar|Balochistan|Islamabad|ISB|Federal\\s+Shariat|FSC|Rawalpindi|Multan|Bahawalpur|Azad\\s+J(?:ammu)?\\s*(?:&|and)\\s*K(?:ashmir)?|AJK|Privy\\s+Council";

// Test against known failing citations
const testCitations = [
  "PLD 1970 Dacca 394",
  "PLD 1971 Rev. (Punjab) 43",
  "PLD 1971 (Revenue) Sind 27",
  "PLD 1971 Baghdad-ul-Jadid 17",
  "1973 P Cr. L, J 225",
  "1975 PLC (C.S.T.) 129",
  "1975 PLC l2",
  "PLJ 2019 Cr.C. 1204",
  "KLR 2019 Labour & Service Cases 110",
  "45 TAX 123",
  "2019 SC AJK 136",
  "2019 P.S.C. (Crl.) 180",
  "2024 FTO 2",
  "2019 PCTLR 1111",
  "PLJ 2019 SC (AJ&K) 122",
  "K.L.R. 1993 Criminal Cases 197",
  "1982 C\` L C 1166",
  "1975 P L CtC.S.T.l 116",
];

const CITATION_PATTERNS = [
  new RegExp(`\\b${YEAR_PATTERN}\\s*(?:${buildFlexibleReportPattern("LHC")}|${buildFlexibleReportPattern("IHC")}|${buildFlexibleReportPattern("SHC")}|${buildFlexibleReportPattern("PHC")}|${buildFlexibleReportPattern("BHC")}|${buildFlexibleReportPattern("AJKHC")})\\s*${PAGE_PATTERN}\\b`, "gi"),
  new RegExp(`(?:${REPORT_ABBRS})${SEP}${YEAR_PATTERN}${SEP}(?:${COURT_NAMES})${SEP}${PAGE_PATTERN}`, "gi"),
  new RegExp(`(?:${REPORT_ABBRS})${SEP}${YEAR_PATTERN}${SEP}${PAGE_PATTERN}`, "gi"),
  new RegExp(`${YEAR_PATTERN}${SEP}(?:${REPORT_ABBRS})${SEP}(?:${COURT_NAMES})${SEP}${PAGE_PATTERN}`, "gi"),
  new RegExp(`${YEAR_PATTERN}${SEP}(?:${REPORT_ABBRS})${SEP}${PAGE_PATTERN}`, "gi"),
  new RegExp(`\\(${YEAR_PATTERN}\\)${SEP}(?:${REPORT_ABBRS})${SEP}(?:${COURT_NAMES})?${SEP}${PAGE_PATTERN}`, "gi"),
  new RegExp(`(?:${REPORT_ABBRS})${SEP}\\(${YEAR_PATTERN}\\)${SEP}(?:${COURT_NAMES})?${SEP}${PAGE_PATTERN}`, "gi"),
];

console.log("=== TESTING CITATION PATTERNS AGAINST KNOWN FAILING VALUES ===\n");

for (const test of testCitations) {
  let matched = false;
  for (let i = 0; i < CITATION_PATTERNS.length; i++) {
    const p = CITATION_PATTERNS[i];
    p.lastIndex = 0;
    const m = p.exec(test);
    if (m) {
      console.log(`✅ "${test}" → matched by pattern ${i}: "${m[0]}"`);
      matched = true;
      break;
    }
  }
  if (!matched) {
    console.log(`❌ "${test}" → NOT matched by any pattern`);
  }
}

// Test the "Reported As:" line extraction
console.log("\n=== TESTING 'REPORTED AS:' EXTRACTION ===\n");

const sampleTexts = [
  `Court Name: Dacca\nJudge(s): B. A. Siddiqi\nReported As: PLD 1970 Dacca 338\nResult: Rule discharged`,
  `Case No.: Criminal Appeal No, 35-L of 1983\nReported As: PLD 1984 Federal Shariat Court 59\nResult: Conviction altered`,
  `Reported As: 1975 PLC (C.S.T.) 129\nResult: N/A`,
  `Reported As: PLJ 2019 Cr.C. 1204\nResult: Bail granted`,
];

const REPORTED_AS_RE = /Reported\s+As:\s*([^\n]+)/i;
for (const t of sampleTexts) {
  const m = t.match(REPORTED_AS_RE);
  if (m) {
    console.log(`  Found: "${m[1].trim()}"`);
    // Now test if any CITATION_PATTERN matches this value
    const val = m[1].trim();
    let patternMatched = false;
    for (let i = 0; i < CITATION_PATTERNS.length; i++) {
      const p = CITATION_PATTERNS[i];
      p.lastIndex = 0;
      const pm = p.exec(val);
      if (pm) {
        console.log(`    → Pattern ${i} matches: "${pm[0]}"`);
        patternMatched = true;
        break;
      }
    }
    if (!patternMatched) console.log(`    → ❌ No pattern matches this value`);
  }
}
