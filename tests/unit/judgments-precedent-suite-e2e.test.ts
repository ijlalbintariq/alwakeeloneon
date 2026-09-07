import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  SEED_JUDGMENTS,
  SeedJudgmentRecord,
  getAllSeedJudgments,
  getSeedJudgmentById,
  findSeedJudgmentByCitation,
  searchSeedJudgments,
} from "../../client/src/experimental/data/seedJudgmentsData.js";
import {
  parsePakistaniCitation,
  type ParsedCitationTokens,
} from "../../client/src/experimental/components/judgments/PinpointCitationParser.js";
import {
  generateLocalLegalResponse,
} from "../../client/src/experimental/components/judgments/JudgmentAiSidecar.js";
import {
  searchJudgments,
  lookupCitation,
  getJudgmentDetail,
  formatRatioOrHeadnotes,
  createDraftingInsertPayload,
  hydrateCitationGraph,
  type UnifiedJudgmentResult,
  type JudgmentDetailData,
  type DraftingInsertPayload,
} from "../../client/src/experimental/lib/judgmentApiClient.js";
import { plainTextToTiptapHTML, isHTMLContent } from "../../client/src/experimental/lib/plain-to-tiptap.js";
import type { PrecedentCitationItem } from "../../client/src/experimental/components/judgments/OverruledAlertBanner.js";

// ============================================================================
// SUITE 1: TIER 1 - TWO-TIER SEARCH ENGINE & LIVE API RESOLUTION
// ============================================================================
describe("Tier 1: Two-Tier Search Engine & Resilience", () => {
  it("Test 1.1: Live seed search with empty query returns full baseline catalog with rich metadata", () => {
    const allJudgments = searchSeedJudgments("");
    assert.ok(Array.isArray(allJudgments), "Search must return an array");
    assert.ok(allJudgments.length >= 10, "Seed database must contain at least 10 landmark judgments");

    for (const j of allJudgments) {
      assert.ok(j.id && j.id.length > 0, "Judgment must have a valid ID");
      assert.ok(j.citation && j.citation.length > 0, "Judgment must have a valid citation");
      assert.ok(j.title && j.title.length > 0, "Judgment must have a title");
      assert.ok(j.court && j.court.length > 0, "Judgment must have a court");
      assert.ok(typeof j.year === "number" && j.year >= 1947, `Judgment year must be >= 1947 (got ${j.year})`);
      assert.ok(j.headnotes && j.headnotes.length > 20, "Judgment must have detailed headnotes");
      assert.ok(j.fullText && j.fullText.length > 100, "Judgment must have full text record");
      assert.ok(j.ratioDecidendi, "Judgment must have structured ratio decidendi");
      assert.ok(Array.isArray(j.ratioDecidendi.legalPrinciples), "Ratio must contain legal principles array");
    }
  });

  it("Test 1.2: Journal filtering across all 10 Pakistani law journals", () => {
    const journalsToTest = ["PLD", "SCMR", "LHC", "CLC", "PCRLJ", "YLR", "CLD", "PTD", "PLC"];
    for (const journal of journalsToTest) {
      const results = searchSeedJudgments("", journal, "All Courts");
      assert.ok(Array.isArray(results), `Results for journal ${journal} must be an array`);
      for (const res of results) {
        assert.equal(
          res.journal.toUpperCase(),
          journal.toUpperCase(),
          `Result citation ${res.citation} must match requested journal ${journal}`
        );
      }
    }
  });

  it("Test 1.3: Court forum filtering across Pakistani superior courts", () => {
    const courtsToTest = [
      { name: "Supreme Court of Pakistan", minExpected: 3 },
      { name: "Lahore High Court", minExpected: 2 },
      { name: "Sindh High Court", minExpected: 2 },
      { name: "Islamabad High Court", minExpected: 1 },
      { name: "Federal Court", minExpected: 1 },
    ];

    for (const courtItem of courtsToTest) {
      const results = searchSeedJudgments("", "All", courtItem.name);
      assert.ok(
        results.length >= courtItem.minExpected,
        `Filtering by court "${courtItem.name}" must return >= ${courtItem.minExpected} results (got ${results.length})`
      );
      for (const res of results) {
        assert.ok(
          res.court.toLowerCase().includes(courtItem.name.toLowerCase()),
          `Result court "${res.court}" must match filter "${courtItem.name}"`
        );
      }
    }
  });

  it("Test 1.4: Volume year filtering with string & numeric year coercion", () => {
    const yearsToTest = ["2023", "2024", "2021", "2022", "1955", "2012"];
    for (const yearStr of yearsToTest) {
      const results = searchSeedJudgments("", "All", "All Courts", yearStr);
      assert.ok(results.length >= 1, `Filtering by year "${yearStr}" must return at least 1 landmark authority`);
      for (const res of results) {
        assert.equal(res.year, Number(yearStr), `Result year ${res.year} must equal ${yearStr}`);
      }
    }
  });

  it("Test 1.5: Multi-key sorting order: relevance, latest, and most_cited", () => {
    const byRelevance = searchSeedJudgments("Bail CrPC", "All", "All Courts", undefined, "relevance");
    assert.ok(byRelevance.length > 0);

    const byLatest = searchSeedJudgments("", "All", "All Courts", undefined, "latest");
    for (let i = 0; i < byLatest.length - 1; i++) {
      const dateA = new Date(byLatest[i].decisionDate).getTime();
      const dateB = new Date(byLatest[i + 1].decisionDate).getTime();
      assert.ok(dateA >= dateB, `Latest sort order invariant violated at index ${i}`);
    }

    const byMostCited = searchSeedJudgments("", "All", "All Courts", undefined, "most_cited");
    for (let i = 0; i < byMostCited.length - 1; i++) {
      const citationsA = byMostCited[i].citationsReceived.length;
      const citationsB = byMostCited[i + 1].citationsReceived.length;
      assert.ok(citationsA >= citationsB, `Most cited sort order invariant violated at index ${i}`);
    }
  });

  it("Test 1.6: Two-tier network/auth resilience: simulated 401 unauthenticated response gracefully resolves via seed data", async () => {
    async function executeTwoTierSearchWithFallback(
      query: string,
      mockBackendStatus: number = 401
    ) {
      const seedResults = searchSeedJudgments(query);

      let remoteResults: any[] = [];
      try {
        if (mockBackendStatus === 401 || mockBackendStatus === 500) {
          throw new Error(`HTTP ${mockBackendStatus} Authentication Required`);
        }
        remoteResults = [{ id: "remote-1", citation: "2026 SCMR 1" }];
      } catch {
        remoteResults = [];
      }

      const combined = [...seedResults];
      remoteResults.forEach((r) => {
        if (!combined.some((c) => c.citation === r.citation)) {
          combined.push(r);
        }
      });
      return combined;
    }

    const unauthResults = await executeTwoTierSearchWithFallback("Article 199 Writs", 401);
    assert.ok(unauthResults.length > 0, "Must return results even when unauthenticated (401)");
    assert.ok(unauthResults.some((r) => r.citation === "PLD 2023 SC 451"), "Must contain PLD 2023 SC 451");

    const serverErrorResults = await executeTwoTierSearchWithFallback("Bail Section 497", 500);
    assert.ok(serverErrorResults.length > 0, "Must return results even during server 500 error");
    assert.ok(serverErrorResults.some((r) => r.citation === "2024 SCMR 892"), "Must contain 2024 SCMR 892");
  });
});

// ============================================================================
// SUITE 2: TIER 1 - PINPOINT CITATION PARSER (ALL 10 PAKISTANI JOURNALS)
// ============================================================================
describe("Tier 1: Pinpoint Citation Parser & Canonical Resolution", () => {
  it("Test 2.1: Journal-first parsing for apex and high court authorities", () => {
    const testCases = [
      { input: "PLD 2023 SC 451", expectedYear: 2023, expectedJournal: "PLD", expectedPage: 451, expectedCourt: "SC" },
      { input: "PLD 1955 FC 240", expectedYear: 1955, expectedJournal: "PLD", expectedPage: 240, expectedCourt: "FC" },
      { input: "PLD 2012 SC 553", expectedYear: 2012, expectedJournal: "PLD", expectedPage: 553, expectedCourt: "SC" },
      { input: "PLD 2020 Lahore 120", expectedYear: 2020, expectedJournal: "PLD", expectedPage: 120, expectedCourt: "Lahore" },
      { input: "PLD 2018 Karachi 340", expectedYear: 2018, expectedJournal: "PLD", expectedPage: 340, expectedCourt: "Karachi" },
    ];

    for (const tc of testCases) {
      const parsed = parsePakistaniCitation(tc.input);
      assert.ok(parsed, `Failed to parse journal-first citation: "${tc.input}"`);
      assert.equal(parsed.year, tc.expectedYear);
      assert.equal(parsed.journal, tc.expectedJournal);
      assert.equal(parsed.page, tc.expectedPage);
      if (tc.expectedCourt) {
        assert.ok(
          parsed.court?.toLowerCase().includes(tc.expectedCourt.toLowerCase()),
          `Court "${parsed.court}" should match expected "${tc.expectedCourt}"`
        );
      }
      assert.equal(parsed.isValid, true);
    }
  });

  it("Test 2.2: Year-first standard parsing for all 10 major reporters", () => {
    const testCases = [
      { input: "2024 SCMR 892", expectedYear: 2024, expectedJournal: "SCMR", expectedPage: 892 },
      { input: "2023 CLC 1204", expectedYear: 2023, expectedJournal: "CLC", expectedPage: 1204 },
      { input: "2022 PCrLJ 150", expectedYear: 2022, expectedJournal: "PCRLJ", expectedPage: 150 },
      { input: "2021 YLR 880", expectedYear: 2021, expectedJournal: "YLR", expectedPage: 880 },
      { input: "2022 CLD 780", expectedYear: 2022, expectedJournal: "CLD", expectedPage: 780 },
      { input: "2023 PTD 1105", expectedYear: 2023, expectedJournal: "PTD", expectedPage: 1105 },
      { input: "2021 PLC 340", expectedYear: 2021, expectedJournal: "PLC", expectedPage: 340 },
      { input: "2020 MLD 500", expectedYear: 2020, expectedJournal: "MLD", expectedPage: 500 },
      { input: "2019 SCMR 1420", expectedYear: 2019, expectedJournal: "SCMR", expectedPage: 1420 },
      { input: "2023 PCrLJ 1150", expectedYear: 2023, expectedJournal: "PCRLJ", expectedPage: 1150 },
    ];

    for (const tc of testCases) {
      const parsed = parsePakistaniCitation(tc.input);
      assert.ok(parsed, `Failed to parse year-first citation: "${tc.input}"`);
      assert.equal(parsed.year, tc.expectedYear, `Year mismatch for ${tc.input}`);
      assert.equal(parsed.journal, tc.expectedJournal, `Journal mismatch for ${tc.input}`);
      assert.equal(parsed.page, tc.expectedPage, `Page mismatch for ${tc.input}`);
      assert.equal(parsed.isValid, true);
    }
  });

  it("Test 2.3: Compact neutral court citations (LHC, IHC, SHC, PHC, BHC, FSC)", () => {
    const testCases = [
      { input: "2025 LHC 639", expectedYear: 2025, expectedCourt: "LHC", expectedPage: 639 },
      { input: "2024 IHC 120", expectedYear: 2024, expectedCourt: "IHC", expectedPage: 120 },
      { input: "2023 SHC 45", expectedYear: 2023, expectedCourt: "SHC", expectedPage: 45 },
      { input: "2022 PHC 300", expectedYear: 2022, expectedCourt: "PHC", expectedPage: 300 },
      { input: "2021 BHC 88", expectedYear: 2021, expectedCourt: "BHC", expectedPage: 88 },
      { input: "2020 FSC 12", expectedYear: 2020, expectedCourt: "FSC", expectedPage: 12 },
    ];

    for (const tc of testCases) {
      const parsed = parsePakistaniCitation(tc.input);
      assert.ok(parsed, `Failed to parse compact neutral citation: "${tc.input}"`);
      assert.equal(parsed.year, tc.expectedYear);
      assert.equal(parsed.court, tc.expectedCourt);
      assert.equal(parsed.page, tc.expectedPage);
      assert.equal(parsed.isValid, true);
    }
  });

  it("Test 2.4: Normalized dot-spaced acronyms across all reporters", () => {
    const spacedAcronyms = [
      { input: "P. L. D. 2023 SC 451", expectedJournal: "PLD", expectedYear: 2023, expectedPage: 451 },
      { input: "S. C. M. R. 2024 892", expectedJournal: "SCMR", expectedYear: 2024, expectedPage: 892 },
      { input: "P. Cr. L. J. 2022 150", expectedJournal: "PCRLJ", expectedYear: 2022, expectedPage: 150 },
      { input: "C. L. C. 2023 1204", expectedJournal: "CLC", expectedYear: 2023, expectedPage: 1204 },
      { input: "Y. L. R. 2021 880", expectedJournal: "YLR", expectedYear: 2021, expectedPage: 880 },
      { input: "C. L. D. 2022 780", expectedJournal: "CLD", expectedYear: 2022, expectedPage: 780 },
      { input: "P. T. D. 2023 1105", expectedJournal: "PTD", expectedYear: 2023, expectedPage: 1105 },
      { input: "P. L. C. 2021 340", expectedJournal: "PLC", expectedYear: 2021, expectedPage: 340 },
      { input: "M. L. D. 2020 500", expectedJournal: "MLD", expectedYear: 2020, expectedPage: 500 },
    ];

    for (const item of spacedAcronyms) {
      const parsed = parsePakistaniCitation(item.input);
      assert.ok(parsed, `Failed to parse dot-spaced citation "${item.input}"`);
      assert.equal(parsed.journal, item.expectedJournal);
      assert.equal(parsed.year, item.expectedYear);
      assert.equal(parsed.page, item.expectedPage);
      assert.equal(parsed.isValid, true);
    }
  });

  it("Test 2.5: Pinpoint resolution & exact record retrieval via findSeedJudgmentByCitation", () => {
    const testCases = [
      { raw: "PLD 2023 SC 451", expectedId: "pld-2023-sc-451", expectedTitle: "FEDERATION OF PAKISTAN Vs MUHAMMAD AKRAM" },
      { raw: "2024 SCMR 892", expectedId: "2024-scmr-892", expectedTitle: "TARIQ MEHMOOD Vs THE STATE" },
      { raw: "2023 CLC 1204", expectedId: "2023-clc-1204", expectedTitle: "MUHAMMAD RAFIQ Vs ABDUL GHAFOOR" },
      { raw: "2025 LHC 639", expectedId: "2025-lhc-639", expectedTitle: "BASHIR AHMAD Vs MST. ZUBAIDA" },
      { raw: "2021 YLR 880", expectedId: "2021-ylr-880", expectedTitle: "MST. AISHA BIBI Vs TARIQ MEHMOOD" },
      { raw: "2022 CLD 780", expectedId: "2022-cld-780", expectedTitle: "MCB BANK LTD Vs INDUS TEXTILES LTD" },
      { raw: "2023 PTD 1105", expectedId: "2023-ptd-1105", expectedTitle: "COMMISSIONER INLAND REVENUE Vs NISHAT MILLS LTD" },
      { raw: "2021 PLC 340", expectedId: "2021-plc-340", expectedTitle: "PAKISTAN TELECOMMUNICATION CO. LTD Vs MEMBER NIRC" },
      { raw: "PLD 1955 FC 240", expectedId: "pld-1955-fc-240", expectedTitle: "FEDERATION OF PAKISTAN Vs MAULVI TAMIZUDDIN KHAN" },
      { raw: "PLD 2012 SC 553", expectedId: "pld-2012-sc-553", expectedTitle: "BAZ MUHAMMAD KAKAR Vs FEDERATION OF PAKISTAN" },
    ];

    for (const tc of testCases) {
      const tokens = parsePakistaniCitation(tc.raw);
      assert.ok(tokens, `Tokens must be parsed for "${tc.raw}"`);
      const judgment = findSeedJudgmentByCitation(tokens.year, tokens.journal, tokens.page);
      assert.ok(judgment, `findSeedJudgmentByCitation must resolve record for "${tc.raw}"`);
      assert.equal(judgment.id, tc.expectedId);
      assert.equal(judgment.title, tc.expectedTitle);
    }
  });

  it("Test 2.6: Manual citation parameter builder and validation", () => {
    function buildManualCitationQuery(year: number, journal: string, page: string, court?: string) {
      const pageNum = Number(page);
      if (!year || isNaN(pageNum) || pageNum < 1 || year < 1947) {
        return { isValid: false, params: null };
      }
      return {
        isValid: true,
        params: {
          year,
          journal: journal === "ALL" ? undefined : journal,
          page: pageNum,
          court: court || undefined,
        },
      };
    }

    assert.equal(buildManualCitationQuery(2024, "SCMR", "892").isValid, true);
    assert.equal(buildManualCitationQuery(1940, "PLD", "100").isValid, false, "Pre-1947 year must be invalid");
    assert.equal(buildManualCitationQuery(2024, "SCMR", "abc").isValid, false, "Non-numeric page must be invalid");
    assert.equal(buildManualCitationQuery(2024, "SCMR", "-5").isValid, false, "Negative page must be invalid");
  });
});

// ============================================================================
// SUITE 3: TIER 1 - DIRECTORY BROWSER 4-TIER DRILLDOWN
// ============================================================================
describe("Tier 1: Directory Browser 4-Tier Drilldown", () => {
  it("Test 3.1: Tier 1 Court Forum drilldown (SC, LHC, SHC, IHC, and Federal Court)", () => {
    const superiorCourts = [
      { name: "Supreme Court", filter: "Supreme Court" },
      { name: "Lahore High Court", filter: "Lahore High Court" },
      { name: "Sindh High Court", filter: "Sindh High Court" },
      { name: "Islamabad High Court", filter: "Islamabad High Court" },
      { name: "Federal Court", filter: "Federal Court" },
    ];

    for (const item of superiorCourts) {
      const cases = SEED_JUDGMENTS.filter((j) => j.court.toLowerCase().includes(item.filter.toLowerCase()));
      assert.ok(cases.length > 0, `Court forum "${item.name}" must have matching seed cases`);
      for (const c of cases) {
        assert.ok(
          c.court.toLowerCase().includes(item.filter.toLowerCase()),
          `Case ${c.citation} must match court filter ${item.name}`
        );
      }
    }
  });

  it("Test 3.2: Tier 2 Legal Category drilldown across 7 legal domains", () => {
    const categories = ["constitutional", "criminal", "civil", "family", "corporate", "tax", "labor"] as const;
    for (const cat of categories) {
      const cases = SEED_JUDGMENTS.filter((j) => j.category === cat);
      assert.ok(cases.length >= 1, `Category "${cat}" must have at least 1 landmark authority`);
      for (const c of cases) {
        assert.equal(c.category, cat, `Case ${c.citation} category must be ${cat}`);
      }
    }
  });

  it("Test 3.3: Tier 3 Journal Code drilldown", () => {
    const journalCodes = ["PLD", "SCMR", "LHC", "CLC", "YLR", "CLD", "PTD", "PLC"];
    for (const jCode of journalCodes) {
      const cases = SEED_JUDGMENTS.filter((j) => j.journal.toUpperCase() === jCode.toUpperCase());
      assert.ok(cases.length >= 1, `Journal "${jCode}" must have at least 1 seed case`);
      for (const c of cases) {
        assert.equal(c.journal.toUpperCase(), jCode.toUpperCase());
      }
    }
  });

  it("Test 3.4: Tier 4 Volume Year drilldown", () => {
    const years = [2025, 2024, 2023, 2022, 2021, 2012, 1955];
    for (const y of years) {
      const cases = SEED_JUDGMENTS.filter((j) => j.year === y);
      assert.ok(cases.length >= 1, `Year ${y} must have at least 1 seed case`);
      for (const c of cases) {
        assert.equal(c.year, y);
      }
    }
  });

  it("Test 3.5: Multi-attribute composite drilldown + directory search filter + pagination calculation", () => {
    function filterDirectory(
      courtCode: string,
      category: string,
      journalCode: string,
      year: string,
      query: string,
      page: number = 1,
      itemsPerPage: number = 4
    ) {
      let list = [...SEED_JUDGMENTS];

      if (courtCode !== "ALL") {
        list = list.filter((j) => j.courtCode === courtCode || j.court.toLowerCase().includes(courtCode.toLowerCase()));
      }
      if (category !== "all") {
        list = list.filter((j) => j.category === category);
      }
      if (journalCode !== "ALL") {
        list = list.filter((j) => j.journal.toUpperCase() === journalCode.toUpperCase());
      }
      if (year !== "ALL") {
        list = list.filter((j) => String(j.year) === year);
      }
      if (query.trim()) {
        const q = query.toLowerCase().trim();
        list = list.filter(
          (j) =>
            j.title.toLowerCase().includes(q) ||
            j.citation.toLowerCase().includes(q) ||
            j.headnotes.toLowerCase().includes(q) ||
            j.bench.toLowerCase().includes(q)
        );
      }

      const totalItems = list.length;
      const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
      const paginated = list.slice((page - 1) * itemsPerPage, page * itemsPerPage);

      return { totalItems, totalPages, paginated };
    }

    const all = filterDirectory("ALL", "all", "ALL", "ALL", "", 1, 4);
    assert.ok(all.totalItems >= 10);
    assert.equal(all.paginated.length, 4);
    assert.ok(all.totalPages >= 3);

    const scCriminal = filterDirectory("SC", "criminal", "ALL", "ALL", "");
    assert.ok(scCriminal.totalItems >= 1);
    assert.ok(scCriminal.paginated.some((c) => c.citation === "2024 SCMR 892"));

    const searchMatch = filterDirectory("ALL", "all", "ALL", "ALL", "Bail");
    assert.ok(searchMatch.totalItems >= 1);
    assert.ok(searchMatch.paginated.some((c) => c.citation === "2024 SCMR 892"));
  });
});

// ============================================================================
// SUITE 4: TIER 1 - PRECEDENT CITATION GRAPH NODE & EDGE GENERATION
// ============================================================================
describe("Tier 1: Precedent Citation Graph Node & Edge Generation", () => {
  it("Test 4.1: Bidirectional citation tree extraction (outbound citing vs inbound cited-by)", () => {
    const akramCase = getSeedJudgmentById("pld-2023-sc-451");
    assert.ok(akramCase, "Must retrieve PLD 2023 SC 451");
    assert.ok(akramCase.citationsMade.length >= 2, "Must have outgoing precedents cited");
    assert.ok(akramCase.citationsReceived.length >= 1, "Must have incoming citing precedents");

    for (const cm of akramCase.citationsMade) {
      assert.ok(cm.linkedCitation || cm.citationText, "Outgoing citation must have citation text");
      assert.ok(cm.citationType, "Outgoing citation must have treatment type");
    }

    for (const cr of akramCase.citationsReceived) {
      assert.ok(cr.linkedCitation || cr.citationText, "Incoming citation must have citation text");
      assert.ok(cr.citationType, "Incoming citation must have treatment type");
    }
  });

  it("Test 4.2: Legal treatment classification & hex color assignment", () => {
    function getTreatmentBadge(type: string) {
      switch (type?.toLowerCase()) {
        case "relied_upon":
        case "followed":
        case "approved":
          return { label: "Relied Upon", hexColor: "#105B38", category: "positive" };
        case "distinguished":
        case "explained":
          return { label: "Distinguished", hexColor: "#D97706", category: "caution" };
        case "overruled":
        case "disapproved":
        case "reversed":
          return { label: "Overruled", hexColor: "#DC2626", category: "negative" };
        case "referred_to":
        default:
          return { label: "Referred To", hexColor: "#2563EB", category: "neutral" };
      }
    }

    assert.equal(getTreatmentBadge("relied_upon").hexColor, "#105B38");
    assert.equal(getTreatmentBadge("followed").hexColor, "#105B38");
    assert.equal(getTreatmentBadge("distinguished").hexColor, "#D97706");
    assert.equal(getTreatmentBadge("explained").hexColor, "#D97706");
    assert.equal(getTreatmentBadge("overruled").hexColor, "#DC2626");
    assert.equal(getTreatmentBadge("disapproved").hexColor, "#DC2626");
    assert.equal(getTreatmentBadge("referred_to").hexColor, "#2563EB");
  });

  it("Test 4.3: Graph filtering by legal treatment type", () => {
    const akramCase = getSeedJudgmentById("pld-2023-sc-451")!;
    assert.ok(akramCase);

    function filterGraphCitations(citations: PrecedentCitationItem[], filter: string) {
      if (filter === "all") return citations;
      return citations.filter((c) => c.citationType === filter);
    }

    const allOutbound = filterGraphCitations(akramCase.citationsMade, "all");
    assert.equal(allOutbound.length, akramCase.citationsMade.length);

    const reliedOnly = filterGraphCitations(akramCase.citationsMade, "relied_upon");
    assert.ok(reliedOnly.length >= 1);
    assert.ok(reliedOnly.every((c) => c.citationType === "relied_upon"));

    const referredOnly = filterGraphCitations(akramCase.citationsMade, "referred_to");
    assert.ok(referredOnly.length >= 1);
    assert.ok(referredOnly.every((c) => c.citationType === "referred_to"));
  });

  it("Test 4.4: In-graph node search filter for citations and case titles", () => {
    const akramCase = getSeedJudgmentById("pld-2023-sc-451")!;

    function searchGraphNodes(citations: PrecedentCitationItem[], search: string) {
      if (!search.trim()) return citations;
      const q = search.toLowerCase().trim();
      return citations.filter(
        (c) =>
          (c.linkedCitation || c.citationText || "").toLowerCase().includes(q) ||
          (c.linkedTitle || "").toLowerCase().includes(q) ||
          (c.contextExcerpt || "").toLowerCase().includes(q)
      );
    }

    const searchCit = searchGraphNodes(akramCase.citationsMade, "PLD 2018 SC 189");
    assert.equal(searchCit.length, 1);
    assert.equal(searchCit[0].linkedCitation, "PLD 2018 SC 189");

    const searchTitle = searchGraphNodes(akramCase.citationsMade, "Khurshid Anwar");
    assert.equal(searchTitle.length, 1);
    assert.equal(searchTitle[0].linkedTitle, "Justice Khurshid Anwar v. Federation of Pakistan");
  });

  it("Test 4.5: Tabular Precedent Matrix transformation & sorting", () => {
    const akramCase = getSeedJudgmentById("pld-2023-sc-451")!;

    interface MatrixRow {
      id: string | number;
      direction: "Citing (Outbound)" | "Cited By (Inbound)";
      citation: string;
      title: string;
      treatment: string;
      court: string;
      year: number;
    }

    const matrix: MatrixRow[] = [
      ...akramCase.citationsMade.map((c) => ({
        id: c.id,
        direction: "Citing (Outbound)" as const,
        citation: c.linkedCitation || c.citationText,
        title: c.linkedTitle || "Reported Authority",
        treatment: c.citationType,
        court: c.court || "Supreme Court of Pakistan",
        year: c.year || 2020,
      })),
      ...akramCase.citationsReceived.map((c) => ({
        id: c.id,
        direction: "Cited By (Inbound)" as const,
        citation: c.linkedCitation || c.citationText,
        title: c.linkedTitle || "Subsequent Judgment",
        treatment: c.citationType,
        court: c.court || "High Court",
        year: c.year || 2024,
      })),
    ];

    assert.ok(matrix.length >= 3);
    assert.ok(matrix.some((r) => r.direction === "Citing (Outbound)"));
    assert.ok(matrix.some((r) => r.direction === "Cited By (Inbound)"));
  });

  it("Test 4.6: 1-Click structured citation tree report text export generator", () => {
    const akramCase = getSeedJudgmentById("pld-2023-sc-451")!;

    function generateCitationTreeReport(
      citation: string,
      title: string,
      made: PrecedentCitationItem[],
      received: PrecedentCitationItem[]
    ): string {
      const lines: string[] = [
        "================================================================",
        "AL WAKEELO PRECEDENT CITATION GRAPH SUMMARY REPORT",
        "================================================================",
        `Root Judgment: ${citation}`,
        `Title: ${title}`,
        `Total Citations: ${made.length + received.length}`,
        "",
        "--- OUTBOUND CITATIONS (PRECEDENTS CITED / RELIED UPON) ---",
      ];

      made.forEach((c, idx) => {
        lines.push(`[${idx + 1}] ${c.linkedCitation || c.citationText} | Treatment: ${c.citationType?.toUpperCase()}`);
        if (c.linkedTitle) lines.push(`    Title: ${c.linkedTitle}`);
        if (c.contextExcerpt) lines.push(`    Ratio Context: ${c.contextExcerpt}`);
      });

      lines.push("", "--- INBOUND CITATIONS (SUBSEQUENT CASES CITING THIS ROOT) ---");
      received.forEach((c, idx) => {
        lines.push(`[${idx + 1}] ${c.linkedCitation || c.citationText} | Treatment: ${c.citationType?.toUpperCase()}`);
        if (c.linkedTitle) lines.push(`    Title: ${c.linkedTitle}`);
      });

      return lines.join("\n");
    }

    const report = generateCitationTreeReport(
      akramCase.citation,
      akramCase.title,
      akramCase.citationsMade,
      akramCase.citationsReceived
    );

    assert.ok(report.includes("AL WAKEELO PRECEDENT CITATION GRAPH SUMMARY REPORT"));
    assert.ok(report.includes("PLD 2023 SC 451"));
    assert.ok(report.includes("PLD 2018 SC 189"));
    assert.ok(report.includes("RELIED_UPON"));
  });
});

// ============================================================================
// SUITE 5: TIER 1 - IMMERSIVE JUDGMENT READER & DYNAMIC TOC
// ============================================================================
describe("Tier 1: Immersive Judgment Reader & Dynamic Table of Contents", () => {
  it("Test 5.1: Dynamic Table of Contents generation and section anchors", () => {
    const caseData = getSeedJudgmentById("pld-2023-sc-451")!;

    function generateReaderTOC(judgment: SeedJudgmentRecord) {
      const sections = [
        { id: "sec-header", label: "Court Header & Bench", available: true },
        { id: "sec-headnotes", label: "Official Headnotes & Statutes", available: !!judgment.headnotes },
        { id: "sec-ratio", label: "Ratio Decidendi & Legal Principles", available: !!judgment.ratioDecidendi },
        { id: "sec-graph", label: "Citation Graph & Treatment", available: (judgment.citationsMade.length + judgment.citationsReceived.length) > 0 },
        { id: "sec-text", label: "Full Judgment Text", available: !!judgment.fullText },
      ];
      return sections.filter((s) => s.available);
    }

    const toc = generateReaderTOC(caseData);
    assert.equal(toc.length, 5, "All 5 main sections must be available for landmark seed case");
    assert.ok(toc.some((s) => s.id === "sec-headnotes"));
    assert.ok(toc.some((s) => s.id === "sec-ratio"));
    assert.ok(toc.some((s) => s.id === "sec-graph"));
    assert.ok(toc.some((s) => s.id === "sec-text"));
  });

  it("Test 5.2: Paragraph permalinks (#para-1, #para-2) and paragraph array splitting", () => {
    const caseData = getSeedJudgmentById("pld-2023-sc-451")!;

    function extractParagraphs(fullText: string) {
      return fullText
        .split(/\n\n+/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0);
    }

    const paras = extractParagraphs(caseData.fullText);
    assert.ok(paras.length >= 7, "PLD 2023 SC 451 full text must contain at least 7 paragraphs");

    paras.forEach((para, idx) => {
      const paraNum = idx + 1;
      const permalinkId = `para-${paraNum}`;
      assert.ok(permalinkId.startsWith("para-"));
      assert.ok(para.length > 20, `Paragraph ${paraNum} must have substantial text`);
    });
  });

  it("Test 5.3: Pinpoint paragraph citation copy formatting: '[quote]' — Citation at [[paraNum]]", () => {
    const caseData = getSeedJudgmentById("pld-2023-sc-451")!;
    const paras = caseData.fullText.split(/\n\n+/).map((p) => p.trim()).filter((p) => p.length > 0);

    function formatParagraphPinpointCopy(citation: string, paraNum: number, paraText: string): string {
      const pinpoint = `${citation} at [${paraNum}]`;
      return `"${paraText.trim()}" — ${pinpoint}`;
    }

    const para4 = paras[3];
    const copyString = formatParagraphPinpointCopy(caseData.citation, 4, para4);
    assert.ok(copyString.startsWith('"'));
    assert.ok(copyString.includes("judicial review under Article 199"));
    assert.ok(copyString.endsWith("— PLD 2023 SC 451 at [4]"));
  });

  it("Test 5.4: Reader metadata rendering (Bench, Decision Date en-PK formatting, Parties)", () => {
    const caseData = getSeedJudgmentById("pld-2023-sc-451")!;

    function formatDatePK(dateStr: string): string {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-PK", { year: "numeric", month: "long", day: "2-digit" });
    }

    assert.equal(caseData.bench, "Qazi Faez Isa, CJ & Jamal Khan Mandokhail, J.");
    assert.equal(formatDatePK(caseData.decisionDate), "14 November 2023");
    assert.equal(caseData.petitioner, "Federation of Pakistan through Secretary Cabinet Division");
    assert.equal(caseData.respondent, "Muhammad Akram & others");
  });

  it("Test 5.5: RatioDecidendiCard analytical synthesis fallback generation from headnotes", () => {
    function synthesizeRatioFromHeadnotes(headnotes: string) {
      const lines = headnotes
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      return {
        result: "Decision rendered in accordance with the statutory and constitutional propositions established by the Bench.",
        legalPrinciples: lines
          .slice(0, 4)
          .map((l) => l.replace(/^[-•*–\d.]+\s*/, "").replace(/---/g, " — ").trim()),
        keyFindings: [
          "Official Headnotes parsed directly from reported Pakistani Law Journal record.",
          "Statutory provisions and judicial ratio established by the presiding bench.",
          "Binding precedent under Article 189/201 of the Constitution of Pakistan.",
        ],
        significance:
          "Reported precedent establishing authoritative guidance for lower courts, tribunals, and legal practitioners.",
      };
    }

    const rawHeadnotes =
      "Constitution of Pakistan (1973), Arts. 199 & 184(3)---Extraordinary Constitutional Jurisdiction---Scope.";
    const synth = synthesizeRatioFromHeadnotes(rawHeadnotes);
    assert.ok(synth.legalPrinciples.length > 0);
    assert.ok(synth.legalPrinciples[0].includes("Arts. 199 & 184(3)"));
    assert.ok(synth.keyFindings.length === 3);
    assert.ok(synth.significance.length > 20);
  });

  it("Test 5.6: Judgment AI Sidecar quick prompts prioritization (Prompt #5 Brief Memo vs Ratio)", () => {
    const caseData = getSeedJudgmentById("pld-2023-sc-451")!;

    const promptBrief =
      "Draft a formal 1-page Chambers Case Brief memo summarizing: Bench, Facts, Question of Law, Ratio Decidendi, and Operative Order.";
    const resBrief = generateLocalLegalResponse(
      promptBrief,
      caseData.citation,
      caseData.title,
      caseData.headnotes,
      caseData.fullText
    );
    assert.ok(resBrief.includes("### **Chambers Legal Case Brief**"));
    assert.ok(!resBrief.includes("### **Ratio Decidendi Analysis"));

    const promptRatio = "Extract the core Ratio Decidendi, legal propositions, and binding rule established in this judgment.";
    const resRatio = generateLocalLegalResponse(
      promptRatio,
      caseData.citation,
      caseData.title,
      caseData.headnotes,
      caseData.fullText
    );
    assert.ok(resRatio.includes("### **Ratio Decidendi Analysis"));

    const promptBail = "Analyze the applicability of this precedent to bail under Section 497 CrPC.";
    const resBail = generateLocalLegalResponse(
      promptBail,
      caseData.citation,
      caseData.title,
      caseData.headnotes,
      caseData.fullText
    );
    assert.ok(resBail.includes("### **Criminal & Bail Jurisprudence"));
  });
});

// ============================================================================
// SUITE 6: TIER 1 - ACTION HUB & LEGAL DRAFTING STUDIO BRIDGE
// ============================================================================
describe("Tier 1: Action Hub & Legal Drafting Studio Bridge", () => {
  it("Test 6.1: Result card action targets and routing", () => {
    const caseData = getSeedJudgmentById("pld-2023-sc-451")!;

    function getCardActions(judgment: SeedJudgmentRecord) {
      return {
        readUrl: `/preview/judgments?id=${judgment.id}`,
        graphUrl: `/preview/judgments?id=${judgment.id}&tab=graph`,
        citation: judgment.citation,
        title: judgment.title,
      };
    }

    const actions = getCardActions(caseData);
    assert.equal(actions.readUrl, "/preview/judgments?id=pld-2023-sc-451");
    assert.equal(actions.graphUrl, "/preview/judgments?id=pld-2023-sc-451&tab=graph");
    assert.equal(actions.citation, "PLD 2023 SC 451");
  });

  it("Test 6.2: 1-Click Copy Citation clipboard string formatting", () => {
    const caseData = getSeedJudgmentById("2024-scmr-892")!;
    const citationString = caseData.citation;
    assert.equal(citationString, "2024 SCMR 892");

    const fullCitationWithTitle = `${caseData.title} (${caseData.citation})`;
    assert.equal(fullCitationWithTitle, "TARIQ MEHMOOD Vs THE STATE (2024 SCMR 892)");
  });

  it("Test 6.3: Chambers Bookmarks Vault lifecycle (add, remove, persist, batch export)", () => {
    interface BookmarkRecord {
      id: number;
      citation: string;
      court: string;
      title: string;
      summary: string;
      createdAt: string;
    }

    let bookmarks: BookmarkRecord[] = [];

    const b1: BookmarkRecord = {
      id: 1,
      citation: "PLD 2023 SC 451",
      court: "Supreme Court of Pakistan",
      title: "FEDERATION OF PAKISTAN Vs MUHAMMAD AKRAM",
      summary: "Article 199 writ scope.",
      createdAt: new Date().toISOString(),
    };
    bookmarks.push(b1);
    assert.equal(bookmarks.length, 1);

    bookmarks = bookmarks.filter((b) => b.citation !== "PLD 2023 SC 451");
    assert.equal(bookmarks.length, 0);

    function generateBookmarksExport(list: BookmarkRecord[]): string {
      const lines = [
        "AL WAKEELO — COUNSEL'S SAVED PRECEDENTS VAULT EXPORT",
        `Total Saved Authorities: ${list.length}`,
      ];
      list.forEach((b, idx) => {
        lines.push(`[${idx + 1}] ${b.citation} - ${b.title}`);
      });
      return lines.join("\n");
    }

    const exported = generateBookmarksExport([b1]);
    assert.ok(exported.includes("AL WAKEELO — COUNSEL'S SAVED PRECEDENTS VAULT EXPORT"));
    assert.ok(exported.includes("PLD 2023 SC 451"));
  });

  it("Test 6.4: Cross-Module Drafting Bridge CustomEvent payload schema compliance", () => {
    const caseData = getSeedJudgmentById("pld-2023-sc-451")!;

    const payload = createDraftingInsertPayload(caseData);
    assert.equal(payload.statute, "Supreme Court of Pakistan");
    assert.equal(payload.section, "PLD 2023 SC 451");
    assert.equal(payload.title, "FEDERATION OF PAKISTAN Vs MUHAMMAD AKRAM");
    assert.ok(payload.clause.includes("LEGAL PRECEDENT & BINDING RATIO DECIDENDI:"));
    assert.ok(payload.clause.includes("Extraordinary constitutional writ jurisdiction under Article 199"));
    assert.ok(typeof payload.timestamp === "number" && payload.timestamp > 0);
  });

  it("Test 6.5: LocalStorage payload serialization and Tiptap HTML ingestion", () => {
    const caseData = getSeedJudgmentById("2024-scmr-892")!;

    const payload = {
      statute: "Supreme Court of Pakistan",
      section: caseData.citation,
      title: caseData.title,
      clause: `GROUND OF BAIL UNDER S. 497(2) Cr.P.C.:\nAs established by the Hon'ble Supreme Court of Pakistan in ${caseData.title} (${caseData.citation}):\n"Where tentative assessment reveals reasonable grounds for further inquiry, release on bail under Section 497(2) Cr.P.C. is an entrenched statutory right."`,
      timestamp: Date.now(),
    };

    const serialized = JSON.stringify(payload);
    const parsed = JSON.parse(serialized);
    assert.equal(parsed.section, "2024 SCMR 892");

    const tiptapHtml = plainTextToTiptapHTML(parsed.clause);
    assert.ok(tiptapHtml.length > 0);
    assert.ok(isHTMLContent(tiptapHtml));
    assert.ok(tiptapHtml.includes("2024 SCMR 892"));
    assert.ok(tiptapHtml.includes("further inquiry"));
  });
});

// ============================================================================
// SUITE 7: TIER 2 - BOUNDARY & CORNER CASES
// ============================================================================
describe("Tier 2: Boundary & Corner Cases", () => {
  it("Test 7.1: Empty search query, whitespace, tabs, and query resilience", () => {
    const edgeQueries = ["", "   ", "\t\t\n"];
    for (const eq of edgeQueries) {
      assert.doesNotThrow(() => {
        const results = searchSeedJudgments(eq);
        assert.ok(Array.isArray(results), `Query "${eq}" must return an array`);
        assert.ok(results.length >= 10, `Empty query should return default catalog`);
      }, `Query "${eq}" threw error`);
    }

    const specialPunctuation = [";;;", "---", "***", "???"];
    for (const sp of specialPunctuation) {
      assert.doesNotThrow(() => {
        const results = searchSeedJudgments(sp);
        assert.ok(Array.isArray(results));
      }, `Punctuation query "${sp}" threw error`);
    }
  });

  it("Test 7.2: Extreme year boundaries (1947 minimum, 1955 historic, 2026 future; invalid <1947 rejected)", () => {
    assert.ok(parsePakistaniCitation("PLD 1947 SC 1"));
    assert.ok(parsePakistaniCitation("PLD 1955 FC 240"));
    assert.ok(parsePakistaniCitation("2026 SCMR 100"));

    assert.equal(parsePakistaniCitation("PLD 1946 SC 1"), null, "Year 1946 must be rejected (< 1947)");
    assert.equal(parsePakistaniCitation("1850 ABC 12"), null, "Year 1850 must be rejected");
    assert.equal(parsePakistaniCitation("0 SCMR 1"), null, "Year 0 must be rejected");
  });

  it("Test 7.3: Unusual citation punctuation, colons, brackets, and extra spaces", () => {
    const complexInputs = [
      { input: "[2024] SCMR 892", expectedYear: 2024, expectedJournal: "SCMR", expectedPage: 892 },
      { input: "2023:CLC:1204", expectedYear: 2023, expectedJournal: "CLC", expectedPage: 1204 },
      { input: "P.Cr.L.J. (2022) 150", expectedYear: 2022, expectedJournal: "PCRLJ", expectedPage: 150 },
      { input: "PLD, 2023, SC: 451", expectedYear: 2023, expectedJournal: "PLD", expectedPage: 451 },
      { input: "  2025   LHC    639  ", expectedYear: 2025, expectedCourt: "LHC", expectedPage: 639 },
      { input: "2021; YLR; (880)", expectedYear: 2021, expectedJournal: "YLR", expectedPage: 880 },
    ];

    for (const tc of complexInputs) {
      const parsed = parsePakistaniCitation(tc.input);
      assert.ok(parsed, `Failed to parse complex input: "${tc.input}"`);
      assert.equal(parsed.year, tc.expectedYear);
      assert.equal(parsed.page, tc.expectedPage);
      if (tc.expectedJournal) assert.equal(parsed.journal, tc.expectedJournal);
      if (tc.expectedCourt) assert.equal(parsed.court, tc.expectedCourt);
    }
  });

  it("Test 7.4: Zero-401 Multi-Tier Fallback resilience when backend API returns 401/500/network error", async () => {
    async function resolveJudgmentDetailWithFallback(id: string, mockStatus: number) {
      const seed = getSeedJudgmentById(id);
      if (seed) return { source: "seed", data: seed };

      if (mockStatus === 401 || mockStatus === 500) {
        const cleanCitation = id.replace(/-/g, " ");
        const seedByCit = SEED_JUDGMENTS.find((j) => j.citation.toLowerCase() === cleanCitation.toLowerCase());
        if (seedByCit) return { source: "seed_citation_fallback", data: seedByCit };
        return { source: "none", data: null };
      }
      return { source: "remote", data: { id } };
    }

    const res1 = await resolveJudgmentDetailWithFallback("pld-2023-sc-451", 401);
    assert.equal(res1.source, "seed");
    assert.equal(res1.data?.citation, "PLD 2023 SC 451");

    const res2 = await resolveJudgmentDetailWithFallback("PLD-2023-SC-451", 500);
    assert.equal(res2.data?.citation, "PLD 2023 SC 451");
  });

  it("Test 7.5: Non-existent judgment ID handling returns null/undefined safely", () => {
    assert.equal(getSeedJudgmentById("non-existent-case-999"), undefined);
    assert.equal(getSeedJudgmentById(""), undefined);
    assert.equal(getSeedJudgmentById("null"), undefined);
    assert.equal(findSeedJudgmentByCitation(1999, "SCMR", 999999), undefined);
  });

  it("Test 7.6: Single-node citation graph (0 outbound citations, 0 inbound citations) handling", () => {
    const singleNodeRecord: SeedJudgmentRecord = {
      id: "isolated-precedent-2025",
      citation: "2025 SCMR 9999",
      year: 2025,
      journal: "SCMR",
      page: 9999,
      court: "Supreme Court of Pakistan",
      courtCode: "SC",
      title: "ISOLATED TEST PRECEDENT",
      petitioner: "A",
      respondent: "B",
      decisionDate: "2025-01-01",
      bench: "Single Judge",
      category: "civil",
      headnotes: "Single node test record.",
      ratioDecidendi: {
        result: "Disposed.",
        legalPrinciples: ["Principle 1"],
        keyFindings: ["Finding 1"],
        significance: "Test significance",
      },
      fullText: "Full judgment text.",
      citationsMade: [],
      citationsReceived: [],
    };

    function computeGraphLayout(judgment: SeedJudgmentRecord) {
      const totalCitations = judgment.citationsMade.length + judgment.citationsReceived.length;
      const isIsolated = totalCitations === 0;
      const centralNode = {
        id: judgment.id,
        citation: judgment.citation,
        x: 400,
        y: 250,
        isRoot: true,
      };

      const nodes = [centralNode];
      const edges: any[] = [];
      return { totalCitations, isIsolated, nodes, edges };
    }

    const graph = computeGraphLayout(singleNodeRecord);
    assert.equal(graph.isIsolated, true);
    assert.equal(graph.totalCitations, 0);
    assert.equal(graph.nodes.length, 1);
    assert.equal(graph.edges.length, 0);
  });

  it("Test 7.7: Overruled precedent alert banner triggers and caution badges", () => {
    const overruledCase = getSeedJudgmentById("pld-1955-fc-240")!;
    assert.ok(overruledCase);
    assert.equal(overruledCase.isOverruled, true);
    assert.ok(overruledCase.overrulingCitation);

    function evaluatePrecedentStatus(judgment: SeedJudgmentRecord) {
      const overrulingCases = judgment.citationsReceived.filter(
        (c) => c.citationType === "overruled" || c.citationType === "disapproved"
      );
      const distinguishedCases = judgment.citationsReceived.filter(
        (c) => c.citationType === "distinguished" || c.citationType === "explained"
      );

      const isOverruled = judgment.isOverruled || overrulingCases.length > 0;
      const isDistinguished = !isOverruled && distinguishedCases.length > 0;

      return {
        isOverruled,
        isDistinguished,
        bannerType: isOverruled ? "negative_warning" : isDistinguished ? "caution_notice" : "good_law",
      };
    }

    const status1 = evaluatePrecedentStatus(overruledCase);
    assert.equal(status1.isOverruled, true);
    assert.equal(status1.bannerType, "negative_warning");

    const goodLawCase = getSeedJudgmentById("pld-2023-sc-451")!;
    const status2 = evaluatePrecedentStatus(goodLawCase);
    assert.equal(status2.isOverruled, false);
    assert.equal(status2.bannerType, "good_law");
  });
});

// ============================================================================
// SUITE 8: TIER 3 - CROSS-FEATURE COMBINATIONS & END-TO-END COUNSEL WORKFLOWS
// ============================================================================
describe("Tier 3: Cross-Feature Combinations & End-to-End Workflows", () => {
  it("Test 8.1: Full counsel workflow: Search -> Graph -> Reader -> Pinpoint Copy -> Drafting Studio", () => {
    const searchMatches = searchSeedJudgments("Constitution Article 199 Writs");
    assert.ok(searchMatches.length > 0);
    const targetCase = searchMatches.find((j) => j.citation === "PLD 2023 SC 451")!;
    assert.ok(targetCase, "Must find PLD 2023 SC 451");

    assert.ok(targetCase.citationsMade.length > 0);
    const reliedUpon = targetCase.citationsMade.find((c) => c.citationType === "relied_upon");
    assert.ok(reliedUpon);
    assert.equal(reliedUpon.linkedCitation, "PLD 2018 SC 189");

    const paras = targetCase.fullText.split(/\n\n+/).map((p) => p.trim()).filter((p) => p.length > 0);
    assert.ok(paras.length >= 7);

    const pinpointText = `"${paras[3]}" — ${targetCase.citation} at [4]`;
    assert.ok(pinpointText.includes("judicial review under Article 199"));

    const draftingPayload = {
      statute: targetCase.court,
      section: targetCase.citation,
      title: targetCase.title,
      clause: `JUDICIAL REVIEW MANDATE UNDER ARTICLE 199:\n${pinpointText}\n\nLEGAL RATIO:\n${targetCase.ratioDecidendi.legalPrinciples[0]}`,
      timestamp: Date.now(),
    };

    const tiptapHtml = plainTextToTiptapHTML(draftingPayload.clause);
    assert.ok(isHTMLContent(tiptapHtml));
    assert.ok(tiptapHtml.includes("PLD 2023 SC 451 at [4]"));
  });

  it("Test 8.2: Bail Application Workflow: Search CrPC 497 -> 2024 SCMR 892 -> Extract Para -> Drafting", () => {
    const results = searchSeedJudgments("CrPC Section 497 Bail");
    const bailCase = results.find((j) => j.citation === "2024 SCMR 892")!;
    assert.ok(bailCase, "Must find 2024 SCMR 892");

    const tokens = parsePakistaniCitation("2024 SCMR 892");
    assert.ok(tokens);
    assert.equal(tokens.year, 2024);
    assert.equal(tokens.journal, "SCMR");
    assert.equal(tokens.page, 892);

    const bailGround = `BAIL GROUND (S. 497(2) Cr.P.C.):\n"Where reasonable doubt or further inquiry arises from the tentative assessment of evidence, grant of bail under Section 497(2) Cr.P.C. becomes an indefeasible right." — ${bailCase.citation} (${bailCase.title})`;

    const html = plainTextToTiptapHTML(bailGround);
    assert.ok(html.includes("BAIL GROUND"));
    assert.ok(html.includes("2024 SCMR 892"));
  });

  it("Test 8.3: Specific Performance Workflow: Search SRA S. 12 -> 2023 CLC 1204 -> Extract Ratio -> Drafting", () => {
    const results = searchSeedJudgments("Specific Relief Act S. 12");
    const sraCase = results.find((j) => j.citation === "2023 CLC 1204")!;
    assert.ok(sraCase, "Must find 2023 CLC 1204");

    assert.equal(sraCase.category, "civil");
    assert.ok(sraCase.ratioDecidendi.legalPrinciples.some((p) => p.includes("specific performance") || p.includes("Specific Relief Act")));

    const clause = `PLEA OF SPECIFIC PERFORMANCE (S. 12 SPECIFIC RELIEF ACT):\n${sraCase.ratioDecidendi.legalPrinciples.join("\n")}`;
    const tiptapHtml = plainTextToTiptapHTML(clause);
    assert.ok(tiptapHtml.includes("SPECIFIC PERFORMANCE"));
  });

  it("Test 8.4: Overruled Authority Warning Workflow: Maulvi Tamizuddin -> Trigger Warning -> Discover Overruling Precedent", () => {
    const tamizuddin = getSeedJudgmentById("pld-1955-fc-240")!;
    assert.ok(tamizuddin);
    assert.equal(tamizuddin.isOverruled, true);
    assert.ok(tamizuddin.overrulingCitation.includes("PLD 2012 SC 553"));

    const overrulingItems = tamizuddin.citationsReceived.filter(
      (c) => c.citationType === "overruled" || c.citationType === "disapproved"
    );
    assert.ok(overrulingItems.length >= 2);
    assert.ok(overrulingItems.some((c) => c.linkedCitation === "PLD 2012 SC 553"));
    assert.ok(overrulingItems.some((c) => c.linkedCitation === "PLD 2009 SC 879"));
  });

  it("Test 8.5: Chambers Vault Batch Workflow: Bookmark multiple precedents -> Generate Batch Export", () => {
    const case1 = getSeedJudgmentById("pld-2023-sc-451")!;
    const case2 = getSeedJudgmentById("2024-scmr-892")!;
    const case3 = getSeedJudgmentById("2025-lhc-639")!;

    const vault = [case1, case2, case3].map((c, i) => ({
      id: i + 1,
      citation: c.citation,
      court: c.court,
      title: c.title,
      summary: c.headnotes,
      createdAt: new Date().toISOString(),
    }));

    assert.equal(vault.length, 3);
    const jsonStr = JSON.stringify(vault);
    const rehydrated = JSON.parse(jsonStr);
    assert.equal(rehydrated.length, 3);
    assert.equal(rehydrated[0].citation, "PLD 2023 SC 451");
    assert.equal(rehydrated[1].citation, "2024 SCMR 892");
    assert.equal(rehydrated[2].citation, "2025 LHC 639");
  });
});

// ============================================================================
// SUITE 9: TIER 4 - REAL-WORLD LANDMARK PAKISTANI AUTHORITIES
// ============================================================================
describe("Tier 4: Real-World Landmark Pakistani Authorities", () => {
  it("Test 9.1: Landmark 1: PLD 2023 SC 451 (Supreme Court Constitutional Art. 199/184(3), Isa CJ)", () => {
    const j = getSeedJudgmentById("pld-2023-sc-451")!;
    assert.ok(j, "PLD 2023 SC 451 must exist");
    assert.equal(j.court, "Supreme Court of Pakistan");
    assert.equal(j.year, 2023);
    assert.equal(j.journal, "PLD");
    assert.equal(j.page, 451);
    assert.equal(j.category, "constitutional");
    assert.ok(j.bench.includes("Qazi Faez Isa"));
    assert.ok(j.headnotes.includes("Arts. 199 & 184(3)"));
    assert.ok(j.citationsMade.some((c) => c.linkedCitation === "PLD 2018 SC 189" && c.citationType === "relied_upon"));
    assert.ok(j.citationsMade.some((c) => c.linkedCitation === "PLD 2012 SC 553" && c.citationType === "referred_to"));
  });

  it("Test 9.2: Landmark 2: 2024 SCMR 892 (Supreme Court Criminal Bail S. 497(2) CrPC)", () => {
    const j = getSeedJudgmentById("2024-scmr-892")!;
    assert.ok(j, "2024 SCMR 892 must exist");
    assert.equal(j.court, "Supreme Court of Pakistan");
    assert.equal(j.year, 2024);
    assert.equal(j.journal, "SCMR");
    assert.equal(j.page, 892);
    assert.equal(j.category, "criminal");
    assert.ok(j.headnotes.includes("497(2)"));
    assert.ok(j.ratioDecidendi.legalPrinciples.some((p) => p.includes("further inquiry")));
  });

  it("Test 9.3: Landmark 3: 2023 CLC 1204 (Lahore High Court Civil Specific Relief S. 12)", () => {
    const j = getSeedJudgmentById("2023-clc-1204")!;
    assert.ok(j, "2023 CLC 1204 must exist");
    assert.equal(j.court, "Lahore High Court");
    assert.equal(j.year, 2023);
    assert.equal(j.journal, "CLC");
    assert.equal(j.page, 1204);
    assert.equal(j.category, "civil");
    assert.ok(j.headnotes.includes("Specific Relief Act"));
  });

  it("Test 9.4: Landmark 4: 2025 LHC 639 (Lahore High Court Civil Revision S. 115 CPC)", () => {
    const j = getSeedJudgmentById("2025-lhc-639")!;
    assert.ok(j, "2025 LHC 639 must exist");
    assert.equal(j.court, "Lahore High Court");
    assert.equal(j.year, 2025);
    assert.equal(j.journal, "LHC");
    assert.equal(j.page, 639);
    assert.equal(j.category, "civil");
    assert.ok(j.headnotes.includes("Section 115"));
  });

  it("Test 9.5: Landmark 5: 2021 YLR 880 (Sindh High Court Family Guardians Act S. 17/25)", () => {
    const j = getSeedJudgmentById("2021-ylr-880")!;
    assert.ok(j, "2021 YLR 880 must exist");
    assert.equal(j.court, "Sindh High Court");
    assert.equal(j.year, 2021);
    assert.equal(j.journal, "YLR");
    assert.equal(j.page, 880);
    assert.equal(j.category, "family");
    assert.ok(j.headnotes.includes("Guardians and Wards Act"));
  });

  it("Test 9.6: Landmark 6: 2022 CLD 780 (Sindh High Court Banking Recovery FIO 2001 S. 9/10)", () => {
    const j = getSeedJudgmentById("2022-cld-780")!;
    assert.ok(j, "2022 CLD 780 must exist");
    assert.equal(j.court, "Sindh High Court");
    assert.equal(j.year, 2022);
    assert.equal(j.journal, "CLD");
    assert.equal(j.page, 780);
    assert.equal(j.category, "corporate");
    assert.ok(j.headnotes.includes("Financial Institutions (Recovery of Finances) Ordinance"));
  });

  it("Test 9.7: Landmark 7: 2023 PTD 1105 (Lahore High Court Tax Income Tax S. 122(5A))", () => {
    const j = getSeedJudgmentById("2023-ptd-1105")!;
    assert.ok(j, "2023 PTD 1105 must exist");
    assert.equal(j.court, "Lahore High Court");
    assert.equal(j.year, 2023);
    assert.equal(j.journal, "PTD");
    assert.equal(j.page, 1105);
    assert.equal(j.category, "tax");
    assert.ok(j.headnotes.includes("Income Tax Ordinance") && j.headnotes.includes("122(5A)"));
  });

  it("Test 9.8: Landmark 8: 2021 PLC 340 (Islamabad High Court Labor IRA 2012 S. 33)", () => {
    const j = getSeedJudgmentById("2021-plc-340")!;
    assert.ok(j, "2021 PLC 340 must exist");
    assert.equal(j.court, "Islamabad High Court");
    assert.equal(j.year, 2021);
    assert.equal(j.journal, "PLC");
    assert.equal(j.page, 340);
    assert.equal(j.category, "labor");
    assert.ok(j.headnotes.includes("Industrial Relations Act"));
  });

  it("Test 9.9: Landmark 9: PLD 1955 FC 240 (Federal Court Maulvi Tamizuddin Khan Overruled)", () => {
    const j = getSeedJudgmentById("pld-1955-fc-240")!;
    assert.ok(j, "PLD 1955 FC 240 must exist");
    assert.equal(j.court, "Federal Court of Pakistan");
    assert.equal(j.year, 1955);
    assert.equal(j.journal, "PLD");
    assert.equal(j.page, 240);
    assert.equal(j.category, "constitutional");
    assert.equal(j.isOverruled, true);
    assert.ok(j.overrulingCitation);
    assert.ok(j.citationsReceived.some((c) => c.citationType === "overruled"));
  });

  it("Test 9.10: Landmark 10: PLD 2012 SC 553 (Supreme Court Constitutional Dual Nationality / Article 63(1)(c))", () => {
    const j = getSeedJudgmentById("pld-2012-sc-553")!;
    assert.ok(j, "PLD 2012 SC 553 must exist");
    assert.equal(j.court, "Supreme Court of Pakistan");
    assert.equal(j.year, 2012);
    assert.equal(j.journal, "PLD");
    assert.equal(j.page, 553);
    assert.equal(j.category, "constitutional");
    assert.ok(j.headnotes.includes("Constitution of Pakistan (1973)") && j.headnotes.includes("Trichotomy of Powers"));
  });
});

// ============================================================================
// SUITE 10: OFFICIAL JUDGMENT API CLIENT INTERFACE CONTRACT VERIFICATION
// ============================================================================
describe("Suite 10: Official judgmentApiClient Interface Contract Verification", () => {
  it("Test 10.1: searchJudgments returns UnifiedJudgmentResult[] conforming to interface contract", async () => {
    const results = await searchJudgments({ query: "Article 199 Writs", sort: "relevance" });
    assert.ok(Array.isArray(results), "searchJudgments must return an array");
    assert.ok(results.length > 0, "searchJudgments must return matching records");

    const akram = results.find((r) => r.citation === "PLD 2023 SC 451");
    assert.ok(akram, "Must contain PLD 2023 SC 451");
    assert.equal(akram.source, "tier1_seed");
    assert.equal(akram.court, "Supreme Court of Pakistan");
    assert.ok(akram.summary.length > 0);
  });

  it("Test 10.2: lookupCitation resolves pinpoint citation to UnifiedJudgmentResult", async () => {
    const result = await lookupCitation({ year: 2024, journal: "SCMR", page: 892 });
    assert.ok(result, "lookupCitation must resolve 2024 SCMR 892");
    assert.equal(result.id, "2024-scmr-892");
    assert.equal(result.citation, "2024 SCMR 892");
    assert.equal(result.title, "TARIQ MEHMOOD Vs THE STATE");
    assert.equal(result.category, "criminal");
  });

  it("Test 10.3: getJudgmentDetail returns complete JudgmentDetailData or null", async () => {
    const detail = await getJudgmentDetail("pld-2023-sc-451");
    assert.ok(detail, "getJudgmentDetail must return detail for pld-2023-sc-451");
    assert.equal(detail.id, "pld-2023-sc-451");
    assert.equal(detail.citation, "PLD 2023 SC 451");
    assert.ok(detail.citations.made.length > 0, "Must contain citations made");
    assert.ok(detail.citations.received.length > 0, "Must contain citations received");

    const nullDetail = await getJudgmentDetail("non-existent-guid-999");
    assert.equal(nullDetail, null, "Non-existent judgment must return null");
  });

  it("Test 10.4: formatRatioOrHeadnotes generates court-ready legal pleading text", () => {
    const akram = getSeedJudgmentById("pld-2023-sc-451")!;
    const formatted = formatRatioOrHeadnotes(akram);
    assert.ok(formatted.includes("LEGAL PRECEDENT & BINDING RATIO DECIDENDI:"));
    assert.ok(formatted.includes("FEDERATION OF PAKISTAN Vs MUHAMMAD AKRAM (PLD 2023 SC 451)"));
    assert.ok(formatted.includes("Constitutional Mandate: Cited as binding apex precedent pursuant to Article 189 / 201"));
  });

  it("Test 10.5: hydrateCitationGraph provides fallback edges for isolated precedents", () => {
    const edges = hydrateCitationGraph("Unreported Case 2026", [], []);
    assert.ok(edges.made.length > 0, "Fallback graph must contain default made citations");
    assert.ok(edges.received.length > 0, "Fallback graph must contain default received citations");
  });
});
