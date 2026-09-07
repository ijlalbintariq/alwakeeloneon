import test from "node:test";
import assert from "node:assert/strict";
import {
  STATUTE_DOMAINS,
  STATUTE_SECTIONS,
  LIMITATION_SCHEDULE_ENTRIES,
  PROVINCIAL_COURT_FEE_RULES,
  PAKISTAN_COURT_DIRECTORY,
  computeLimitationDeadline,
  calculateProvincialCourtFee,
  searchStatuteSections,
  searchCourts,
  formatLegalCitation,
  formatDraftingClause,
  getStatuteSectionById,
  type StatuteSection,
  type CourtFeeProvince
} from "../../client/src/experimental/data/statutesCompendiumData.js";
import { plainTextToTiptapHTML, isHTMLContent, parseInlineFormatting } from "../../client/src/experimental/lib/plain-to-tiptap.js";
import { searchSeedJudgments, SEED_JUDGMENTS } from "../../client/src/experimental/data/seedJudgmentsData.js";

// ============================================================================
// SUITE 1: STATUTE CLAUSE FORMATTING & TIPTAP HTML CONVERSION (ALL 40+ SECTIONS)
// ============================================================================

test("Adversarial: All statutory provisions produce valid formatted drafting clauses without corruption", () => {
  assert.ok(STATUTE_SECTIONS.length >= 40, "Must have at least 40 statutory sections in compendium");

  for (const section of STATUTE_SECTIONS) {
    const clause = formatDraftingClause(section);

    // 1. Completeness & integrity checks
    assert.ok(clause.length > 50, `Clause for ${section.id} must have substantive content`);
    assert.ok(!clause.includes("undefined"), `Clause for ${section.id} must not contain "undefined"`);
    assert.ok(!clause.includes("null"), `Clause for ${section.id} must not contain "null"`);
    assert.ok(!clause.includes("[object Object]"), `Clause for ${section.id} must not contain "[object Object]"`);

    // 2. Essential structural markers
    assert.ok(
      clause.includes("STATUTORY PROVISION & RELEVANT LAW:"),
      `Clause for ${section.id} must contain statutory provision heading`
    );
    assert.ok(
      clause.includes(section.sectionNumber),
      `Clause for ${section.id} must include section number ${section.sectionNumber}`
    );
    assert.ok(
      clause.includes(section.statuteName),
      `Clause for ${section.id} must include statute name ${section.statuteName}`
    );
    assert.ok(
      clause.includes("LEGAL GROUNDS & APPLICABLE PRINCIPLES:"),
      `Clause for ${section.id} must contain legal grounds heading`
    );

    // 3. Tiptap HTML conversion
    const tiptapHtml = plainTextToTiptapHTML(clause);
    assert.ok(tiptapHtml.length > 0, `Tiptap HTML for ${section.id} must not be empty`);
    assert.ok(isHTMLContent(tiptapHtml), `Output for ${section.id} must be recognized as valid HTML content`);
    assert.ok(
      tiptapHtml.startsWith("<p") || tiptapHtml.startsWith("<h") || tiptapHtml.startsWith("<div"),
      `Tiptap HTML for ${section.id} must start with an appropriate HTML tag`
    );

    // Verify no unclosed basic tags
    const openP = (tiptapHtml.match(/<p[\s>]/g) || []).length;
    const closeP = (tiptapHtml.match(/<\/p>/g) || []).length;
    assert.equal(openP, closeP, `P tag balance in HTML for ${section.id}: open=${openP}, close=${closeP}`);

    const openH2 = (tiptapHtml.match(/<h2[\s>]/g) || []).length;
    const closeH2 = (tiptapHtml.match(/<\/h2>/g) || []).length;
    assert.equal(openH2, closeH2, `H2 tag balance in HTML for ${section.id}: open=${openH2}, close=${closeH2}`);

    const openStrong = (tiptapHtml.match(/<strong[\s>]/g) || []).length;
    const closeStrong = (tiptapHtml.match(/<\/strong>/g) || []).length;
    assert.equal(openStrong, closeStrong, `Strong tag balance in HTML for ${section.id}: open=${openStrong}, close=${closeStrong}`);
  }
});

// ============================================================================
// SUITE 2: INCOMING CLAUSE INGESTION HANDLER SIMULATION (PREVIEWDRAFTING.TSX)
// ============================================================================

test("Adversarial: PreviewDrafting incoming clause parser handles corrupted and edge-case payloads safely", () => {
  // Simulate the parsing logic in PreviewDrafting.tsx:
  function simulateIncomingIngestion(rawStorageValue: string | null) {
    if (!rawStorageValue) return { handled: false, reason: "empty_or_null" };
    let data: any;
    try {
      data = JSON.parse(rawStorageValue);
    } catch {
      return { handled: false, reason: "invalid_json" };
    }
    if (!data || typeof data !== "object" || !data.clause) {
      return { handled: false, reason: "missing_clause" };
    }

    const clauseHtml = plainTextToTiptapHTML(data.clause);
    const toastDescription = data.title
      ? `Affixed ${data.statute || ""} ${data.section || ""}: "${data.title}" into drafting canvas.`
      : "Statutory clause inserted into drafting canvas.";

    return {
      handled: true,
      clauseHtml,
      toastDescription,
      title: data.title,
      statute: data.statute,
      section: data.section
    };
  }

  // Case 1: null / empty
  assert.equal(simulateIncomingIngestion(null).handled, false);
  assert.equal(simulateIncomingIngestion("").handled, false);

  // Case 2: Malformed JSON
  assert.equal(simulateIncomingIngestion("{ bad json :").handled, false);
  assert.equal(simulateIncomingIngestion("undefined").handled, false);

  // Case 3: JSON primitive or array without clause property
  assert.equal(simulateIncomingIngestion("12345").handled, false);
  assert.equal(simulateIncomingIngestion('"string only"').handled, false);
  assert.equal(simulateIncomingIngestion("[]").handled, false);
  assert.equal(simulateIncomingIngestion('{"statute":"CPC"}').handled, false);

  // Case 4: Valid payload from compendium
  const cpcSec = getStatuteSectionById("cpc-o7-r11")!;
  const validPayload = JSON.stringify({
    statute: cpcSec.statuteName,
    section: cpcSec.sectionNumber,
    title: cpcSec.title,
    clause: formatDraftingClause(cpcSec),
    timestamp: Date.now()
  });
  const validResult = simulateIncomingIngestion(validPayload);
  assert.equal(validResult.handled, true);
  assert.ok(validResult.clauseHtml!.includes("Order VII Rule 11"));
  assert.ok(validResult.toastDescription!.includes("Rejection of Plaint"));

  // Case 5: Payload with missing optional fields (no title, no statute, no section)
  const minimalPayload = JSON.stringify({
    clause: "Simple statutory legal clause for testing."
  });
  const minResult = simulateIncomingIngestion(minimalPayload);
  assert.equal(minResult.handled, true);
  assert.equal(minResult.toastDescription, "Statutory clause inserted into drafting canvas.");

  // Case 6: Adversarial XSS & Script Injection in clause
  const xssPayload = JSON.stringify({
    statute: "<script>alert('xss')</script>",
    section: "<img src=x onerror=alert(1)>",
    title: "XSS Title <svg onload=alert(2)>",
    clause: "LEGAL PROVISION:\n<script>evilCode()</script>\n<iframe src='javascript:alert(1)'></iframe>\nSection 123.",
    timestamp: Date.now()
  });
  const xssResult = simulateIncomingIngestion(xssPayload);
  assert.equal(xssResult.handled, true);
  // Script and iframe tags must be safely escaped by plainTextToTiptapHTML
  assert.ok(!xssResult.clauseHtml!.includes("<script>evilCode()</script>"));
  assert.ok(xssResult.clauseHtml!.includes("&lt;script&gt;evilCode()&lt;/script&gt;"));
  assert.ok(!xssResult.clauseHtml!.includes("<iframe"));
  assert.ok(xssResult.clauseHtml!.includes("&lt;iframe"));

  // Case 7: Urdu text and complex Unicode characters
  const urduPayload = JSON.stringify({
    statute: "قانونِ شہادت آرڈر 1984",
    section: "آرٹیکل 164",
    title: "برقی شہادت کا ثبوت",
    clause: "STATUTORY PROVISION:\nقانونِ شہادت آرڈر 1984 کے تحت جدید آلات سے حاصل شدہ مواد بطور شہادت قابلِ قبول ہے۔",
    timestamp: Date.now()
  });
  const urduResult = simulateIncomingIngestion(urduPayload);
  assert.equal(urduResult.handled, true);
  assert.ok(urduResult.clauseHtml!.includes("قانونِ شہادت"));
  assert.ok(urduResult.toastDescription!.includes("برقی شہادت کا ثبوت"));
});

// ============================================================================
// SUITE 3: PREVIEWJUDGMENTS DEEP LINK QUERY HANDLER & PRECEDENT SEARCH
// ============================================================================

test("Adversarial: PreviewJudgments deep link URL query parameter handler correctly parses and queries", () => {
  // Test deep-link URL construction from LegalReferenceModal
  for (const section of STATUTE_SECTIONS) {
    const rawQuery = `${section.statuteName} ${section.sectionNumber}`;
    const encodedUrl = `/preview/judgments?q=${encodeURIComponent(rawQuery)}`;

    // Simulate URL parsing as done in PreviewJudgments.tsx (new URLSearchParams(window.location.search).get("q"))
    const urlObj = new URL(`http://localhost${encodedUrl}`);
    const parsedQ = urlObj.searchParams.get("q");

    assert.equal(parsedQ, rawQuery, `Deep link URL decoding must exactly recover original query for ${section.id}`);
    assert.ok(parsedQ!.length > 0);

    // Test seed judgment search execution with this query
    const seedResults = searchSeedJudgments(parsedQ!, "All", "All Courts", "All Years", "relevance");
    assert.ok(Array.isArray(seedResults), `searchSeedJudgments must return an array for query "${parsedQ}"`);

    // Verify seed search results data integrity if matches found
    for (const match of seedResults) {
      assert.ok(match.citation && match.citation.length > 0, "Seed match must have citation");
      assert.ok(match.court && match.court.length > 0, "Seed match must have court");
      assert.ok(match.title && match.title.length > 0, "Seed match must have title");
      assert.ok(match.headnotes && match.headnotes.length > 0, "Seed match must have headnotes");
      assert.ok(typeof match.year === "number" && match.year > 1900, "Seed match must have valid year");
    }
  }
});

test("Adversarial: Precedent search handles special characters and symbols in query string without error", () => {
  const specialQueries = [
    "Order VII R.11",
    "Order XXXIX R.1-2",
    "Section 22-A / 22-B",
    "Section 489-F",
    "Article 184(3) & 185",
    "Articles 9-25A",
    "Section 73 & 74",
    "Section 54, 58, 105",
    "Section 17 & 49",
    "PLD 2021 SC 429",
    "1998 SCMR 2268",
    "2022 SCMR 1891",
    "PLD 2013 SC 793",
    "PLD 2011 SC 997",
    "\"Specific Performance\"",
    "rejection of plaint OR dishonour of cheque",
    "'; DROP TABLE judgments; --",
    "<script>alert('search')</script>",
    "   ",
    "",
    "A".repeat(500)
  ];

  for (const q of specialQueries) {
    assert.doesNotThrow(() => {
      const results = searchSeedJudgments(q, "All", "All Courts", "All Years", "relevance");
      assert.ok(Array.isArray(results));
    }, `Query "${q}" must not throw exception in searchSeedJudgments`);
  }
});

// ============================================================================
// SUITE 4: CLIPBOARD CITATION FORMATTING INTEGRITY ACROSS ALL SECTIONS
// ============================================================================

test("Adversarial: Clipboard citation formatters produce full uncorrupted legal text for every statute section", () => {
  for (const section of STATUTE_SECTIONS) {
    const formatted = formatLegalCitation(section);

    // 1. Mandatory sections in citation
    assert.ok(formatted.includes(section.statuteName), `Citation must include statute name for ${section.id}`);
    assert.ok(formatted.includes(section.sectionNumber), `Citation must include section number for ${section.id}`);
    assert.ok(formatted.includes(section.title), `Citation must include title for ${section.id}`);
    assert.ok(formatted.includes(section.text), `Citation must include full verbatim text for ${section.id}`);
    assert.ok(
      formatted.includes("Legislative Commentary & Procedural Ingredients:"),
      `Citation must include commentary header for ${section.id}`
    );
    assert.ok(formatted.includes(section.commentary), `Citation must include commentary for ${section.id}`);

    // 2. Precedent check
    if (section.landmarkCitations.length > 0) {
      assert.ok(formatted.includes("Leading Precedent:"), `Citation must include leading precedent for ${section.id}`);
      assert.ok(
        formatted.includes(section.landmarkCitations[0].citation),
        `Citation must include landmark citation for ${section.id}`
      );
      assert.ok(
        formatted.includes(section.landmarkCitations[0].title),
        `Citation must include landmark case title for ${section.id}`
      );
      assert.ok(
        formatted.includes(section.landmarkCitations[0].ratio),
        `Citation must include landmark ratio for ${section.id}`
      );
    }

    // 3. No corrupted interpolation artifacts
    assert.ok(!formatted.includes("undefined"), `No undefined in citation for ${section.id}`);
    assert.ok(!formatted.includes("null"), `No null in citation for ${section.id}`);
    assert.ok(!formatted.includes("[object Object]"), `No [object Object] in citation for ${section.id}`);
  }
});

// ============================================================================
// SUITE 5: COMPREHENSIVE STRESS TESTING & FUZZING ON DATA HELPERS
// ============================================================================

test("Adversarial: searchStatuteSections handles extreme query strings and domain filters", () => {
  // Extreme inputs
  const fuzzInputs = [
    "",
    "   ",
    "\t\n\r",
    "a".repeat(10000), // Huge string
    "([{\\^$|?*+.",   // Regex metacharacters
    "<script>alert(1)</script>",
    "SELECT * FROM statutes WHERE 1=1;",
    "ORDER VII RULE 11", // Uppercase
    "order vii rule 11", // Lowercase
    "OrDeR ViI RuLe 11", // Mixed case
    "قانون",            // Non-ASCII
    "489-f",
    "489f",
    "489 - F"
  ];

  for (const input of fuzzInputs) {
    assert.doesNotThrow(() => {
      const results = searchStatuteSections(input, "all");
      assert.ok(Array.isArray(results));
    }, `Fuzz input "${input.slice(0, 30)}" must not throw`);
  }

  // Domain filtering combinations
  for (const domain of STATUTE_DOMAINS) {
    const domainResults = searchStatuteSections("", domain.id);
    assert.ok(domainResults.length > 0, `Domain ${domain.id} must have sections`);
    assert.ok(
      domainResults.every((s) => s.domain === domain.id),
      `Every section returned for domain ${domain.id} must match domain`
    );
  }
});

test("Adversarial: computeLimitationDeadline handles date boundaries, leap years, and extreme dates", () => {
  const sampleEntry = LIMITATION_SCHEDULE_ENTRIES[0];

  // 1. Leap year Feb 29
  const leapDay = new Date(2024, 1, 29); // Feb 29, 2024
  const leapResult = computeLimitationDeadline(sampleEntry, leapDay, true);
  assert.ok(!isNaN(leapResult.rawDeadline.getTime()), "Leap year date calculation must produce valid Date");
  assert.ok(!isNaN(leapResult.adjustedDeadline.getTime()), "Adjusted deadline must be valid Date");

  // 2. Year-end rollover (Dec 31)
  const dec31 = new Date(2025, 11, 31);
  const decResult = computeLimitationDeadline(sampleEntry, dec31, true);
  assert.ok(decResult.rawDeadline.getFullYear() >= 2026, "Year-end addition must roll year correctly");

  // 3. Far past date (1900)
  const pastDate = new Date(1900, 0, 1);
  const pastResult = computeLimitationDeadline(sampleEntry, pastDate, true);
  assert.equal(pastResult.isBarred, true);
  assert.ok(pastResult.daysRemaining < 0);
  assert.ok(pastResult.daysRemainingLabel.includes("past limitation bar") || pastResult.isBarred);

  // 4. Far future date (2099)
  const futureDate = new Date(2099, 0, 1);
  const futureResult = computeLimitationDeadline(sampleEntry, futureDate, true);
  assert.equal(futureResult.isBarred, false);
  assert.ok(futureResult.daysRemaining > 0);
});

test("Adversarial: calculateProvincialCourtFee handles extreme pecuniary valuations and boundary edge cases", () => {
  const provinces: CourtFeeProvince[] = ["punjab", "sindh", "islamabad", "kpk", "balochistan"];
  const testValuations = [
    -500,               // Negative valuation -> clamps to 0
    0,                  // 0 valuation -> exempt
    1,                  // 1 PKR -> exempt
    24999,              // 24,999 PKR -> exempt
    25000,              // 25,000 PKR -> exactly at threshold -> exempt
    25001,              // 25,001 PKR -> 1 PKR above threshold -> ad valorem applies
    100000,             // 100k PKR -> 7.5k PKR
    5000000,            // 5M PKR -> capped at 15k
    64999999,           // 64.99M PKR (Sindh: District Court, capped at 15k)
    65000000,           // 65M PKR (Sindh: District Court boundary)
    65000001,           // 65.000001M PKR (Sindh: High Court Original Side, capped at 50k)
    100000000,          // 100M PKR (Sindh: High Court Original Side, capped at 50k)
    Number.MAX_SAFE_INTEGER // Extreme valuation
  ];

  for (const province of provinces) {
    for (const val of testValuations) {
      assert.doesNotThrow(() => {
        const res = calculateProvincialCourtFee(province, "recovery_money", val);
        assert.ok(typeof res.fee === "number");
        assert.ok(res.fee >= 0, `Fee must be non-negative for ${province} with val ${val}`);
        assert.ok(typeof res.explanation === "string" && res.explanation.length > 0);
        assert.ok(typeof res.pecuniaryCourt === "string" && res.pecuniaryCourt.length > 0);
        assert.ok(typeof res.statutoryReference === "string" && res.statutoryReference.length > 0);

        if (val <= 25000 && val >= 0) {
          assert.equal(res.fee, 0, `Valuation ${val} must be exempt`);
          assert.equal(res.isExempt, true);
        }

        if (province === "sindh" && val > 65000000) {
          assert.equal(res.capAmount, 50000, "Sindh High Court Original Side cap must be 50,000");
          assert.equal(res.fee, 50000);
          assert.equal(res.isCapped, true);
        } else if (val >= 5000000) {
          assert.equal(res.capAmount, 15000, `${province} standard cap must be 15,000`);
          assert.equal(res.fee, 15000);
          assert.equal(res.isCapped, true);
        }
      }, `calculateProvincialCourtFee failed for ${province} with val ${val}`);
    }
  }
});

test("Adversarial: searchCourts handles fuzzy search, tier filters, and complex queries", () => {
  // Test all tiers
  const allTiers = ["all", "apex", "high_courts", "tribunals", "district"] as const;
  for (const tier of allTiers) {
    const courts = searchCourts("", tier);
    assert.ok(Array.isArray(courts));
    if (tier !== "all") {
      assert.ok(courts.every((c) => c.tier === tier));
    }
  }

  // Test bench queries
  const lhcMultan = searchCourts("Multan");
  assert.ok(lhcMultan.some((c) => c.name.includes("Multan") || c.benches?.includes("Multan Bench")));

  const shcSukkur = searchCourts("Sukkur");
  assert.ok(shcSukkur.some((c) => c.name.includes("Sukkur") || c.benches?.includes("Sukkur Bench")));

  const specialTribunal = searchCourts("Accountability");
  assert.ok(specialTribunal.some((c) => c.tier === "tribunals"));
});
