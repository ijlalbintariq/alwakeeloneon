import assert from "node:assert/strict";
import test from "node:test";
import {
  SEED_JUDGMENTS,
  getAllSeedJudgments,
  getSeedJudgmentById,
  findSeedJudgmentByCitation,
  searchSeedJudgments,
} from "../../client/src/experimental/data/seedJudgmentsData";
import { parsePakistaniCitation } from "../../client/src/experimental/components/judgments/PinpointCitationParser";
import { generateLocalLegalResponse } from "../../client/src/experimental/components/judgments/JudgmentAiSidecar";

test("Seed database contains comprehensive landmark cases across 7 legal domains", () => {
  const allJudgments = getAllSeedJudgments();
  assert.ok(allJudgments.length >= 8, "Must contain at least 8 landmark judgments");

  const categories = new Set(allJudgments.map((j) => j.category));
  assert.ok(categories.has("constitutional"), "Must contain constitutional law");
  assert.ok(categories.has("criminal"), "Must contain criminal law");
  assert.ok(categories.has("civil"), "Must contain civil law");
  assert.ok(categories.has("family"), "Must contain family law");
  assert.ok(categories.has("corporate"), "Must contain corporate law");
  assert.ok(categories.has("tax"), "Must contain tax law");
  assert.ok(categories.has("labor"), "Must contain labor law");
});

test("Seed database contains bidirectional citation relationships", () => {
  const akramCase = getSeedJudgmentById("pld-2023-sc-451");
  assert.ok(akramCase, "Must find PLD 2023 SC 451");
  assert.ok(akramCase.citationsMade.length > 0, "Must have outbound citations");
  assert.ok(akramCase.citationsReceived.length > 0, "Must have inbound citations");

  const reliedUpon = akramCase.citationsMade.find((c) => c.citationType === "relied_upon");
  assert.ok(reliedUpon, "Must contain relied_upon citation");
  assert.equal(reliedUpon.linkedCitation, "PLD 2018 SC 189");
});

test("Seed database correctly flags Overruled landmark precedent (Maulvi Tamizuddin Khan)", () => {
  const tamizuddin = getSeedJudgmentById("pld-1955-fc-240");
  assert.ok(tamizuddin, "Must find PLD 1955 FC 240");
  assert.equal(tamizuddin.isOverruled, true);
  assert.ok(tamizuddin.overrulingCitation);

  const overruledCitations = tamizuddin.citationsReceived.filter(
    (c) => c.citationType === "overruled" || c.citationType === "disapproved"
  );
  assert.ok(overruledCitations.length >= 2, "Must link to subsequent overruling cases");
});

test("findSeedJudgmentByCitation resolves exact pinpoint queries", () => {
  const match1 = findSeedJudgmentByCitation(2024, "SCMR", 892);
  assert.ok(match1);
  assert.equal(match1.id, "2024-scmr-892");
  assert.equal(match1.title, "TARIQ MEHMOOD Vs THE STATE");

  const match2 = findSeedJudgmentByCitation(2023, "CLC", 1204);
  assert.ok(match2);
  assert.equal(match2.id, "2023-clc-1204");
});

test("searchSeedJudgments filters by court, journal, and query", () => {
  const supremeCourtCases = searchSeedJudgments("", "All", "Supreme Court of Pakistan");
  assert.ok(supremeCourtCases.length >= 2);
  assert.ok(supremeCourtCases.every((j) => j.court.includes("Supreme Court")));

  const bailSearch = searchSeedJudgments("Bail");
  assert.ok(bailSearch.length >= 1);
  assert.ok(bailSearch.some((j) => j.citation === "2024 SCMR 892"));
});

test("parsePakistaniCitation handles punctuation, normalized formats and dot-spaced acronyms", () => {
  const res1 = parsePakistaniCitation("PLD, 2023, SC: 451");
  assert.ok(res1);
  assert.equal(res1.year, 2023);
  assert.equal(res1.journal, "PLD");
  assert.equal(res1.page, 451);
  assert.equal(res1.isValid, true);

  const res2 = parsePakistaniCitation("P.Cr.L.J (2022) 150");
  assert.ok(res2);
  assert.equal(res2.year, 2022);
  assert.equal(res2.journal, "PCRLJ");
  assert.equal(res2.page, 150);

  // Spaced dot acronym tests
  const res3 = parsePakistaniCitation("P. L. D. 2023 SC 451");
  assert.ok(res3, "Must parse P. L. D. 2023 SC 451");
  assert.equal(res3.year, 2023);
  assert.equal(res3.journal, "PLD");
  assert.equal(res3.page, 451);
  assert.equal(res3.court, "SC");

  const res4 = parsePakistaniCitation("P. Cr. L. J. 2022 150");
  assert.ok(res4, "Must parse P. Cr. L. J. 2022 150");
  assert.equal(res4.year, 2022);
  assert.equal(res4.journal, "PCRLJ");
  assert.equal(res4.page, 150);

  const res5 = parsePakistaniCitation("S. C. M. R. 2024 892");
  assert.ok(res5, "Must parse S. C. M. R. 2024 892");
  assert.equal(res5.year, 2024);
  assert.equal(res5.journal, "SCMR");
  assert.equal(res5.page, 892);

  const res6 = parsePakistaniCitation("C. L. C. 2023 1204");
  assert.ok(res6, "Must parse C. L. C. 2023 1204");
  assert.equal(res6.year, 2023);
  assert.equal(res6.journal, "CLC");
  assert.equal(res6.page, 1204);

  const res7 = parsePakistaniCitation("Y. L. R. 2021 880");
  assert.ok(res7, "Must parse Y. L. R. 2021 880");
  assert.equal(res7.year, 2021);
  assert.equal(res7.journal, "YLR");
  assert.equal(res7.page, 880);
});

test("AI Sidecar: Prompt #5 Chambers Case Brief memo takes priority over Ratio Decidendi", () => {
  const judgment = getSeedJudgmentById("pld-2023-sc-451")!;
  assert.ok(judgment);

  const prompt5 =
    "Draft a formal 1-page Chambers Case Brief memo summarizing: Bench, Facts, Question of Law, Ratio Decidendi, and Operative Order.";

  const briefResponse = generateLocalLegalResponse(
    prompt5,
    judgment.citation,
    judgment.title,
    judgment.headnotes,
    judgment.fullText
  );

  assert.ok(
    briefResponse.includes("### **Chambers Legal Case Brief**"),
    "Prompt #5 must return the structured Chambers Legal Case Brief memo"
  );
  assert.ok(
    !briefResponse.includes("### **Ratio Decidendi Analysis"),
    "Prompt #5 must not be shadowed by the Ratio Decidendi branch"
  );

  const ratioPrompt =
    "Extract the core Ratio Decidendi, legal propositions, and binding rule established in this judgment.";
  const ratioResponse = generateLocalLegalResponse(
    ratioPrompt,
    judgment.citation,
    judgment.title,
    judgment.headnotes,
    judgment.fullText
  );

  assert.ok(
    ratioResponse.includes("### **Ratio Decidendi Analysis"),
    "Direct Ratio Decidendi prompt returns Ratio Decidendi Analysis"
  );
});

test("Search: All 7 Statutes & Quick Codes queries return matching landmark cases", () => {
  const quickCodeQueries = [
    { query: "Constitution Article 199 Writs", expectedCitation: "PLD 2023 SC 451" },
    { query: "CrPC Section 497 Bail", expectedCitation: "2024 SCMR 892" },
    { query: "CPC Section 115 Revisions", expectedCitation: "2025 LHC 639" },
    { query: "Specific Relief Act S. 12", expectedCitation: "2023 CLC 1204" },
    { query: "Companies Act 2017", expectedCitation: "2022 CLD 780" },
    { query: "Income Tax Ordinance S. 122", expectedCitation: "2023 PTD 1105" },
    { query: "Industrial Relations Act 2012", expectedCitation: "2021 PLC 340" },
  ];

  for (const item of quickCodeQueries) {
    const results = searchSeedJudgments(item.query);
    assert.ok(
      results.length > 0,
      `Query "${item.query}" must return at least 1 matching landmark judgment`
    );
    assert.ok(
      results.some((j) => j.citation === item.expectedCitation),
      `Query "${item.query}" must include expected precedent ${item.expectedCitation}`
    );
  }
});

// ============================================================================
// SUITE 2: TWO-TIER JUDGMENT API CLIENT & DRAFTING STUDIO TRIPLE-BRIDGE
// ============================================================================

import {
  searchJudgments,
  lookupCitation,
  getJudgmentDetail,
  saveJudgmentBookmark,
  getSavedJudgments,
  formatRatioOrHeadnotes,
  createDraftingInsertPayload,
  hydrateCitationGraph,
} from "../../client/src/experimental/lib/judgmentApiClient";

test("judgmentApiClient: searchJudgments returns structured Pakistani precedent records", async () => {
  const allResults = await searchJudgments({ query: "", journal: "All", court: "All Courts" });
  assert.ok(allResults.length >= 10, "Must return at least 10 seed judgments");

  const pldCases = await searchJudgments({ query: "", journal: "PLD" });
  assert.ok(pldCases.length >= 2, "Must return PLD judgments");
  assert.ok(pldCases.every((j) => j.citation.includes("PLD")));

  const scCases = await searchJudgments({ query: "", court: "Supreme Court of Pakistan" });
  assert.ok(scCases.length >= 3, "Must return Supreme Court judgments");
  assert.ok(scCases.every((j) => j.court.includes("Supreme Court")));
});

test("judgmentApiClient: lookupCitation resolves pinpoint citation queries with full metadata", async () => {
  const match = await lookupCitation({ year: 2024, journal: "SCMR", page: 892 });
  assert.ok(match, "Must find 2024 SCMR 892");
  assert.equal(match.citation, "2024 SCMR 892");
  assert.equal(match.court, "Supreme Court of Pakistan");
  assert.ok(match.ratioDecidendi, "Must include ratio decidendi");
  assert.ok(match.citationsMade && match.citationsMade.length > 0, "Must include citationsMade");

  const rawMatch = await lookupCitation({ year: 2023, page: 451, citationRaw: "PLD 2023 SC 451" });
  assert.ok(rawMatch, "Must resolve by raw citation PLD 2023 SC 451");
  assert.equal(rawMatch.id, "pld-2023-sc-451");
});

test("judgmentApiClient: getJudgmentDetail returns complete judgment text, TOC anchors, and graph edges", async () => {
  const detail = await getJudgmentDetail("pld-2023-sc-451");
  assert.ok(detail, "Must load PLD 2023 SC 451 detail");
  assert.ok(detail.fullText.length > 200, "Must contain full judgment text");
  assert.ok(detail.headnotes && detail.headnotes.length > 50, "Must contain headnotes");
  assert.ok(detail.citations.made.length >= 2, "Must contain outbound citations");
  assert.ok(detail.citations.received.length >= 1, "Must contain inbound citations");
  assert.equal(detail.court, "Supreme Court of Pakistan");
});

test("judgmentApiClient: Drafting Insert Triple-Bridge produces valid schema compliant with PreviewDrafting", () => {
  const sampleCase = getSeedJudgmentById("2024-scmr-892")!;
  assert.ok(sampleCase);

  const clause = formatRatioOrHeadnotes(sampleCase);
  assert.ok(clause.includes("LEGAL PRECEDENT & BINDING RATIO DECIDENDI:"));
  assert.ok(clause.includes("2024 SCMR 892"));
  assert.ok(clause.includes("TARIQ MEHMOOD Vs THE STATE"));
  assert.ok(clause.includes("Article 189 / 201"));

  const payload = createDraftingInsertPayload(sampleCase);
  assert.equal(payload.statute, sampleCase.court);
  assert.equal(payload.section, sampleCase.citation);
  assert.equal(payload.title, sampleCase.title);
  assert.equal(payload.clause, clause);
  assert.ok(payload.timestamp > 0);
});

test("judgmentApiClient: hydrateCitationGraph provides complete citation edges for standalone modal", () => {
  const edges = hydrateCitationGraph("PLD 2023 SC 451");
  assert.ok(edges.made.length > 0, "Must have outbound citation edges");
  assert.ok(edges.received.length > 0, "Must have inbound citation edges");

  const unknownEdges = hydrateCitationGraph("2099 UNREPORTED 999");
  assert.ok(unknownEdges.made.length > 0, "Fallback must supply default constitutional edges");
  assert.ok(unknownEdges.received.length > 0, "Fallback must supply default inbound edges");
});

test("judgmentApiClient: New landmark court coverage in seed registry (PHC, BHC, FSC)", () => {
  const phcCase = getSeedJudgmentById("2023-pcrlj-890");
  assert.ok(phcCase, "Must contain Peshawar High Court case 2023 PCrLJ 890");
  assert.equal(phcCase.courtCode, "PHC");

  const bhcCase = getSeedJudgmentById("2022-mld-1450");
  assert.ok(bhcCase, "Must contain Balochistan High Court case 2022 MLD 1450");
  assert.equal(bhcCase.courtCode, "BHC");

  const fscCase = getSeedJudgmentById("pld-2022-fsc-1");
  assert.ok(fscCase, "Must contain Federal Shariat Court case PLD 2022 FSC 1");
  assert.equal(fscCase.courtCode, "FSC");
});

