import {
  STATUTE_DOMAINS,
  STATUTE_SECTIONS,
  LIMITATION_SCHEDULE_ENTRIES,
  COURT_FEE_SUIT_TYPES,
  PROVINCIAL_COURT_FEE_RULES,
  PAKISTAN_COURT_DIRECTORY,
  computeLimitationDeadline,
  calculateProvincialCourtFee,
  searchStatuteSections,
  getStatuteSectionsByDomain,
  getStatuteSectionById,
  searchCourts,
  getLimitationArticlesByCategory,
  formatLegalCitation,
  formatDraftingClause
} from "../client/src/experimental/data/statutesCompendiumData.js";

function runVerification() {
  console.log("=== WORKER M1 VERIFICATION SUITE ===");
  console.log("1. Total Domains:", STATUTE_DOMAINS.length);
  console.log("2. Total Sections:", STATUTE_SECTIONS.length);
  console.log("3. Total Limitation Articles:", LIMITATION_SCHEDULE_ENTRIES.length);
  console.log("4. Total Suit Types:", COURT_FEE_SUIT_TYPES.length);
  console.log("5. Total Court Records:", PAKISTAN_COURT_DIRECTORY.length);

  if (STATUTE_DOMAINS.length < 7) throw new Error("Expected at least 7 domains");
  if (STATUTE_SECTIONS.length < 20) throw new Error("Expected 20+ sections");
  if (LIMITATION_SCHEDULE_ENTRIES.length < 30) throw new Error("Expected 30+ limitation articles");
  if (PAKISTAN_COURT_DIRECTORY.length < 30) throw new Error("Expected 30+ courts");

  // Check 7 domains coverage
  const expectedDomains = ["civil", "criminal", "constitutional", "commercial", "evidence", "family", "special"];
  for (const d of expectedDomains) {
    const sections = getStatuteSectionsByDomain(d as any);
    console.log(`Domain [${d}] contains ${sections.length} sections.`);
    if (sections.length === 0) throw new Error(`Domain ${d} has no sections!`);
  }

  // Check landmark citations in sections
  const requiredPrecedents = [
    "PLD 2021 SC 429",
    "1998 SCMR 2268",
    "2022 SCMR 1891",
    "PLD 2020 SC 142",
    "PLD 2007 SC 539",
    "PLD 2019 SC 112",
    "PLD 2019 SC 675",
    "PLD 1998 SC 2235"
  ];
  for (const prec of requiredPrecedents) {
    const found = STATUTE_SECTIONS.some(s => s.landmarkCitations.some(c => c.citation.includes(prec)));
    console.log(`Landmark Precedent [${prec}]: ${found ? "FOUND" : "MISSING"}`);
    if (!found) throw new Error(`Required precedent ${prec} not found in STATUTE_SECTIONS!`);
  }

  // Test Limitation Calculation
  const art113 = LIMITATION_SCHEDULE_ENTRIES.find(e => e.article === "Art. 113")!;
  const satStart = new Date(2024, 4, 1); // 2024-05-01 -> +3 years -> 2027-05-01 (Saturday)
  const resSat = computeLimitationDeadline(art113, satStart, true);
  console.log("Art 113 Sat Rollover:", resSat.adjustedDeadline.getDay() === 1, resSat.isWeekendRollover, resSat.expiryFormatted);
  if (!resSat.isWeekendRollover || resSat.adjustedDeadline.getDay() !== 1) {
    throw new Error("Expected Saturday deadline to roll over to Monday");
  }

  const sunStart = new Date(2024, 4, 2); // 2024-05-02 -> +3 years -> 2027-05-02 (Sunday)
  const resSun = computeLimitationDeadline(art113, sunStart, true);
  console.log("Art 113 Sun Rollover:", resSun.adjustedDeadline.getDay() === 1, resSun.isWeekendRollover, resSun.expiryFormatted);
  if (!resSun.isWeekendRollover || resSun.adjustedDeadline.getDay() !== 1) {
    throw new Error("Expected Sunday deadline to roll over to Monday");
  }

  // Test Court Fees
  // Punjab: <=25k = 0
  const feePunjabExempt = calculateProvincialCourtFee("punjab", "recovery_money", 25000);
  if (feePunjabExempt.fee !== 0 || !feePunjabExempt.isExempt) throw new Error("Punjab 25k must be 0");

  // Punjab: 1M = 75,000 capped at 15,000
  const feePunjabCapped = calculateProvincialCourtFee("punjab", "recovery_money", 1000000);
  if (feePunjabCapped.fee !== 15000 || !feePunjabCapped.isCapped) throw new Error("Punjab 1M must be capped at 15000");

  // Sindh: 80M in SHC Original side capped at 50,000
  const feeSindhHC = calculateProvincialCourtFee("sindh", "recovery_money", 80000000);
  if (feeSindhHC.fee !== 50000 || !feeSindhHC.isCapped) throw new Error("Sindh 80M must be capped at 50000");

  // Fixed fee: Writ Petition = 500
  const feeWrit = calculateProvincialCourtFee("punjab", "constitutional_writ", 1000000);
  if (feeWrit.fee !== 500) throw new Error("Writ petition fee must be 500");

  // Test Search & Helpers
  const searchSec = searchStatuteSections("489-F");
  if (searchSec.length === 0) throw new Error("searchStatuteSections 489-F failed");

  const searchCt = searchCourts("Lahore");
  if (searchCt.length === 0) throw new Error("searchCourts Lahore failed");

  const citation = formatLegalCitation(STATUTE_SECTIONS[0]);
  if (!citation.includes("Code of Civil Procedure")) throw new Error("formatLegalCitation failed");

  const clause = formatDraftingClause(STATUTE_SECTIONS[0]);
  if (!clause.includes("STATUTORY PROVISION")) throw new Error("formatDraftingClause failed");

  console.log("=== ALL VERIFICATION CHECKS PASSED (100% SUCCESS) ===");
}

runVerification();
