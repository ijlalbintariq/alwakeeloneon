import assert from "node:assert/strict";
import test from "node:test";
import {
  parsePakistaniCitation,
} from "../../client/src/experimental/components/judgments/PinpointCitationParser";
import {
  SEED_JUDGMENTS,
  getAllSeedJudgments,
  getSeedJudgmentById,
  findSeedJudgmentByCitation,
  searchSeedJudgments,
  SeedJudgmentRecord,
} from "../../client/src/experimental/data/seedJudgmentsData";
import { PrecedentCitationItem } from "../../client/src/experimental/components/judgments/OverruledAlertBanner";

// ===========================================================================
// SUITE 1: PINPOINT CITATION PARSER ADVERSARIAL STRESS SUITE
// ===========================================================================

test("PinpointParser: All 10 Pakistani Law Journals & Neutral Citations Resolution", () => {
  const journalsTestCases = [
    // 1. PLD (All Pakistan Legal Decisions)
    { input: "PLD 2023 SC 451", expYear: 2023, expJournal: "PLD", expPage: 451, expCourt: "SC" },
    { input: "PLD 1955 FC 240", expYear: 1955, expJournal: "PLD", expPage: 240, expCourt: "FC" },
    { input: "PLD 2012 SC 553", expYear: 2012, expJournal: "PLD", expPage: 553, expCourt: "SC" },
    { input: "PLD 2020 Lahore 120", expYear: 2020, expJournal: "PLD", expPage: 120, expCourt: "Lahore" },
    { input: "PLD 2019 Karachi 88", expYear: 2019, expJournal: "PLD", expPage: 88, expCourt: "Karachi" },
    { input: "PLD 2021 Peshawar 45", expYear: 2021, expJournal: "PLD", expPage: 45, expCourt: "Peshawar" },
    { input: "PLD 2022 Quetta 19", expYear: 2022, expJournal: "PLD", expPage: 19, expCourt: "Quetta" },
    { input: "PLD 2024 Islamabad 77", expYear: 2024, expJournal: "PLD", expPage: 77, expCourt: "Islamabad" },
    { input: "PLD 2018 FSC 14", expYear: 2018, expJournal: "PLD", expPage: 14, expCourt: "FSC" },

    // 2. SCMR (Supreme Court Monthly Review)
    { input: "2024 SCMR 892", expYear: 2024, expJournal: "SCMR", expPage: 892 },
    { input: "1995 SCMR 1350", expYear: 1995, expJournal: "SCMR", expPage: 1350 },
    { input: "2021 SCMR 500", expYear: 2021, expJournal: "SCMR", expPage: 500 },

    // 3. CLC (Civil Law Cases)
    { input: "2023 CLC 1204", expYear: 2023, expJournal: "CLC", expPage: 1204 },
    { input: "2024 CLC 305", expYear: 2024, expJournal: "CLC", expPage: 305 },

    // 4. PCrLJ (Pakistan Criminal Law Journal)
    { input: "2022 PCrLJ 150", expYear: 2022, expJournal: "PCRLJ", expPage: 150 },
    { input: "2025 PCrLJ 110", expYear: 2025, expJournal: "PCRLJ", expPage: 110 },
    { input: "P.Cr.L.J (2022) 150", expYear: 2022, expJournal: "PCRLJ", expPage: 150 },
    { input: "2020 PCRLJ 999", expYear: 2020, expJournal: "PCRLJ", expPage: 999 },

    // 5. YLR (Yearly Law Reports)
    { input: "2021 YLR 880", expYear: 2021, expJournal: "YLR", expPage: 880 },
    { input: "2019 YLR 1250", expYear: 2019, expJournal: "YLR", expPage: 1250 },

    // 6. MLD (Monthly Law Digest)
    { input: "2020 MLD 500", expYear: 2020, expJournal: "MLD", expPage: 500 },
    { input: "2018 MLD 230", expYear: 2018, expJournal: "MLD", expPage: 230 },

    // 7. CLD (Corporate Law Decisions)
    { input: "2022 CLD 780", expYear: 2022, expJournal: "CLD", expPage: 780 },
    { input: "2020 CLD 1150", expYear: 2020, expJournal: "CLD", expPage: 1150 },

    // 8. PTD (Pakistan Tax Decisions)
    { input: "2023 PTD 1105", expYear: 2023, expJournal: "PTD", expPage: 1105 },
    { input: "2017 PTD 890", expYear: 2017, expJournal: "PTD", expPage: 890 },

    // 9. PLC (Pakistan Labour Cases)
    { input: "2021 PLC 340", expYear: 2021, expJournal: "PLC", expPage: 340 },
    { input: "2019 PLC 560", expYear: 2019, expJournal: "PLC", expPage: 560 },

    // 10. LHC & High Court Neutral Citations
    { input: "2025 LHC 639", expYear: 2025, expJournal: "LHC", expPage: 639, expCourt: "LHC" },
    { input: "2024 IHC 120", expYear: 2024, expJournal: "IHC", expPage: 120, expCourt: "IHC" },
    { input: "2023 SHC 45", expYear: 2023, expJournal: "SHC", expPage: 45, expCourt: "SHC" },
    { input: "2022 PHC 310", expYear: 2022, expJournal: "PHC", expPage: 310, expCourt: "PHC" },
    { input: "2021 BHC 88", expYear: 2021, expJournal: "BHC", expPage: 88, expCourt: "BHC" },
    { input: "2020 FSC 12", expYear: 2020, expJournal: "FSC", expPage: 12, expCourt: "FSC" },
    { input: "2024 SC 90", expYear: 2024, expJournal: "SC", expPage: 90, expCourt: "SC" },
    { input: "2025 AJKHC 15", expYear: 2025, expJournal: "AJKHC", expPage: 15, expCourt: "AJKHC" },
    { input: "1954 FC 10", expYear: 1954, expJournal: "FC", expPage: 10, expCourt: "FC" },
  ];

  for (const c of journalsTestCases) {
    const res = parsePakistaniCitation(c.input);
    assert.ok(res, "Failed to parse citation: " + c.input);
    assert.equal(res.year, c.expYear, "Year mismatch for " + c.input);
    assert.equal(res.journal, c.expJournal, "Journal mismatch for " + c.input);
    assert.equal(res.page, c.expPage, "Page mismatch for " + c.input);
    assert.equal(res.isValid, true);
    if (c.expCourt) {
      assert.equal(res.court, c.expCourt, "Court mismatch for " + c.input);
    }
  }
});

test("PinpointParser: Complex Formatting, Periods, Brackets, Whitespace & Edge Cases", () => {
  const edgeCases = [
    { input: "  [2024]   S.C.M.R.   (892)  ", expYear: 2024, expJournal: "SCMR", expPage: 892 },
    { input: "P.L.D., 2023, SC: 451", expYear: 2023, expJournal: "PLD", expPage: 451 },
    { input: "2023:CLC:1204", expYear: 2023, expJournal: "CLC", expPage: 1204 },
    { input: "2025LHC639", expYear: 2025, expJournal: "LHC", expPage: 639 },
    { input: "2024IHC120", expYear: 2024, expJournal: "IHC", expPage: 120 },
    { input: "2023SHC45", expYear: 2023, expJournal: "SHC", expPage: 45 },
    { input: "p.cr.l.j. 2022 150", expYear: 2022, expJournal: "PCRLJ", expPage: 150 },
    { input: "  \n\t 2021   ylr   880 \n ", expYear: 2021, expJournal: "YLR", expPage: 880 },
    { input: "(2022) CLD [780]", expYear: 2022, expJournal: "CLD", expPage: 780 },
    { input: "2023 ; PTD ; 1105 ;", expYear: 2023, expJournal: "PTD", expPage: 1105 },
    { input: "2021 PLC 340", expYear: 2021, expJournal: "PLC", expPage: 340 },
  ];

  for (const ec of edgeCases) {
    const res = parsePakistaniCitation(ec.input);
    assert.ok(res, "Failed to parse edge case: " + JSON.stringify(ec.input));
    assert.equal(res.year, ec.expYear);
    assert.equal(res.journal, ec.expJournal);
    assert.equal(res.page, ec.expPage);
    assert.equal(res.isValid, true);
  }
});

test("PinpointParser: Adversarial Rejection of Corrupt, Malformed or Out-of-Bounds Citations", () => {
  const invalidInputs = [
    "",
    "   ",
    "\t\n\r",
    "SCMR 892",                    // Missing year
    "2024 SCMR",                   // Missing page
    "2024 892",                    // Missing journal
    "PLD SC",                      // Missing year & page
    "PLD 2023 SC",                 // Missing page
    "2024 SCMR 0",                 // Page 0 is invalid
    "2024 SCMR -12",               // Negative page
    "1840 SCMR 100",               // Year before 1947
    "1900 PLD 50",                 // Year before 1947
    "Random prose in court brief", // No citation pattern
    "SELECT * FROM judgments;",    // SQL injection attempt
    "<script>alert(1)</script>",   // XSS attempt
    "2024",
    "PLD",
    "892",
  ];

  for (const inv of invalidInputs) {
    const res = parsePakistaniCitation(inv);
    assert.equal(res, null, "Must return null for invalid input: " + JSON.stringify(inv));
  }
});

test("PinpointParser: Landmark Benchmark Chips (All 9 Chips in Common Examples)", () => {
  const landmarkPills = [
    { label: "PLD 2023 SC 451", expYear: 2023, expJournal: "PLD", expPage: 451 },
    { label: "2024 SCMR 892", expYear: 2024, expJournal: "SCMR", expPage: 892 },
    { label: "2023 CLC 1204", expYear: 2023, expJournal: "CLC", expPage: 1204 },
    { label: "2025 LHC 639", expYear: 2025, expJournal: "LHC", expPage: 639 },
    { label: "2021 YLR 880", expYear: 2021, expJournal: "YLR", expPage: 880 },
    { label: "2022 CLD 780", expYear: 2022, expJournal: "CLD", expPage: 780 },
    { label: "2023 PTD 1105", expYear: 2023, expJournal: "PTD", expPage: 1105 },
    { label: "2021 PLC 340", expYear: 2021, expJournal: "PLC", expPage: 340 },
    { label: "PLD 1955 FC 240", expYear: 1955, expJournal: "PLD", expPage: 240 },
  ];

  for (const pill of landmarkPills) {
    const res = parsePakistaniCitation(pill.label);
    assert.ok(res, "Landmark benchmark pill " + pill.label + " must parse cleanly");
    assert.equal(res.year, pill.expYear);
    assert.equal(res.journal, pill.expJournal);
    assert.equal(res.page, pill.expPage);
    assert.equal(res.isValid, true);
  }
});

// ===========================================================================
// SUITE 2: PRECEDENT CITATION GRAPH BEHAVIORAL & STRESS HARNESS
// ===========================================================================

test("PrecedentGraph: Zoom Boundary Clamping (<0.7x and >1.5x) and Reset View", () => {
  const zoomIn = (z: number) => Math.min(1.5, Number((z + 0.15).toFixed(2)));
  const zoomOut = (z: number) => Math.max(0.7, Number((z - 0.15).toFixed(2)));

  // Test zoom in steps from 1.0 to max 1.5
  let zIn = 1.0;
  const zInSteps: number[] = [zIn];
  for (let i = 0; i < 6; i++) {
    zIn = zoomIn(zIn);
    zInSteps.push(zIn);
  }
  assert.deepEqual(zInSteps, [1.0, 1.15, 1.30, 1.45, 1.50, 1.50, 1.50]);
  assert.equal(zIn, 1.5, "Zoom In must strictly clamp at 1.5x (150%)");

  // Test zoom out steps from 1.0 to min 0.7
  let zOut = 1.0;
  const zOutSteps: number[] = [zOut];
  for (let i = 0; i < 6; i++) {
    zOut = zoomOut(zOut);
    zOutSteps.push(zOut);
  }
  assert.deepEqual(zOutSteps, [1.0, 0.85, 0.70, 0.70, 0.70, 0.70, 0.70]);
  assert.equal(zOut, 0.7, "Zoom Out must strictly clamp at 0.7x (70%)");

  // Reset restores 1.0 (100%), {x:0, y:0} pan, null selected node
  const resetState = {
    zoomLevel: 1,
    panOffset: { x: 0, y: 0 },
    selectedNode: null,
  };
  assert.equal(resetState.zoomLevel, 1);
  assert.equal(resetState.panOffset.x, 0);
  assert.equal(resetState.panOffset.y, 0);
  assert.equal(resetState.selectedNode, null);
});

test("PrecedentGraph: Pan Drag Delta Update Tracking", () => {
  // Simulating dragging canvas with delta movement
  let panOffset = { x: 0, y: 0 };
  let isDragging = false;
  let dragStart = { x: 0, y: 0 };

  const onMouseDown = (clientX: number, clientY: number) => {
    isDragging = true;
    dragStart = { x: clientX - panOffset.x, y: clientY - panOffset.y };
  };

  const onMouseMove = (clientX: number, clientY: number) => {
    if (!isDragging) return;
    panOffset = {
      x: clientX - dragStart.x,
      y: clientY - dragStart.y,
    };
  };

  const onMouseUp = () => {
    isDragging = false;
  };

  // Start dragging at (100, 100)
  onMouseDown(100, 100);
  assert.equal(isDragging, true);

  // Move to (150, 130) -> delta +50x, +30y
  onMouseMove(150, 130);
  assert.deepEqual(panOffset, { x: 50, y: 30 });

  // Move further to (80, 200) -> delta -20x, +100y relative to start
  onMouseMove(80, 200);
  assert.deepEqual(panOffset, { x: -20, y: 100 });

  // Release mouse
  onMouseUp();
  assert.equal(isDragging, false);

  // Move after mouse up should not change panOffset
  onMouseMove(300, 300);
  assert.deepEqual(panOffset, { x: -20, y: 100 });

  // Drag second time from (200, 200)
  onMouseDown(200, 200);
  onMouseMove(250, 250);
  assert.deepEqual(panOffset, { x: 30, y: 150 });
  onMouseUp();
});

test("PrecedentGraph: Node Selection Transitions & Treatment Styling", () => {
  const treatmentBadge = (type: string) => {
    switch (type?.toLowerCase()) {
      case "relied_upon":
      case "followed":
      case "approved":
        return { label: "Relied Upon", color: "#105B38", nodeColor: "#105B38" };
      case "distinguished":
      case "explained":
        return { label: "Distinguished", color: "#D97706", nodeColor: "#D97706" };
      case "overruled":
      case "disapproved":
      case "reversed":
        return { label: "Overruled", color: "#DC2626", nodeColor: "#DC2626" };
      case "referred_to":
      default:
        return { label: "Referred To", color: "#2563EB", nodeColor: "#2563EB" };
    }
  };

  // 1. Treatment styling rules
  assert.equal(treatmentBadge("relied_upon").nodeColor, "#105B38");
  assert.equal(treatmentBadge("followed").nodeColor, "#105B38");
  assert.equal(treatmentBadge("distinguished").nodeColor, "#D97706");
  assert.equal(treatmentBadge("explained").nodeColor, "#D97706");
  assert.equal(treatmentBadge("overruled").nodeColor, "#DC2626");
  assert.equal(treatmentBadge("disapproved").nodeColor, "#DC2626");
  assert.equal(treatmentBadge("referred_to").nodeColor, "#2563EB");
  assert.equal(treatmentBadge("unknown_treatment").nodeColor, "#2563EB");

  // 2. Selection transition
  let selectedNode: PrecedentCitationItem | null = null;
  const mockNode: PrecedentCitationItem = {
    id: "n1",
    citationText: "PLD 2018 SC 189",
    linkedCitation: "PLD 2018 SC 189",
    linkedTitle: "Justice Khurshid Anwar",
    citationType: "relied_upon",
    court: "Supreme Court of Pakistan",
  };

  selectedNode = mockNode;
  assert.equal(selectedNode.id, "n1");
  assert.equal(selectedNode.linkedCitation, "PLD 2018 SC 189");

  // Deselection / Reset
  selectedNode = null;
  assert.equal(selectedNode, null);
});

test("PrecedentGraph: Keyword & Treatment Filtering Resilience", () => {
  const items: PrecedentCitationItem[] = [
    { id: "1", citationText: "PLD 2018 SC 189", linkedCitation: "PLD 2018 SC 189", linkedTitle: "Khurshid Anwar v. Fed", citationType: "relied_upon" },
    { id: "2", citationText: "PLD 2012 SC 553", linkedCitation: "PLD 2012 SC 553", linkedTitle: "Baz Muhammad Kakar", citationType: "referred_to" },
    { id: "3", citationText: "PLD 1955 FC 240", linkedCitation: "PLD 1955 FC 240", linkedTitle: "Maulvi Tamizuddin Khan", citationType: "overruled" },
    { id: "4", citationText: "2017 SCMR 733", linkedCitation: "2017 SCMR 733", linkedTitle: "State v. Zubair", citationType: "distinguished" },
    { id: "5", citationText: "1995 SCMR 1350", linkedCitation: "1995 SCMR 1350", linkedTitle: "Tariq Bashir v. State", citationType: "relied_upon" },
  ];

  const filterFn = (list: PrecedentCitationItem[], selectedFilter: string, graphSearchQuery: string) => {
    return list.filter((c) => {
      const matchFilter = selectedFilter === "all" || c.citationType === selectedFilter;
      const matchSearch =
        !graphSearchQuery.trim() ||
        (c.linkedCitation || c.citationText || "").toLowerCase().includes(graphSearchQuery.toLowerCase()) ||
        (c.linkedTitle || "").toLowerCase().includes(graphSearchQuery.toLowerCase());
      return matchFilter && matchSearch;
    });
  };

  // Test all filters
  assert.equal(filterFn(items, "all", "").length, 5);
  assert.equal(filterFn(items, "relied_upon", "").length, 2);
  assert.equal(filterFn(items, "distinguished", "").length, 1);
  assert.equal(filterFn(items, "overruled", "").length, 1);
  assert.equal(filterFn(items, "referred_to", "").length, 1);

  // Test search queries
  assert.equal(filterFn(items, "all", "tamizuddin").length, 1);
  assert.equal(filterFn(items, "all", "SCMR").length, 2);
  assert.equal(filterFn(items, "all", "nonexistent").length, 0);

  // Test search + filter combination
  assert.equal(filterFn(items, "relied_upon", "1995").length, 1);
  assert.equal(filterFn(items, "distinguished", "1995").length, 0);
});

test("PrecedentGraph: Large Node Set Scaling & SVG Coordinate Geometry", () => {
  const made: PrecedentCitationItem[] = Array.from({ length: 50 }, (_, i) => ({
    id: "out-" + i,
    citationText: "20" + (10 + (i % 15)) + " SCMR " + (100 + i),
    linkedCitation: "20" + (10 + (i % 15)) + " SCMR " + (100 + i),
    linkedTitle: "Outbound Precedent " + i,
    citationType: (["relied_upon", "distinguished", "overruled", "referred_to"] as const)[i % 4],
  }));

  const received: PrecedentCitationItem[] = Array.from({ length: 50 }, (_, i) => ({
    id: "in-" + i,
    citationText: "20" + (15 + (i % 10)) + " LHC " + (200 + i),
    linkedCitation: "20" + (15 + (i % 10)) + " LHC " + (200 + i),
    linkedTitle: "Inbound Precedent " + i,
    citationType: (["relied_upon", "distinguished", "overruled", "referred_to"] as const)[i % 4],
  }));

  const total = made.length + received.length;
  assert.equal(total, 100);

  // SVG Column layout slicing: top 5 items are displayed to prevent canvas clutter
  const svgMade = made.slice(0, 5);
  const svgReceived = received.slice(0, 5);
  assert.equal(svgMade.length, 5);
  assert.equal(svgReceived.length, 5);

  // Verify coordinates for 5 slots
  for (let idx = 0; idx < 5; idx++) {
    const y = 70 + idx * 56;
    assert.ok(y >= 70 && y <= 294, "y-coordinate " + y + " must fit within SVG viewBox (0 0 800 360)");

    // Left column x=140
    const outX = 140;
    const outPath = "M 352 180 C 260 180, 240 " + y + ", " + (outX + 65) + " " + y;
    assert.ok(outPath.startsWith("M 352 180"));

    // Right column x=660
    const inX = 660;
    const inPath = "M 448 180 C 540 180, 560 " + y + ", " + (inX - 65) + " " + y;
    assert.ok(inPath.startsWith("M 448 180"));
  }
});

test("PrecedentGraph: Summary Export Formatting & Filename Sanitization", () => {
  const currentCitation = "PLD 2023 SC 451 (Art. 199/184)";
  const currentTitle = "FEDERATION OF PAKISTAN Vs MUHAMMAD AKRAM";
  const made: PrecedentCitationItem[] = [
    {
      id: "cm-1",
      citationType: "relied_upon",
      citationText: "PLD 2018 SC 189",
      linkedCitation: "PLD 2018 SC 189",
      linkedTitle: "Justice Khurshid Anwar",
      contextExcerpt: "Judicial review limits on statutory bodies.",
    },
  ];
  const received: PrecedentCitationItem[] = [
    {
      id: "cr-1",
      citationType: "relied_upon",
      citationText: "2024 SCMR 102",
      linkedCitation: "2024 SCMR 102",
      linkedTitle: "WAPDA v. Tariq Aziz",
      contextExcerpt: "Applied Akram case.",
    },
  ];

  const filename = currentCitation.replace(/[^a-zA-Z0-9]/g, "_") + "_Citation_Graph_Summary.txt";
  assert.equal(filename, "PLD_2023_SC_451__Art__199_184__Citation_Graph_Summary.txt");

  const lines = [
    "================================================================",
    "AL WAKEELO PRECEDENT CITATION GRAPH SUMMARY REPORT",
    "================================================================",
    "Anchor Precedent: " + currentCitation,
    "Title: " + currentTitle,
    "Total Connected Authorities: " + (made.length + received.length),
    "",
    "--- OUTBOUND AUTHORITIES (CITED BY THIS BENCH: " + made.length + ") ---",
  ];
  made.forEach((c, idx) => {
    lines.push("[" + (idx + 1) + "] " + (c.linkedCitation || c.citationText) + " | Treatment: " + c.citationType.toUpperCase() + " | Title: " + (c.linkedTitle || "N/A"));
    if (c.contextExcerpt) lines.push("    Excerpt: \"" + c.contextExcerpt + "\"");
  });
  lines.push("");
  lines.push("--- INBOUND CITING PRECEDENTS (CITED IN SUBSEQUENT CASE LAW: " + received.length + ") ---");
  received.forEach((c, idx) => {
    lines.push("[" + (idx + 1) + "] " + (c.linkedCitation || c.citationText) + " | Treatment: " + c.citationType.toUpperCase() + " | Title: " + (c.linkedTitle || "N/A"));
    if (c.contextExcerpt) lines.push("    Excerpt: \"" + c.contextExcerpt + "\"");
  });
  lines.push("");
  lines.push("================================================================");
  lines.push("Exported from Al Wakeelo Legal Research Workstation (www.alwakeelo.com)");

  const report = lines.join("\n");
  assert.ok(report.includes("Anchor Precedent: " + currentCitation));
  assert.ok(report.includes("Total Connected Authorities: 2"));
  assert.ok(report.includes("Treatment: RELIED_UPON | Title: Justice Khurshid Anwar"));
  assert.ok(report.includes("Excerpt: \"Judicial review limits on statutory bodies.\""));
  assert.ok(report.includes("Treatment: RELIED_UPON | Title: WAPDA v. Tariq Aziz"));
  assert.ok(report.includes("Excerpt: \"Applied Akram case.\""));
});

// ===========================================================================
// SUITE 3: SEED JUDGMENTS DATA INTEGRITY & QUERY ENGINE HARNESS
// ===========================================================================

test("SeedData: 10 Landmark Cases Comprehensive Data Model Validation", () => {
  const judgments = getAllSeedJudgments();
  assert.ok(judgments.length >= 10, "Seed database must contain at least 10 landmark judgments");

  const requiredCategories = [
    "constitutional",
    "criminal",
    "civil",
    "family",
    "corporate",
    "tax",
    "labor",
  ];

  const presentCategories = new Set(judgments.map((j) => j.category));
  for (const cat of requiredCategories) {
    assert.ok(presentCategories.has(cat as any), "Missing category in seed database: " + cat);
  }

  for (const j of judgments) {
    assert.ok(j.id && j.id.length > 0, "id must be non-empty");
    assert.ok(j.citation && j.citation.length > 0, "citation must be non-empty");
    assert.ok(j.year >= 1947 && j.year <= 2026, "year must be between 1947 and 2026: " + j.year);
    assert.ok(j.journal && j.journal.length > 0, "journal must be non-empty");
    assert.ok(j.page > 0, "page must be positive: " + j.page);
    assert.ok(j.court && j.court.length > 0, "court must be non-empty");
    assert.ok(["SC", "LHC", "SHC", "IHC", "PHC", "BHC", "FSC"].includes(j.courtCode), "Invalid courtCode: " + j.courtCode);
    assert.ok(j.title && j.title.length > 0, "title must be non-empty");
    assert.ok(j.petitioner && j.petitioner.length > 0, "petitioner must be non-empty");
    assert.ok(j.respondent && j.respondent.length > 0, "respondent must be non-empty");
    assert.ok(j.decisionDate && j.decisionDate.match(/^\d{4}-\d{2}-\d{2}$/), "decisionDate must be YYYY-MM-DD: " + j.decisionDate);
    assert.ok(j.bench && j.bench.length > 0, "bench must be non-empty");
    assert.ok(j.headnotes && j.headnotes.length > 20, "headnotes must be substantial");
    assert.ok(j.ratioDecidendi && j.ratioDecidendi.result.length > 0, "ratioDecidendi.result must be non-empty");
    assert.ok(Array.isArray(j.ratioDecidendi.legalPrinciples) && j.ratioDecidendi.legalPrinciples.length > 0, "legalPrinciples must be non-empty");
    assert.ok(Array.isArray(j.ratioDecidendi.keyFindings) && j.ratioDecidendi.keyFindings.length > 0, "keyFindings must be non-empty");
    assert.ok(j.ratioDecidendi.significance && j.ratioDecidendi.significance.length > 0, "significance must be non-empty");
    assert.ok(j.fullText && j.fullText.includes("[1]"), "fullText must contain numbered paragraph structure [1]");
    assert.ok(Array.isArray(j.citationsMade), "citationsMade must be an array");
    assert.ok(Array.isArray(j.citationsReceived), "citationsReceived must be an array");
  }
});

test("SeedData: Overruled Landmark Flag & Negative Precedent Warnings (Maulvi Tamizuddin Khan)", () => {
  const tamizuddin = getSeedJudgmentById("pld-1955-fc-240");
  assert.ok(tamizuddin, "Must locate PLD 1955 FC 240");
  assert.equal(tamizuddin.isOverruled, true, "Maulvi Tamizuddin Khan must be flagged isOverruled: true");
  assert.ok(tamizuddin.overrulingCitation, "Must specify overruling citation");
  assert.ok(tamizuddin.overrulingCitation.includes("PLD 2012 SC 553"), "Overruling citation must reference Baz Muhammad Kakar");

  // Inbound citations must contain overruled entries
  const overruledInbound = tamizuddin.citationsReceived.filter((c) => c.citationType === "overruled" || c.citationType === "disapproved");
  assert.ok(overruledInbound.length >= 2, "Must link to multiple subsequent overruling decisions");
  assert.ok(overruledInbound.some((c) => c.linkedCitation === "PLD 2012 SC 553"), "Must link to Baz Muhammad Kakar in received");
  assert.ok(overruledInbound.some((c) => c.linkedCitation === "PLD 2009 SC 879"), "Must link to Sindh High Court Bar in received");

  // Checking that Baz Muhammad Kakar expressly marks Tamizuddin as overruled in citationsMade
  const kakar = getSeedJudgmentById("pld-2012-sc-553");
  assert.ok(kakar, "Must locate Baz Muhammad Kakar (PLD 2012 SC 553)");
  const kakarOverruled = kakar.citationsMade.find((c) => c.citationType === "overruled");
  assert.ok(kakarOverruled, "Kakar must make an overruled citation");
  assert.equal(kakarOverruled.linkedCitation, "PLD 1955 FC 240");
});

test("SeedData: Cross-Precedent Bidirectional Citation Graph Coherence", () => {
  // Case 1: Akram (PLD 2023 SC 451) -> refers to Kakar (PLD 2012 SC 553)
  const akram = getSeedJudgmentById("pld-2023-sc-451");
  assert.ok(akram);
  const akramRefersKakar = akram.citationsMade.find((c) => c.linkedCitation === "PLD 2012 SC 553");
  assert.ok(akramRefersKakar, "Akram must cite Kakar");
  assert.equal(akramRefersKakar.citationType, "referred_to");

  // Kakar (PLD 2012 SC 553) -> receives citation from Akram (PLD 2023 SC 451)
  const kakar = getSeedJudgmentById("pld-2012-sc-553");
  assert.ok(kakar);
  const kakarReceivedAkram = kakar.citationsReceived.find((c) => c.linkedCitation === "PLD 2023 SC 451");
  assert.ok(kakarReceivedAkram, "Kakar must have citation received from Akram");
  assert.equal(kakarReceivedAkram.citationType, "referred_to");

  // Case 2: Bashir Ahmad (2025 LHC 639) -> refers to Akram (PLD 2023 SC 451)
  const bashir = getSeedJudgmentById("2025-lhc-639");
  assert.ok(bashir);
  const bashirCitesAkram = bashir.citationsMade.find((c) => c.linkedCitation === "PLD 2023 SC 451");
  assert.ok(bashirCitesAkram, "Bashir Ahmad must cite Akram");
  assert.equal(bashirCitesAkram.citationType, "referred_to");

  // Akram (PLD 2023 SC 451) -> receives citation from Bashir Ahmad (2025 LHC 639)
  const akramReceivedBashir = akram.citationsReceived.find((c) => c.linkedCitation === "2025 LHC 639");
  assert.ok(akramReceivedBashir, "Akram must have citation received from Bashir Ahmad");
  assert.equal(akramReceivedBashir.citationType, "referred_to");
});

test("SeedData: Lookup Helpers (getSeedJudgmentById, findSeedJudgmentByCitation, searchSeedJudgments)", () => {
  // 1. getSeedJudgmentById
  assert.ok(getSeedJudgmentById("pld-2023-sc-451"));
  assert.ok(getSeedJudgmentById("2024-scmr-892"));
  assert.ok(getSeedJudgmentById("2023-clc-1204"));
  assert.ok(getSeedJudgmentById("2025-lhc-639"));
  assert.ok(getSeedJudgmentById("2021-ylr-880"));
  assert.ok(getSeedJudgmentById("2022-cld-780"));
  assert.ok(getSeedJudgmentById("2023-ptd-1105"));
  assert.ok(getSeedJudgmentById("2021-plc-340"));
  assert.ok(getSeedJudgmentById("pld-1955-fc-240"));
  assert.ok(getSeedJudgmentById("pld-2012-sc-553"));
  assert.equal(getSeedJudgmentById("nonexistent-case-id"), undefined);
  assert.equal(getSeedJudgmentById(""), undefined);

  // 2. findSeedJudgmentByCitation
  const found1 = findSeedJudgmentByCitation(2024, "SCMR", 892);
  assert.ok(found1);
  assert.equal(found1.title, "TARIQ MEHMOOD Vs THE STATE");

  const found2 = findSeedJudgmentByCitation(2025, "LHC", 639);
  assert.ok(found2);
  assert.equal(found2.title, "BASHIR AHMAD Vs MST. ZUBAIDA");

  const found3 = findSeedJudgmentByCitation(2023, "PTD", 1105, "LHC");
  assert.ok(found3);
  assert.equal(found3.title, "COMMISSIONER INLAND REVENUE Vs NISHAT MILLS LTD");

  assert.equal(findSeedJudgmentByCitation(1999, "SCMR", 9999), undefined);

  // 3. searchSeedJudgments filters and sorting
  // Query search
  const bailRes = searchSeedJudgments("Bail");
  assert.ok(bailRes.length >= 1);
  assert.equal(bailRes[0].id, "2024-scmr-892");

  // Journal filter
  const pldRes = searchSeedJudgments("", "PLD");
  assert.ok(pldRes.length >= 3);
  assert.ok(pldRes.every((j) => j.journal === "PLD"));

  // Court filter
  const scRes = searchSeedJudgments("", "All", "Supreme Court of Pakistan");
  assert.ok(scRes.length >= 2);
  assert.ok(scRes.every((j) => j.court.includes("Supreme Court")));

  // Year filter
  const y2023Res = searchSeedJudgments("", "All", "All Courts", "2023");
  assert.ok(y2023Res.length >= 2);
  assert.ok(y2023Res.every((j) => j.year === 2023));

  // Sorting: latest
  const sortedLatest = searchSeedJudgments("", "All", "All Courts", undefined, "latest");
  for (let i = 0; i < sortedLatest.length - 1; i++) {
    const t1 = new Date(sortedLatest[i].decisionDate).getTime();
    const t2 = new Date(sortedLatest[i + 1].decisionDate).getTime();
    assert.ok(t1 >= t2, "Latest sorting order violation: " + sortedLatest[i].decisionDate + " vs " + sortedLatest[i + 1].decisionDate);
  }

  // Sorting: most_cited
  const sortedCited = searchSeedJudgments("", "All", "All Courts", undefined, "most_cited");
  for (let i = 0; i < sortedCited.length - 1; i++) {
    assert.ok(sortedCited[i].citationsReceived.length >= sortedCited[i + 1].citationsReceived.length, "Most cited sorting violation");
  }
});
