/**
 * Comprehensive Empirical Adversarial Challenger Test Suite for Milestone 1
 * Pakistani Statutes & Major Codes Compendium (Legal Data Engine)
 * 
 * Target: client/src/experimental/data/statutesCompendiumData.ts
 * 
 * Run with: node --import tsx --test tests/adversarial-challenger-m1-statutes.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

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
  formatDraftingClause,
  type StatuteDomain,
  type CourtFeeProvince,
  type CourtHierarchyTier,
  type LimitationEntry
} from "../client/src/experimental/data/statutesCompendiumData.js";

describe("Adversarial Suite 1: Invariant & Structural Integrity Checks", () => {
  it("STATUTE_DOMAINS: Exactly 7 major Pakistani legal domains with full metadata", () => {
    assert.equal(STATUTE_DOMAINS.length, 7);
    const expectedDomains: StatuteDomain[] = [
      "civil", "criminal", "constitutional", "commercial", "evidence", "family", "special"
    ];
    for (const d of expectedDomains) {
      const match = STATUTE_DOMAINS.find(item => item.id === d);
      assert.ok(match, `Missing domain metadata: ${d}`);
      assert.ok(match.label.length > 0);
      assert.ok(match.description.length > 0);
      assert.ok(match.featuredStatutes.length > 0);
    }
  });

  it("STATUTE_SECTIONS: All 42+ sections have valid fields, non-empty text, commentary, and citations", () => {
    assert.ok(STATUTE_SECTIONS.length >= 42, `Expected at least 42 sections, found ${STATUTE_SECTIONS.length}`);

    const ids = new Set<string>();
    for (const section of STATUTE_SECTIONS) {
      assert.ok(section.id, "Section must have an ID");
      assert.ok(!ids.has(section.id), `Duplicate section ID detected: ${section.id}`);
      ids.add(section.id);

      assert.ok(section.sectionNumber && section.sectionNumber.trim().length > 0, `Section ${section.id} missing sectionNumber`);
      assert.ok(section.title && section.title.trim().length > 0, `Section ${section.id} missing title`);
      assert.ok(section.statuteName && section.statuteName.trim().length > 0, `Section ${section.id} missing statuteName`);
      assert.ok(section.text && section.text.trim().length > 0, `Section ${section.id} missing text`);
      assert.ok(section.commentary && section.commentary.trim().length > 0, `Section ${section.id} missing commentary`);
      assert.ok(Array.isArray(section.keywords) && section.keywords.length > 0, `Section ${section.id} has empty keywords`);
      assert.ok(Array.isArray(section.landmarkCitations) && section.landmarkCitations.length > 0, `Section ${section.id} has no citations`);

      for (const cit of section.landmarkCitations) {
        assert.ok(cit.citation && cit.citation.trim().length > 0, `Citation missing text in ${section.id}`);
        assert.ok(cit.court && cit.court.trim().length > 0, `Court missing in citation ${cit.citation}`);
        assert.ok(cit.year >= 1947 && cit.year <= 2030, `Year invalid in citation ${cit.citation}: ${cit.year}`);
        assert.ok(cit.ratio && cit.ratio.trim().length > 0, `Ratio missing in citation ${cit.citation}`);
      }
    }
  });

  it("LIMITATION_SCHEDULE_ENTRIES: All 35+ entries have valid units, positive periods, and statutory refs", () => {
    assert.ok(LIMITATION_SCHEDULE_ENTRIES.length >= 35, `Expected at least 35 entries, found ${LIMITATION_SCHEDULE_ENTRIES.length}`);
    const validUnits = ["days", "months", "years"];

    for (const entry of LIMITATION_SCHEDULE_ENTRIES) {
      assert.ok(entry.article && entry.article.trim().length > 0, `Missing article: ${JSON.stringify(entry)}`);
      assert.ok(entry.title && entry.title.trim().length > 0, `Missing title for ${entry.article}`);
      assert.ok(entry.periodValue > 0, `Invalid periodValue for ${entry.article}: ${entry.periodValue}`);
      assert.ok(validUnits.includes(entry.periodUnit), `Invalid periodUnit for ${entry.article}: ${entry.periodUnit}`);
      assert.ok(entry.triggerEvent && entry.triggerEvent.trim().length > 0, `Missing triggerEvent for ${entry.article}`);
      assert.ok(entry.statutoryRef && entry.statutoryRef.trim().length > 0, `Missing statutoryRef for ${entry.article}`);
    }
  });

  it("PAKISTAN_COURT_DIRECTORY: Complete 4-tier hierarchy across all provinces and special tribunals", () => {
    assert.ok(PAKISTAN_COURT_DIRECTORY.length >= 40, `Expected at least 40 court records, found ${PAKISTAN_COURT_DIRECTORY.length}`);
    const tiers: CourtHierarchyTier[] = ["apex", "high_courts", "tribunals", "district"];
    for (const tier of tiers) {
      const courtsInTier = PAKISTAN_COURT_DIRECTORY.filter(c => c.tier === tier);
      assert.ok(courtsInTier.length > 0, `Tier ${tier} has no court entries`);
    }

    const lhc = PAKISTAN_COURT_DIRECTORY.find(c => c.id === "court-lhc-principal");
    const shc = PAKISTAN_COURT_DIRECTORY.find(c => c.id === "court-shc-principal");
    const ihc = PAKISTAN_COURT_DIRECTORY.find(c => c.id === "court-ihc");
    const phc = PAKISTAN_COURT_DIRECTORY.find(c => c.id === "court-phc-principal");
    const bhc = PAKISTAN_COURT_DIRECTORY.find(c => c.id === "court-bhc-principal");
    assert.ok(lhc && shc && ihc && phc && bhc, "All 5 High Court principal seats must exist");
  });
});

describe("Adversarial Suite 2: Limitation Deadline Calculations & Weekend Rollover", () => {
  const dummyEntryDays: LimitationEntry = {
    article: "Art. Test Days",
    title: "Test Days Limitation",
    description: "Testing day periods",
    periodText: "10 days",
    periodDays: 10,
    periodUnit: "days",
    periodValue: 10,
    triggerEvent: "Test event",
    category: "Suits",
    statutoryRef: "Limitation Act 1908"
  };

  it("Sunday deadline rolls over to Monday (+1 day)", () => {
    // 2026-05-01 (Friday) + 2 days = 2026-05-03 (Sunday) -> Rolls to 2026-05-04 (Monday)
    const entry: LimitationEntry = { ...dummyEntryDays, periodValue: 2 };
    const accrual = new Date(2026, 4, 1);
    const res = computeLimitationDeadline(entry, accrual, true);

    assert.equal(res.rawDeadline.getDay(), 0);
    assert.equal(res.rawDeadline.getDate(), 3);
    assert.equal(res.adjustedDeadline.getDay(), 1);
    assert.equal(res.adjustedDeadline.getDate(), 4);
    assert.equal(res.isWeekendRollover, true);
    assert.ok(res.statutoryNote.includes("Sunday"));
  });

  it("Saturday deadline rolls over to Monday (+2 days)", () => {
    // 2026-05-01 (Friday) + 1 day = 2026-05-02 (Saturday) -> Rolls to 2026-05-04 (Monday)
    const entry: LimitationEntry = { ...dummyEntryDays, periodValue: 1 };
    const accrual = new Date(2026, 4, 1);
    const res = computeLimitationDeadline(entry, accrual, true);

    assert.equal(res.rawDeadline.getDay(), 6);
    assert.equal(res.rawDeadline.getDate(), 2);
    assert.equal(res.adjustedDeadline.getDay(), 1);
    assert.equal(res.adjustedDeadline.getDate(), 4);
    assert.equal(res.isWeekendRollover, true);
    assert.ok(res.statutoryNote.includes("Saturday"));
  });

  it("Friday deadline does NOT roll over", () => {
    // 2026-05-04 (Monday) + 4 days = 2026-05-08 (Friday)
    const entry: LimitationEntry = { ...dummyEntryDays, periodValue: 4 };
    const accrual = new Date(2026, 4, 4);
    const res = computeLimitationDeadline(entry, accrual, true);

    assert.equal(res.rawDeadline.getDay(), 5);
    assert.equal(res.adjustedDeadline.getDay(), 5);
    assert.equal(res.isWeekendRollover, false);
  });

  it("All weekdays (Monday through Friday) remain exact without rollover", () => {
    for (let dayOffset = 0; dayOffset <= 4; dayOffset++) {
      // 2026-05-04 is Monday
      const entry: LimitationEntry = { ...dummyEntryDays, periodValue: dayOffset };
      const accrual = new Date(2026, 4, 4);
      const res = computeLimitationDeadline(entry, accrual, true);
      assert.equal(res.rawDeadline.getDay(), 1 + dayOffset);
      assert.equal(res.adjustedDeadline.getDay(), 1 + dayOffset);
      assert.equal(res.isWeekendRollover, false);
    }
  });

  it("Section 4 disabled flag preserves raw Saturday and Sunday deadlines", () => {
    const accrual = new Date(2026, 4, 1); // Friday
    const satRes = computeLimitationDeadline({ ...dummyEntryDays, periodValue: 1 }, accrual, false);
    assert.equal(satRes.adjustedDeadline.getDay(), 6);
    assert.equal(satRes.isWeekendRollover, false);

    const sunRes = computeLimitationDeadline({ ...dummyEntryDays, periodValue: 2 }, accrual, false);
    assert.equal(sunRes.adjustedDeadline.getDay(), 0);
    assert.equal(sunRes.isWeekendRollover, false);
  });

  it("Leap year handling: Feb 28 -> Feb 29 (leap year 2024) vs Feb 28 -> Mar 1 (non-leap 2025)", () => {
    const entry1Day: LimitationEntry = { ...dummyEntryDays, periodValue: 1 };
    
    // Leap year 2024
    const feb28_2024 = new Date(2024, 1, 28);
    const resLeap = computeLimitationDeadline(entry1Day, feb28_2024, false);
    assert.equal(resLeap.rawDeadline.getDate(), 29);
    assert.equal(resLeap.rawDeadline.getMonth(), 1);

    // Non-leap year 2025
    const feb28_2025 = new Date(2025, 1, 28);
    const resNonLeap = computeLimitationDeadline(entry1Day, feb28_2025, false);
    assert.equal(resNonLeap.rawDeadline.getDate(), 1);
    assert.equal(resNonLeap.rawDeadline.getMonth(), 2);
  });

  it("Month boundary handling: 30 days addition vs 1 month addition", () => {
    const may1 = new Date(2026, 4, 1);
    const res30Days = computeLimitationDeadline({ ...dummyEntryDays, periodValue: 30 }, may1, false);
    assert.equal(res30Days.rawDeadline.getMonth(), 4); // May
    assert.equal(res30Days.rawDeadline.getDate(), 31); // 31st

    const res1Month = computeLimitationDeadline({
      ...dummyEntryDays,
      periodUnit: "months",
      periodValue: 1
    }, may1, false);
    assert.equal(res1Month.rawDeadline.getMonth(), 5); // June
    assert.equal(res1Month.rawDeadline.getDate(), 1);  // 1st
  });

  it("Edge cases: Invalid date string, empty string, malformed objects", () => {
    const resInvalid = computeLimitationDeadline(dummyEntryDays, "invalid-date-string", true);
    assert.equal(resInvalid.statutoryNote, "Invalid accrual date provided.");
    assert.equal(resInvalid.daysRemainingLabel, "Invalid date");
    assert.equal(resInvalid.isWeekendRollover, false);

    const resEmpty = computeLimitationDeadline(dummyEntryDays, "", true);
    assert.equal(resEmpty.statutoryNote, "Invalid accrual date provided.");
  });

  it("Full schedule sweep: Every limitation entry computes without throwing or returning NaN", () => {
    const sampleDates = [
      new Date(2026, 0, 1),
      new Date(2026, 1, 28),
      new Date(2026, 4, 1),
      new Date(2024, 1, 29)
    ];

    for (const entry of LIMITATION_SCHEDULE_ENTRIES) {
      for (const d of sampleDates) {
        const res = computeLimitationDeadline(entry, d, true);
        assert.ok(!isNaN(res.rawDeadline.getTime()));
        assert.ok(!isNaN(res.adjustedDeadline.getTime()));
        assert.ok(res.adjustedDeadline.getDay() !== 0, `Adjusted deadline fell on Sunday for ${entry.article}`);
        assert.ok(res.adjustedDeadline.getDay() !== 6, `Adjusted deadline fell on Saturday for ${entry.article}`);
      }
    }
  });
});

describe("Adversarial Suite 3: Provincial Court Fee & Pecuniary Engine", () => {
  const provinces: CourtFeeProvince[] = ["punjab", "sindh", "islamabad", "kpk", "balochistan"];

  it("Exemption boundary: <= 25,000 is EXEMPT (PKR 0), > 25,000 is CHARGED (7.5%)", () => {
    for (const p of provinces) {
      const res0 = calculateProvincialCourtFee(p, "recovery_money", 0);
      assert.equal(res0.fee, 0);
      assert.equal(res0.isExempt, true);

      const res25k = calculateProvincialCourtFee(p, "recovery_money", 25000);
      assert.equal(res25k.fee, 0);
      assert.equal(res25k.isExempt, true);

      const res25001 = calculateProvincialCourtFee(p, "recovery_money", 25001);
      assert.equal(res25001.fee, 1875);
      assert.equal(res25001.isExempt, false);
    }
  });

  it("General Fee Cap: PKR 15,000 maximum ceiling across standard jurisdictions", () => {
    const standardProvinces: CourtFeeProvince[] = ["punjab", "islamabad", "kpk", "balochistan"];
    const testValuations = [200020, 500000, 1000000, 10000000, 100000000];

    for (const p of standardProvinces) {
      for (const val of testValuations) {
        const res = calculateProvincialCourtFee(p, "recovery_money", val);
        assert.equal(res.fee, 15000);
        assert.equal(res.isCapped, true);
        assert.equal(res.capAmount, 15000);
      }
    }
  });

  it("Sindh Pecuniary Dual-Cap: <= 65M capped at 15,000 vs > 65M (SHC Original Side) capped at 50,000", () => {
    // 65M in Sindh -> 15,000
    const sindh65M = calculateProvincialCourtFee("sindh", "recovery_money", 65000000);
    assert.equal(sindh65M.fee, 15000);
    assert.equal(sindh65M.isCapped, true);
    assert.equal(sindh65M.capAmount, 15000);
    assert.ok(sindh65M.pecuniaryCourt.includes("Senior Civil Judge"));

    // 65,000,001 in Sindh -> 50,000
    const sindhAbove65M = calculateProvincialCourtFee("sindh", "recovery_money", 65000001);
    assert.equal(sindhAbove65M.fee, 50000);
    assert.equal(sindhAbove65M.isCapped, true);
    assert.equal(sindhAbove65M.capAmount, 50000);
    assert.ok(sindhAbove65M.pecuniaryCourt.includes("Sindh High Court (Original Side"));

    // 500M in Sindh vs Punjab
    const sindh500M = calculateProvincialCourtFee("sindh", "recovery_money", 500000000);
    assert.equal(sindh500M.fee, 50000);
    const punjab500M = calculateProvincialCourtFee("punjab", "recovery_money", 500000000);
    assert.equal(punjab500M.fee, 15000);
  });

  it("Fixed fee suits remain constant regardless of suit valuation", () => {
    const fixedSuits = [
      { id: "constitutional_writ", expected: 500 },
      { id: "permanent_injunction", expected: 500 },
      { id: "declaration_pure", expected: 500 },
      { id: "family_suit", expected: 500 },
      { id: "arbitration_objection", expected: 500 },
      { id: "execution_petition", expected: 50 },
      { id: "bail_criminal_petition", expected: 100 },
      { id: "vakalatnama_stamp", expected: 30 }
    ];

    for (const suit of fixedSuits) {
      for (const p of provinces) {
        const res = calculateProvincialCourtFee(p, suit.id, 10000000);
        assert.equal(res.fee, suit.expected, `Fee mismatch for ${suit.id} in ${p}`);
        assert.equal(res.effectiveRate, "Fixed");
      }
    }
  });

  it("Percentage Capped Suits (Civil Revision): 3.75% capped at 7,500", () => {
    for (const p of provinces) {
      const resExempt = calculateProvincialCourtFee(p, "civil_revision", 20000);
      assert.equal(resExempt.fee, 0);
      assert.equal(resExempt.isExempt, true);

      const resMid = calculateProvincialCourtFee(p, "civil_revision", 100000);
      assert.equal(resMid.fee, 3750);
      assert.equal(resMid.isCapped, false);

      const resCapped = calculateProvincialCourtFee(p, "civil_revision", 500000);
      assert.equal(resCapped.fee, 7500);
      assert.equal(resCapped.isCapped, true);
    }
  });

  it("Negative, zero, and NaN valuations safely fallback to zero/exempt", () => {
    for (const p of provinces) {
      const neg = calculateProvincialCourtFee(p, "recovery_money", -1000);
      assert.equal(neg.fee, 0);
      assert.equal(neg.isExempt, true);

      const nan = calculateProvincialCourtFee(p, "recovery_money", NaN);
      assert.equal(nan.fee, 0);
      assert.equal(nan.isExempt, true);
    }
  });
});

describe("Adversarial Suite 4: Search & Retrieval Helper Functions", () => {
  it("searchStatuteSections: Matches keyword, section number, title, text, and landmark citation", () => {
    // 1. By section number
    const bySec = searchStatuteSections("Order VII Rule 11");
    assert.ok(bySec.some(s => s.id === "cpc-o7-r11"));

    // 2. By section hyphenated keyword
    const byKey = searchStatuteSections("489-F");
    assert.ok(byKey.some(s => s.id === "ppc-sec-489f"));

    // 3. By phrase in text
    const byText = searchStatuteSections("dishonestly issuing a cheque");
    assert.ok(byText.some(s => s.id === "ppc-sec-489f"));

    // 4. By landmark precedent citation
    const byCit = searchStatuteSections("PLD 2021 SC 429");
    assert.ok(byCit.length > 0);
    assert.ok(byCit.some(s => s.id === "sra-sec-24c" || s.id === "cpc-o7-r11"));

    // 5. Non-matching query
    const nonMatch = searchStatuteSections("xyznonexistentterm9999");
    assert.equal(nonMatch.length, 0);
  });

  it("searchStatuteSections: Domain isolation and complete domain coverage", () => {
    const domains: StatuteDomain[] = ["civil", "criminal", "constitutional", "commercial", "evidence", "family", "special"];
    for (const d of domains) {
      const res = searchStatuteSections("", d);
      assert.ok(res.length > 0, `Domain ${d} returned 0 results`);
      assert.ok(res.every(s => s.domain === d), `Domain filter ${d} leaked cross-domain items`);
    }
  });

  it("searchCourts: Geographical city and hierarchy tier search", () => {
    const cities = ["Lahore", "Karachi", "Islamabad", "Peshawar", "Quetta", "Rawalpindi", "Multan", "Bahawalpur", "Sukkur"];
    for (const city of cities) {
      const res = searchCourts(city);
      assert.ok(res.length > 0, `searchCourts failed for city: ${city}`);
    }

    const tiers: CourtHierarchyTier[] = ["apex", "high_courts", "tribunals", "district"];
    for (const tier of tiers) {
      const res = searchCourts("", tier);
      assert.ok(res.length > 0, `searchCourts failed for tier: ${tier}`);
      assert.ok(res.every(c => c.tier === tier));
    }
  });

  it("getLimitationArticlesByCategory: Filters existing categories properly and handles 'all'", () => {
    const all = getLimitationArticlesByCategory("all");
    assert.equal(all.length, LIMITATION_SCHEDULE_ENTRIES.length);

    const existingCategories = ["Suits", "Appeals", "Applications", "Reviews", "Execution"];
    for (const cat of existingCategories) {
      const res = getLimitationArticlesByCategory(cat);
      assert.ok(res.length > 0, `Category ${cat} returned 0 entries`);
      assert.ok(res.every(e => e.category.toLowerCase() === cat.toLowerCase()));
    }
  });

  it("formatLegalCitation & formatDraftingClause produce well-structured output", () => {
    const cpc = getStatuteSectionById("cpc-o7-r11");
    assert.ok(cpc);
    const citationStr = formatLegalCitation(cpc);
    assert.ok(citationStr.includes("Code of Civil Procedure, 1908"));
    assert.ok(citationStr.includes("Order VII Rule 11"));
    assert.ok(citationStr.includes("Leading Precedent:"));

    const clauseStr = formatDraftingClause(cpc);
    assert.ok(clauseStr.includes("STATUTORY PROVISION & RELEVANT LAW:"));
    assert.ok(clauseStr.includes("Pursuant to Order VII Rule 11 of the Code of Civil Procedure, 1908"));
    assert.ok(clauseStr.includes("LEGAL GROUNDS & APPLICABLE PRINCIPLES:"));
  });
});
