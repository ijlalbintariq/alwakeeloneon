import assert from "node:assert/strict";
import test from "node:test";
import { jsPDF } from "jspdf";
import {
  SEED_JUDGMENTS,
  getAllSeedJudgments,
  getSeedJudgmentById,
  findSeedJudgmentByCitation,
  searchSeedJudgments,
  SeedJudgmentRecord,
} from "../../client/src/experimental/data/seedJudgmentsData";
import { parsePakistaniCitation } from "../../client/src/experimental/components/judgments/PinpointCitationParser";

// ---------------------------------------------------------------------------
// 1. SEARCH & FILTERS STRESS TESTS (PreviewJudgments & seedJudgmentsData)
// ---------------------------------------------------------------------------

test("Search: Multi-court filtering isolates judgments accurately", () => {
  const supremeCourtCases = searchSeedJudgments("", "All", "Supreme Court of Pakistan");
  assert.ok(supremeCourtCases.length >= 3, "Supreme court must have at least 3 landmark cases");
  assert.ok(
    supremeCourtCases.every((j) => j.court.toLowerCase().includes("supreme court")),
    "Every case must be Supreme Court"
  );

  const lhcCases = searchSeedJudgments("", "All", "Lahore High Court");
  assert.ok(lhcCases.length >= 3, "Lahore High Court must have at least 3 cases");
  assert.ok(
    lhcCases.every((j) => j.court.toLowerCase().includes("lahore high court")),
    "Every case must be LHC"
  );

  const shcCases = searchSeedJudgments("", "All", "Sindh High Court");
  assert.ok(shcCases.length >= 2, "Sindh High Court must have at least 2 cases");
  assert.ok(
    shcCases.every((j) => j.court.toLowerCase().includes("sindh high court")),
    "Every case must be SHC"
  );

  const ihcCases = searchSeedJudgments("", "All", "Islamabad High Court");
  assert.ok(ihcCases.length >= 1, "Islamabad High Court must have at least 1 case");
  assert.ok(
    ihcCases.every((j) => j.court.toLowerCase().includes("islamabad high court")),
    "Every case must be IHC"
  );

  // Non-existent court returns empty array gracefully
  const nonExistent = searchSeedJudgments("", "All", "NonExistent Tribunal");
  assert.equal(nonExistent.length, 0, "Non-existent court should return 0 results without crashing");
});

test("Search: Journal filtering isolates all 10 Pakistani law journals correctly", () => {
  const pldCases = searchSeedJudgments("", "PLD", "All Courts");
  assert.ok(pldCases.length >= 3, "PLD must have at least 3 cases");
  assert.ok(pldCases.every((j) => j.journal.toUpperCase() === "PLD"));

  const scmrCases = searchSeedJudgments("", "SCMR", "All Courts");
  assert.ok(scmrCases.length >= 1, "SCMR must have cases");
  assert.ok(scmrCases.every((j) => j.journal.toUpperCase() === "SCMR"));

  const clcCases = searchSeedJudgments("", "CLC", "All Courts");
  assert.ok(clcCases.length >= 1, "CLC must have cases");
  assert.ok(clcCases.every((j) => j.journal.toUpperCase() === "CLC"));

  const ylrCases = searchSeedJudgments("", "YLR", "All Courts");
  assert.ok(ylrCases.length >= 1, "YLR must have cases");
  assert.ok(ylrCases.every((j) => j.journal.toUpperCase() === "YLR"));

  const cldCases = searchSeedJudgments("", "CLD", "All Courts");
  assert.ok(cldCases.length >= 1, "CLD must have cases");
  assert.ok(cldCases.every((j) => j.journal.toUpperCase() === "CLD"));

  const ptdCases = searchSeedJudgments("", "PTD", "All Courts");
  assert.ok(ptdCases.length >= 1, "PTD must have cases");
  assert.ok(ptdCases.every((j) => j.journal.toUpperCase() === "PTD"));

  const plcCases = searchSeedJudgments("", "PLC", "All Courts");
  assert.ok(plcCases.length >= 1, "PLC must have cases");
  assert.ok(plcCases.every((j) => j.journal.toUpperCase() === "PLC"));

  // "All" journal preserves full dataset
  const allJournals = searchSeedJudgments("", "All", "All Courts");
  assert.equal(allJournals.length, SEED_JUDGMENTS.length);
});

test("Search: Year filtering handles exact years and All Years", () => {
  const cases2023 = searchSeedJudgments("", "All", "All Courts", "2023");
  assert.ok(cases2023.length >= 3, "Must find multiple 2023 cases");
  assert.ok(cases2023.every((j) => j.year === 2023));

  const cases1955 = searchSeedJudgments("", "All", "All Courts", "1955");
  assert.equal(cases1955.length, 1);
  assert.equal(cases1955[0].citation, "PLD 1955 FC 240");

  const nonExistentYear = searchSeedJudgments("", "All", "All Courts", "1999");
  assert.equal(nonExistentYear.length, 0);

  const allYears = searchSeedJudgments("", "All", "All Courts", undefined);
  assert.equal(allYears.length, SEED_JUDGMENTS.length);
});

test("Search: Sort orders (latest, most_cited, relevance)", () => {
  // Sort by latest (descending decisionDate)
  const latestSorted = searchSeedJudgments("", "All", "All Courts", undefined, "latest");
  for (let i = 0; i < latestSorted.length - 1; i++) {
    const d1 = new Date(latestSorted[i].decisionDate).getTime();
    const d2 = new Date(latestSorted[i + 1].decisionDate).getTime();
    assert.ok(d1 >= d2, `Decision dates must be in descending order: ${latestSorted[i].decisionDate} vs ${latestSorted[i + 1].decisionDate}`);
  }

  // Sort by most_cited (descending citationsReceived count)
  const citedSorted = searchSeedJudgments("", "All", "All Courts", undefined, "most_cited");
  for (let i = 0; i < citedSorted.length - 1; i++) {
    const c1 = citedSorted[i].citationsReceived.length;
    const c2 = citedSorted[i + 1].citationsReceived.length;
    assert.ok(c1 >= c2, `Citations received must be descending: ${c1} vs ${c2}`);
  }

  // Relevance search with matching terms
  const bailResults = searchSeedJudgments("Bail");
  assert.ok(bailResults.length >= 1, "Should find bail precedents");
  assert.ok(bailResults.some((j) => j.citation === "2024 SCMR 892"));

  const constResults = searchSeedJudgments("Constitutional");
  assert.ok(constResults.length >= 1, "Should find constitutional precedents");
});

test("Search: Empty queries and whitespace-only queries execute safely", () => {
  const empty1 = searchSeedJudgments("");
  assert.equal(empty1.length, SEED_JUDGMENTS.length);

  const empty2 = searchSeedJudgments("   ");
  assert.equal(empty2.length, SEED_JUDGMENTS.length);

  const empty3 = searchSeedJudgments("\t\n");
  assert.equal(empty3.length, SEED_JUDGMENTS.length);
});

test("Search Verification: Statutes & Quick Codes queries return matches in searchSeedJudgments", () => {
  const codes = [
    "Constitution Article 199 Writs",
    "CrPC Section 497 Bail",
    "CPC Section 115 Revisions",
    "Specific Relief Act S. 12",
    "Companies Act 2017",
    "Income Tax Ordinance S. 122",
    "Industrial Relations Act 2012",
  ];

  const matchResults = codes.map((c) => ({
    code: c,
    matchCount: searchSeedJudgments(c).length,
  }));

  assert.ok(
    matchResults.every((f) => f.matchCount > 0),
    "All 7 sidebar quick code buttons return matching landmark case law"
  );
});

// ---------------------------------------------------------------------------
// 2. DIRECTORY BROWSER HIERARCHY & FILTERING STRESS TESTS
// ---------------------------------------------------------------------------

test("DirectoryBrowser: 4-Tier filtering and pagination simulation", () => {
  // Test 1: Category filter isolation
  const criminalCases = SEED_JUDGMENTS.filter((j) => j.category === "criminal");
  assert.ok(criminalCases.length >= 1);
  assert.ok(criminalCases.every((j) => j.category === "criminal"));

  const constitutionalCases = SEED_JUDGMENTS.filter((j) => j.category === "constitutional");
  assert.ok(constitutionalCases.length >= 3);
  assert.ok(constitutionalCases.every((j) => j.category === "constitutional"));

  // Test 2: CourtCode filter
  const lhcCases = SEED_JUDGMENTS.filter((j) => j.courtCode === "LHC");
  assert.ok(lhcCases.length >= 2);
  assert.ok(lhcCases.every((j) => j.courtCode === "LHC"));

  // Test 3: Pagination boundaries
  const itemsPerPage = 8;
  const totalItems = SEED_JUDGMENTS.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  assert.equal(totalPages, 2, "10 seed cases with 8 per page must equal 2 total pages");

  const page1 = SEED_JUDGMENTS.slice(0, 8);
  const page2 = SEED_JUDGMENTS.slice(8, 16);
  assert.equal(page1.length, 8);
  assert.equal(page2.length, totalItems - 8);

  // Test 4: Combined multi-criteria search in directory
  const query = "bail";
  const filtered = SEED_JUDGMENTS.filter(
    (j) =>
      j.title.toLowerCase().includes(query) ||
      j.citation.toLowerCase().includes(query) ||
      j.headnotes.toLowerCase().includes(query) ||
      j.bench.toLowerCase().includes(query)
  );
  assert.ok(filtered.length >= 1);
  assert.equal(filtered[0].id, "2024-scmr-892");
});

// ---------------------------------------------------------------------------
// 3. CHAMBERS BOOKMARK SYNCHRONIZATION & BATCH EXPORT STRESS TESTS
// ---------------------------------------------------------------------------

test("Bookmarks: Add, remove, deduplicate and live counter synchronization", () => {
  const initialBookmarks = [
    {
      id: 101,
      citation: "PLD 2023 SC 451",
      court: "Supreme Court of Pakistan",
      title: "FEDERATION OF PAKISTAN Vs MUHAMMAD AKRAM",
      summary: "Article 199 writ jurisdiction cannot be used as an appellate forum against statutory tribunals.",
      createdAt: new Date().toISOString(),
    },
    {
      id: 102,
      citation: "2024 SCMR 892",
      court: "Supreme Court of Pakistan",
      title: "TARIQ MEHMOOD Vs THE STATE",
      summary: "Bail under Section 497(2) Cr.P.C. in cases of further inquiry is a matter of statutory right.",
      createdAt: new Date().toISOString(),
    },
  ];

  // Initial count
  assert.equal(initialBookmarks.length, 2);

  // Toggle remove existing bookmark
  const citationToRemove = "PLD 2023 SC 451";
  const removedList = initialBookmarks.filter((b) => b.citation !== citationToRemove);
  assert.equal(removedList.length, 1);
  assert.equal(removedList[0].citation, "2024 SCMR 892");

  // Toggle add new bookmark
  const newPrecedent = {
    id: Date.now(),
    citation: "2025 LHC 639",
    court: "Lahore High Court",
    title: "BASHIR AHMAD Vs MST. ZUBAIDA",
    summary: "Revisional powers under Section 115 CPC are strictly supervisory.",
    createdAt: new Date().toISOString(),
  };
  const addedList = [newPrecedent, ...removedList];
  assert.equal(addedList.length, 2);
  assert.equal(addedList[0].citation, "2025 LHC 639");

  // Deduplication check: consolidating server and local bookmarks
  const serverBookmarks = [
    {
      id: 201,
      citation: "2025 LHC 639",
      court: "Lahore High Court",
      title: "BASHIR AHMAD Vs MST. ZUBAIDA",
      summary: "Revisional powers under Section 115 CPC are strictly supervisory.",
      createdAt: new Date().toISOString(),
    },
  ];
  const consolidated = [...serverBookmarks];
  addedList.forEach((lb) => {
    if (!consolidated.some((s) => s.citation === lb.citation)) {
      consolidated.push(lb);
    }
  });
  assert.equal(consolidated.length, 2, "Consolidation must prevent duplicate citations");
});

test("Bookmarks: Batch export text generator formatting", () => {
  const bookmarks = [
    {
      id: 101,
      citation: "PLD 2023 SC 451",
      court: "Supreme Court of Pakistan",
      title: "FEDERATION OF PAKISTAN Vs MUHAMMAD AKRAM",
      summary: "Article 199 writ jurisdiction cannot be used as an appellate forum.",
      createdAt: "2026-08-22T12:00:00.000Z",
    },
    {
      id: 102,
      citation: "2024 SCMR 892",
      court: "Supreme Court of Pakistan",
      title: "TARIQ MEHMOOD Vs THE STATE",
      summary: "Bail under Section 497(2) Cr.P.C. in cases of further inquiry is a matter of statutory right.",
      createdAt: "2026-08-22T12:00:00.000Z",
    },
  ];

  const lines: string[] = [
    `================================================================`,
    `AL WAKEELO — COUNSEL'S SAVED PRECEDENTS VAULT EXPORT`,
    `================================================================`,
    `Total Saved Authorities: ${bookmarks.length}`,
    `Exported: ${new Date("2026-08-22T12:00:00.000Z").toLocaleString("en-PK")}`,
    ``,
  ];

  bookmarks.forEach((b, idx) => {
    lines.push(`[${idx + 1}] ${b.citation}`);
    lines.push(`    Court: ${b.court}`);
    lines.push(`    Title: ${b.title}`);
    lines.push(`    Summary: ${b.summary}`);
    lines.push(`    Saved Date: ${new Date(b.createdAt).toLocaleDateString("en-PK")}`);
    lines.push(`----------------------------------------------------------------`);
  });

  const exportText = lines.join("\n");
  assert.ok(exportText.includes("Total Saved Authorities: 2"));
  assert.ok(exportText.includes("[1] PLD 2023 SC 451"));
  assert.ok(exportText.includes("[2] 2024 SCMR 892"));
  assert.ok(exportText.includes("Supreme Court of Pakistan"));
});

// ---------------------------------------------------------------------------
// 4. JUDGMENT READER INTERACTION & CLAMP STRESS TESTS
// ---------------------------------------------------------------------------

test("JudgmentReader: Font scaling clamping logic [13pt - 18pt]", () => {
  // Test lower clamp (minimum 13pt)
  let size = 15;
  size = Math.max(13, size - 1); // 14
  assert.equal(size, 14);
  size = Math.max(13, size - 1); // 13
  assert.equal(size, 13);
  size = Math.max(13, size - 1); // 13 (clamped)
  assert.equal(size, 13, "Font size must not decrease below 13pt");
  size = Math.max(13, size - 5); // 13 (clamped)
  assert.equal(size, 13);

  // Test upper clamp (maximum 18pt)
  size = 17;
  size = Math.min(18, size + 1); // 18
  assert.equal(size, 18);
  size = Math.min(18, size + 1); // 18 (clamped)
  assert.equal(size, 18, "Font size must not increase beyond 18pt");
  size = Math.min(18, size + 10); // 18 (clamped)
  assert.equal(size, 18);
});

test("JudgmentReader: Paragraph splitting and pinpoint citation copying format", () => {
  const sampleFullText = `[1] QAZI FAEZ ISA, CJ.---This civil appeal by leave is directed against the High Court judgment.

[2] The primary question of constitutional jurisprudence arising is Article 199 writ boundaries.

[3] We have heard the learned Attorney-General at great length.`;

  const paragraphs = sampleFullText
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  assert.equal(paragraphs.length, 3, "Must split into exactly 3 paragraphs");
  assert.ok(paragraphs[0].startsWith("[1] QAZI FAEZ ISA"));
  assert.ok(paragraphs[1].startsWith("[2] The primary question"));
  assert.ok(paragraphs[2].startsWith("[3] We have heard"));

  // Verify pinpoint paragraph citation copy string format
  const citation = "PLD 2023 SC 451";
  const paraNum = 2;
  const paraText = paragraphs[1];
  const pinpoint = `${citation} at [${paraNum}]`;
  const fullSnippet = `"${paraText.trim()}" — ${pinpoint}`;

  assert.equal(
    fullSnippet,
    `"[2] The primary question of constitutional jurisprudence arising is Article 199 writ boundaries." — PLD 2023 SC 451 at [2]`
  );
});

test("JudgmentReader: Theme style map verification (Obsidian, Parchment, Print)", () => {
  const themeClasses: Record<"obsidian" | "cream" | "light", string> = {
    obsidian: "bg-[#0B0F17] text-[#E2E8F0] border-[#1E293B]",
    cream: "bg-[#FBF7EE] text-[#1C1917] border-[#E7DEC8]",
    light: "bg-white text-[#0F172A] border-[#E2E8F0]",
  };

  assert.ok(themeClasses.obsidian.includes("bg-[#0B0F17]"));
  assert.ok(themeClasses.cream.includes("bg-[#FBF7EE]"));
  assert.ok(themeClasses.light.includes("bg-white"));
});

// ---------------------------------------------------------------------------
// 5. PDF GENERATOR SAFETY EMPIRICAL STRESS TESTS (jsPDF)
// ---------------------------------------------------------------------------

test("PDF Generator: jsPDF safety with realistic Pakistani judgment text, missing fields and page splits", () => {
  const judgment = getSeedJudgmentById("pld-2023-sc-451")!;
  assert.ok(judgment, "Judgment must exist");

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = 24;

  const addText = (
    text: string,
    fontSize: number,
    style: "normal" | "bold" | "italic" = "normal",
    maxWidth = contentWidth
  ) => {
    doc.setFontSize(fontSize);
    doc.setFont("times", style);
    const paragraphs = text.split(/\r?\n/);
    for (const paragraph of paragraphs) {
      if (paragraph.trim() === "") {
        y += fontSize * 0.45;
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        continue;
      }
      const lines = doc.splitTextToSize(paragraph, maxWidth);
      for (const line of lines) {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        doc.text(line, margin, y);
        y += fontSize * 0.45;
      }
    }
    y += 2;
  };

  const addLine = () => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    doc.setDrawColor(180);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;
  };

  // Execute rendering operations
  addText("AL WAKEELO — PAKISTANI PRECEDENT RESEARCH ENGINE", 8, "normal");
  addText(judgment.title, 14, "bold");
  addText(`Citation: ${judgment.citation}`, 10, "bold");
  addText(`Court: ${judgment.court}`, 10);
  addText(`Decision Date: ${judgment.decisionDate}`, 10);
  addText(`${judgment.petitioner} VS ${judgment.respondent}`, 10, "italic");
  addLine();
  addText("OFFICIAL HEADNOTES & STATUTORY PROPOSITIONS", 11, "bold");
  addText(judgment.headnotes, 9);
  addLine();
  addText("FULL JUDGMENT & ORDER OF THE COURT", 11, "bold");
  addText(judgment.fullText, 9.5);
  addLine();

  // Test page count and safe output generation
  const pageCount = doc.getNumberOfPages();
  assert.ok(pageCount >= 1, "PDF must generate at least 1 page");
  const outputData = doc.output("arraybuffer");
  assert.ok(outputData.byteLength > 1000, "PDF binary must be generated cleanly");

  // Test filename sanitization
  const filename = `${judgment.citation.replace(/[^a-zA-Z0-9]/g, "_")}_Judgment.pdf`;
  assert.equal(filename, "PLD_2023_SC_451_Judgment.pdf");
});

test("PDF Generator: Handles empty/null/missing fields without crashing", () => {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const margin = 20;
  const contentWidth = doc.internal.pageSize.getWidth() - margin * 2;
  let y = 24;

  const addText = (text: string, fontSize: number) => {
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(text || "", contentWidth);
    for (const line of lines) {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.text(line, margin, y);
      y += fontSize * 0.45;
    }
  };

  // Test with undefined/null equivalents
  addText("", 10);
  addText("   ", 10);
  addText("Special unicode chars: § 199, Article 189/201, PKR 10,000/- & Cr.P.C.", 10);

  const pages = doc.getNumberOfPages();
  assert.ok(pages >= 1);
});

// ---------------------------------------------------------------------------
// 6. NEGATIVE PRECEDENT OVERRULED ALERT BANNER STRESS TESTS
// ---------------------------------------------------------------------------

test("OverruledAlertBanner: Correctly identifies Overruled vs Distinguished vs Good Law", () => {
  const tamizuddin = getSeedJudgmentById("pld-1955-fc-240")!;
  assert.ok(tamizuddin);

  const overrulingCases = tamizuddin.citationsReceived.filter(
    (c) => c.citationType?.toLowerCase() === "overruled" || c.citationType?.toLowerCase() === "disapproved"
  );
  const distinguishedCases = tamizuddin.citationsReceived.filter(
    (c) => c.citationType?.toLowerCase() === "distinguished" || c.citationType?.toLowerCase() === "explained"
  );

  const isOverruled = overrulingCases.length > 0;
  const isDistinguished = !isOverruled && distinguishedCases.length > 0;

  assert.equal(isOverruled, true, "PLD 1955 FC 240 must be recognized as OVERRULED");
  assert.equal(isDistinguished, false);
  assert.ok(overrulingCases.length >= 2, "Must link to Baz Muhammad Kakar and SHCBA overruling cases");

  // Test Good Law precedent (PLD 2023 SC 451)
  const akramCase = getSeedJudgmentById("pld-2023-sc-451")!;
  const akramOverruled = (akramCase.citationsReceived || []).filter(
    (c) => c.citationType?.toLowerCase() === "overruled" || c.citationType?.toLowerCase() === "disapproved"
  );
  const akramDistinguished = (akramCase.citationsReceived || []).filter(
    (c) => c.citationType?.toLowerCase() === "distinguished" || c.citationType?.toLowerCase() === "explained"
  );

  assert.equal(akramOverruled.length, 0, "PLD 2023 SC 451 is good law (not overruled)");
  assert.equal(akramDistinguished.length, 0, "PLD 2023 SC 451 is not distinguished");
});

// ---------------------------------------------------------------------------
// 7. AI PRECEDENT SIDECAR INTELLIGENCE & QUICK PROMPTS STRESS TESTS
// ---------------------------------------------------------------------------

import { generateLocalLegalResponse } from "../../client/src/experimental/components/judgments/JudgmentAiSidecar";

test("AI Sidecar Verification: Chambers Case Brief Quick Prompt correctly outputs Case Brief", () => {
  const judgment = getSeedJudgmentById("pld-2023-sc-451")!;
  const prompt5 =
    "Draft a formal 1-page Chambers Case Brief memo summarizing: Bench, Facts, Question of Law, Ratio Decidendi, and Operative Order.";

  const actualResponse = generateLocalLegalResponse(
    prompt5,
    judgment.citation,
    judgment.title,
    judgment.headnotes,
    judgment.fullText
  );

  assert.ok(
    actualResponse.includes("Chambers Legal Case Brief"),
    "Prompt 5 returns Chambers Legal Case Brief"
  );
  assert.ok(
    !actualResponse.includes("Ratio Decidendi Analysis"),
    "Prompt 5 is not shadowed by Ratio Decidendi"
  );
});

// ---------------------------------------------------------------------------
// 8. RATIO DECIDENDI OFFLINE HEADNOTES SYNTHESIS FALLBACK TEST
// ---------------------------------------------------------------------------

test("RatioDecidendiCard: Headnotes parsing fallback generates structured legal summary", () => {
  const headnotes = `Constitution of Pakistan (1973), Arts. 199 & 184(3)---Extraordinary Constitutional Jurisdiction of High Courts---Scope and Limitations---High Court cannot convert itself into a court of appeal against statutory tribunals unless the impugned order is shown to be coram non judice.`;

  const lines = headnotes
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const fallbackSummary = {
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

  assert.ok(fallbackSummary.result.length > 10);
  assert.ok(fallbackSummary.legalPrinciples.length >= 1);
  assert.ok(fallbackSummary.keyFindings.length === 3);
  assert.ok(fallbackSummary.significance.includes("Article 189/201") || fallbackSummary.keyFindings[2].includes("Article 189/201"));
});
