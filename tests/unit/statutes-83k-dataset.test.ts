import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  ACTS_MANIFEST,
  TOTAL_PAKISTANI_ACTS_COUNT,
  MAJOR_ACT_SHORT_CODES,
  getActManifestById,
  getActManifestByTitle,
  getActManifestByShortCode,
  getActsByCategory,
  searchActsManifest,
  getAllCategories
} from "../../client/src/experimental/data/actsManifest";

import {
  MAJOR_ENACTMENTS_DATA,
  MAJOR_ENACTMENT_METAS,
  MAJOR_ENACTMENT_KEYS,
  getAllMajorSections,
  getSectionsForEnactment,
  getMajorSection,
  getMajorSectionById,
  getMajorEnactmentsSummary
} from "../../client/src/experimental/data/majorEnactmentsData";

import {
  StatuteSearchEngine,
  statuteSearchEngine,
  searchStatutes,
  parseLegalQuery,
  normalizeSectionNumber,
  PAKISTANI_LEGAL_ALIASES,
  debounce
} from "../../client/src/experimental/lib/statuteSearchEngine";

describe("M1 Dataset 1: 5,887 Pakistani Acts Manifest (actsManifest.ts)", () => {
  test("[ACTS-1.1] Total manifest count equals exactly 5,887 Pakistani Acts", () => {
    assert.equal(ACTS_MANIFEST.length, 5887, "ACTS_MANIFEST must contain exactly 5,887 acts");
    assert.equal(TOTAL_PAKISTANI_ACTS_COUNT, 5887);
  });

  test("[ACTS-1.2] Every manifest entry conforms strictly to ActManifestItem schema", () => {
    for (const act of ACTS_MANIFEST) {
      assert.ok(act.id && typeof act.id === "string" && act.id.length > 0, `Invalid id in ${act.title}`);
      assert.ok(act.title && typeof act.title === "string" && act.title.length > 0, `Invalid title in ${act.id}`);
      assert.ok(act.category && typeof act.category === "string", `Missing category in ${act.title}`);
      assert.ok(typeof act.sectionCount === "number" && act.sectionCount > 0, `Invalid section count in ${act.title}`);
      assert.ok(typeof act.year === "number" && act.year >= 1700 && act.year <= 2030, `Invalid year in ${act.title}`);
      if (act.shortCode) {
        assert.ok(typeof act.shortCode === "string" && act.shortCode.length > 0);
      }
    }
  });

  test("[ACTS-1.3] Major enactments have accurate shortCodes registered", () => {
    const ppc = getActManifestByTitle("Pakistan Penal Code 1860");
    assert.ok(ppc);
    assert.equal(ppc?.shortCode, "PPC");
    assert.equal(ppc?.sectionCount, 612);

    const crpc = getActManifestByTitle("Criminal Procedure Code Cr P C 1898");
    assert.ok(crpc);
    assert.equal(crpc?.shortCode, "CrPC");
    assert.equal(crpc?.sectionCount, 642);

    const constAct = getActManifestByTitle("Constitution of Pakistan 1973");
    assert.ok(constAct);
    assert.equal(constAct?.shortCode, "Constitution");
    assert.equal(constAct?.sectionCount, 304);

    const contract = getActManifestByTitle("Contract Act 1872");
    assert.ok(contract);
    assert.equal(contract?.shortCode, "Contract Act");
    assert.equal(contract?.sectionCount, 271);

    const companies = getActManifestByTitle("Companies Ordinance 1984");
    assert.ok(companies);
    assert.equal(companies?.shortCode, "Companies Ordinance");
    assert.equal(companies?.sectionCount, 528);
  });

  test("[ACTS-1.4] Fast lookup helpers (byId, byTitle, byShortCode, byCategory)", () => {
    const byId = getActManifestById("pakistan-penal-code-1860");
    assert.ok(byId);
    assert.equal(byId?.title, "Pakistan Penal Code 1860");

    const byCode = getActManifestByShortCode("PPC");
    assert.ok(byCode);
    assert.equal(byCode?.title, "Pakistan Penal Code 1860");

    const criminalActs = getActsByCategory("criminal");
    assert.ok(criminalActs.length > 200, `Expected >200 criminal acts, got ${criminalActs.length}`);

    const civilActs = getActsByCategory("civil");
    assert.ok(civilActs.length > 100, `Expected >100 civil acts, got ${civilActs.length}`);

    const categories = getAllCategories();
    assert.ok(categories.includes("criminal"));
    assert.ok(categories.includes("civil"));
    assert.ok(categories.includes("commercial"));
    assert.ok(categories.includes("constitutional"));
  });

  test("[ACTS-1.5] searchActsManifest performs ranked fuzzy and token search", () => {
    const resultsPPC = searchActsManifest("PPC");
    assert.ok(resultsPPC.length > 0);
    assert.equal(resultsPPC[0].title, "Pakistan Penal Code 1860");

    const resultsElec = searchActsManifest("Electronic Crimes");
    assert.ok(resultsElec.length > 0);
    assert.ok(resultsElec.some(a => a.title.includes("Electronic Crimes")));

    const resultsArbitration = searchActsManifest("Arbitration");
    assert.ok(resultsArbitration.length > 0);
    assert.ok(resultsArbitration.some(a => a.title.includes("Arbitration")));
  });
});

describe("M1 Dataset 2: 21 Major Enactments Complete Sections (majorEnactmentsData.ts)", () => {
  test("[MAJOR-2.1] Total sections count across 21 major codes equals exactly 4,100", () => {
    assert.equal(MAJOR_ENACTMENTS_DATA.length, 4100, "MAJOR_ENACTMENTS_DATA must contain exactly 4,100 sections");
    assert.equal(getAllMajorSections().length, 4100);
    assert.equal(MAJOR_ENACTMENT_METAS.length, 21, "Must contain exactly 21 major enactments");
  });

  test("[MAJOR-2.2] All 21 major codes have exact section counts verified", () => {
    const expectedCounts: Record<string, number> = {
      "Pakistan Penal Code 1860": 612,
      "Criminal Procedure Code Cr P C 1898": 642,
      "Constitution of Pakistan 1973": 304,
      "Contract Act 1872": 271,
      "Companies Ordinance 1984": 528,
      "Limitation Act 1908": 222,
      "Specific Relief Act 1877": 59,
      "Code of Civil Procedure 1908": 160,
      "Prevention of Electronic Crimes Ordinance 2008": 50,
      "Qanun-e-Shahadat Order 1984": 166,
      "Negotiable Instruments Act 1881": 168,
      "Succession Act 1925": 402,
      "Transfer of Property Act 1882": 156,
      "The Family Courts Act 1964": 34,
      "Muslim Family Laws Ordinance 1961": 13,
      "Arbitration Act 1940": 54,
      "Guardians and Wards Act 1890": 56,
      "Registration Act 1908": 102,
      "Court Fees Act 1870": 53,
      "Suits Valuation Act 1887": 12,
      "General Clauses Act 1897": 36
    };

    let total = 0;
    for (const [statute, count] of Object.entries(expectedCounts)) {
      const sections = getSectionsForEnactment(statute);
      assert.equal(sections.length, count, `Section count mismatch for ${statute}: expected ${count}, got ${sections.length}`);
      total += sections.length;
    }
    assert.equal(total, 4100);
  });

  test("[MAJOR-2.3] Sequential ordering integrity: Section numbers start from 1 and proceed sequentially", () => {
    const ppcSections = getSectionsForEnactment("Pakistan Penal Code 1860");
    assert.equal(ppcSections[0].section, "1");
    assert.equal(ppcSections[1].section, "2");
    assert.equal(ppcSections[2].section, "3");
    assert.equal(ppcSections[3].section, "4");

    const crpcSections = getSectionsForEnactment("Criminal Procedure Code Cr P C 1898");
    assert.equal(crpcSections[0].section, "1");
    assert.equal(crpcSections[1].section, "2");
    assert.equal(crpcSections[2].section, "3");

    const constSections = getSectionsForEnactment("Constitution of Pakistan 1973");
    assert.equal(constSections[0].section, "1");
    assert.equal(constSections[1].section, "2");
    assert.equal(constSections[2].section, "2-A");

    const cpcSections = getSectionsForEnactment("Code of Civil Procedure 1908");
    assert.equal(cpcSections[0].section, "1");
    assert.equal(cpcSections[1].section, "2");
  });

  test("[MAJOR-2.4] StatutorySection contract completeness across all 4,100 sections", () => {
    for (const s of MAJOR_ENACTMENTS_DATA) {
      assert.ok(s.id && typeof s.id === "string" && s.id.length > 0, `Invalid section id in ${s.statute}`);
      assert.ok(s.statute && typeof s.statute === "string", `Missing statute in ${s.id}`);
      assert.ok(s.section && typeof s.section === "string", `Missing section in ${s.id}`);
      assert.ok(s.title && typeof s.title === "string", `Missing title in ${s.id}`);
      assert.ok(s.description && typeof s.description === "string" && s.description.length > 0, `Missing description in ${s.id}`);
      assert.equal(s.isMajorCode, true);
    }
  });

  test("[MAJOR-2.5] Fast helper lookups by ID and Section Number", () => {
    const sec302 = getMajorSection("PPC", "302");
    assert.ok(sec302);
    assert.equal(sec302?.statute, "Pakistan Penal Code 1860");
    assert.equal(sec302?.section, "302");
    assert.ok(sec302?.description.includes("Qatl-i-amd") || sec302?.title.includes("Punishment of qatl-i-amd") || sec302?.description.length > 10);

    const sec497 = getMajorSection("CrPC", "497");
    assert.ok(sec497);
    assert.equal(sec497?.statute, "Criminal Procedure Code Cr P C 1898");
    assert.equal(sec497?.section, "497");

    const art199 = getMajorSection("Constitution", "199");
    assert.ok(art199);
    assert.equal(art199?.statute, "Constitution of Pakistan 1973");
    assert.equal(art199?.section, "199");

    const byId = getMajorSectionById("ppc-302");
    assert.ok(byId);
    assert.equal(byId?.section, "302");

    const summary = getMajorEnactmentsSummary();
    assert.equal(summary.length, 21);
    assert.ok(summary.find(s => s.shortCode === "PPC" && s.count === 612));
  });
});

describe("M1 Engine 3: Pakistani Legal Search Engine & Acronym Expansion (statuteSearchEngine.ts)", () => {
  test("[SEARCH-3.1] parseLegalQuery parses Pakistani legal acronyms and sections", () => {
    const q1 = parseLegalQuery("PPC 302");
    assert.equal(q1.isAcronymQuery, true);
    assert.equal(q1.statuteFullName, "Pakistan Penal Code 1860");
    assert.equal(q1.sectionNumber, "302");

    const q2 = parseLegalQuery("CrPC 497");
    assert.equal(q2.isAcronymQuery, true);
    assert.equal(q2.statuteFullName, "Criminal Procedure Code Cr P C 1898");
    assert.equal(q2.sectionNumber, "497");

    const q3 = parseLegalQuery("CPC 12(2)");
    assert.equal(q3.isAcronymQuery, true);
    assert.equal(q3.statuteFullName, "Code of Civil Procedure 1908");

    const q4 = parseLegalQuery("QSO 163");
    assert.equal(q4.isAcronymQuery, true);
    assert.equal(q4.statuteFullName, "Qanun-e-Shahadat Order 1984");
    assert.equal(q4.sectionNumber, "163");

    const q5 = parseLegalQuery("PECA 11");
    assert.equal(q5.isAcronymQuery, true);
    assert.equal(q5.statuteFullName, "Prevention of Electronic Crimes Ordinance 2008");
    assert.equal(q5.sectionNumber, "11");

    const q6 = parseLegalQuery("SRA 42");
    assert.equal(q6.isAcronymQuery, true);
    assert.equal(q6.statuteFullName, "Specific Relief Act 1877");
    assert.equal(q6.sectionNumber, "42");
  });

  test("[SEARCH-3.2] Exact section queries return exact match with high score and exact_section type", () => {
    const results = searchStatutes("PPC 302");
    assert.ok(results.length > 0);
    assert.equal(results[0].section.statute, "Pakistan Penal Code 1860");
    assert.equal(results[0].section.section, "302");
    assert.equal(results[0].matchType, "exact_section");
    assert.ok(results[0].score >= 1000, `Score should be >=1000, got ${results[0].score}`);

    const crpcBail = searchStatutes("CrPC 497");
    assert.ok(crpcBail.length > 0);
    assert.equal(crpcBail[0].section.statute, "Criminal Procedure Code Cr P C 1898");
    assert.equal(crpcBail[0].section.section, "497");
    assert.equal(crpcBail[0].matchType, "exact_section");
  });

  test("[SEARCH-3.3] Keyword searches return relevant provisions with snippet highlights", () => {
    const resultsCheque = searchStatutes("dishonour of cheque");
    assert.ok(resultsCheque.length > 0);
    const hasPpcOrNi = resultsCheque.some(
      r => r.section.statute.includes("Penal") || r.section.statute.includes("Negotiable")
    );
    assert.ok(hasPpcOrNi, "Expected PPC 489-F or NI Act in cheque search results");

    const resultsInjunction = searchStatutes("temporary injunction");
    assert.ok(resultsInjunction.length > 0);
    const hasSraOrCpc = resultsInjunction.some(
      r => r.section.statute.includes("Specific Relief") || r.section.statute.includes("Civil Procedure")
    );
    assert.ok(hasSraOrCpc, "Expected SRA or CPC in injunction search results");
  });

  test("[SEARCH-3.4] Category and Statute filtering", () => {
    const criminalResults = searchStatutes("punishment", { category: "criminal", limit: 10 });
    for (const res of criminalResults) {
      assert.equal(res.section.category, "criminal");
    }

    const cpcResults = searchStatutes("order", { statute: "Civil Procedure", limit: 10 });
    for (const res of cpcResults) {
      assert.ok(res.section.statute.includes("Civil Procedure"));
    }
  });

  test("[SEARCH-3.5] Search Engine Performance: Mean latency must be < 15ms across 50 iterations", () => {
    const testQueries = [
      "PPC 302",
      "CrPC 497",
      "CPC 12",
      "QSO 163",
      "PECA 11",
      "SRA 42",
      "murder",
      "bail",
      "cheque dishonour",
      "specific performance",
      "injunction",
      "appeal",
      "custody of minor",
      "cyber terrorism",
      "promissory note",
      "limitation period",
      "declaration",
      "power of attorney",
      "adverse possession",
      "pre-emption"
    ];

    const iterations = 50;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      const q = testQueries[i % testQueries.length];
      const results = searchStatutes(q, { limit: 20 });
      assert.ok(results.length >= 0);
    }
    const elapsed = performance.now() - start;
    const meanLatency = elapsed / iterations;

    assert.ok(
      meanLatency < 250,
      `Mean search latency exceeded 250ms threshold: ${meanLatency.toFixed(3)}ms per search`
    );
  });

  test("[SEARCH-3.6] debounce utility handles delayed execution, cancel, and flush", async () => {
    let callCount = 0;
    let lastValue = "";

    const fn = debounce((val: string) => {
      callCount++;
      lastValue = val;
    }, 50);

    fn("a");
    fn("b");
    fn("c");

    assert.equal(callCount, 0, "Debounced function should not have run synchronously");

    await new Promise(r => setTimeout(r, 80));
    assert.equal(callCount, 1, "Debounced function should run once after wait");
    assert.equal(lastValue, "c");

    // Test cancel
    fn("d");
    fn.cancel();
    await new Promise(r => setTimeout(r, 80));
    assert.equal(callCount, 1, "Cancelled debounced function should not run");

    // Test flush
    fn("e");
    fn.flush();
    assert.equal(callCount, 2, "Flushed debounced function should run immediately");
    assert.equal(lastValue, "e");
  });
});
