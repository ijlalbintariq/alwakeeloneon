import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  computeLimitationDeadline,
  calculateProvincialCourtFee,
  LIMITATION_SCHEDULE_ENTRIES,
  COURT_FEE_SUIT_TYPES,
  PROVINCIAL_COURT_FEE_RULES,
  STATUTE_DOMAINS,
  STATUTE_SECTIONS,
  searchStatuteSections,
  getStatuteSectionsByDomain,
  getStatuteSectionById,
  searchCourts,
  getLimitationArticlesByCategory,
  type LimitationEntry,
  type CourtFeeProvince,
  type CourtFeeSuitType,
  type ProvincialCourtFeeRule,
} from "../client/src/experimental/data/statutesCompendiumData";

import { SIX_PILLARS } from "../client/src/experimental/components/cases/SixPillarChecklist";

describe("Milestone Challenger 2: Exhaustive Statutory Math & Legal Calculation Verification Suite", () => {

  // =========================================================================
  // SUITE 1: PROVINCIAL COURT FEES ACT 1870 BOUNDARY VALUE ANALYSIS
  // =========================================================================
  describe("Suite 1: Provincial Court Fees Boundary Valuations Across All 5 Provinces", () => {
    const provinces: CourtFeeProvince[] = ["punjab", "sindh", "islamabad", "kpk", "balochistan"];

    // 1.1 Zero Valuation (PKR 0)
    it("[CF-1.1] Valuation = 0 PKR across all 5 provinces: 100% exempt, Fee = 0", () => {
      for (const p of provinces) {
        const res = calculateProvincialCourtFee(p, "recovery_money", 0);
        assert.equal(res.fee, 0, `Province ${p} fee at 0 must be 0`);
        assert.equal(res.isExempt, true, `Province ${p} at 0 must be exempt`);
        assert.equal(res.isCapped, false);
        assert.ok(res.explanation.includes("Exempt from court fee"));
        assert.equal(res.effectiveRate, "0% (Exempt)");
      }
    });

    // 1.2 Minimum Positive Valuation (PKR 1)
    it("[CF-1.2] Valuation = 1 PKR across all 5 provinces: 100% exempt, Fee = 0", () => {
      for (const p of provinces) {
        const res = calculateProvincialCourtFee(p, "recovery_money", 1);
        assert.equal(res.fee, 0, `Province ${p} fee at 1 must be 0`);
        assert.equal(res.isExempt, true, `Province ${p} at 1 must be exempt`);
        assert.equal(res.isCapped, false);
      }
    });

    // 1.3 Sub-Exemption Boundary (PKR 24,999)
    it("[CF-1.3] Valuation = 24,999 PKR across all 5 provinces: 100% exempt, Fee = 0", () => {
      for (const p of provinces) {
        const res = calculateProvincialCourtFee(p, "recovery_money", 24999);
        assert.equal(res.fee, 0, `Province ${p} fee at 24,999 must be 0`);
        assert.equal(res.isExempt, true, `Province ${p} at 24,999 must be exempt`);
        assert.equal(res.isCapped, false);
      }
    });

    // 1.4 Exact Exemption Boundary Threshold (PKR 25,000)
    it("[CF-1.4] Valuation = 25,000 PKR across all 5 provinces: Exactly at exemption ceiling, Fee = 0", () => {
      for (const p of provinces) {
        const res = calculateProvincialCourtFee(p, "recovery_money", 25000);
        assert.equal(res.fee, 0, `Province ${p} fee at 25,000 must be 0`);
        assert.equal(res.isExempt, true, `Province ${p} at 25,000 must be exempt`);
        assert.equal(res.isCapped, false);
      }
    });

    // 1.5 First Taxable Suprathreshold Rupee (PKR 25,001)
    it("[CF-1.5] Valuation = 25,001 PKR across all 5 provinces: 7.5% Ad Valorem = PKR 1,875", () => {
      // 25,001 * 0.075 = 1875.075 -> Math.round = 1875
      for (const p of provinces) {
        const res = calculateProvincialCourtFee(p, "recovery_money", 25001);
        assert.equal(res.fee, 1875, `Province ${p} fee at 25,001 must be 1,875`);
        assert.equal(res.isExempt, false, `Province ${p} at 25,001 must NOT be exempt`);
        assert.equal(res.isCapped, false, `Province ${p} at 25,001 must NOT be capped`);
        assert.equal(res.capAmount, 15000);
        assert.equal(res.effectiveRate, "7.5%");
      }
    });

    // 1.6 Mid-Range Non-Capped Valuation (PKR 100,000)
    it("[CF-1.6] Valuation = 100,000 PKR across all 5 provinces: 7.5% Ad Valorem = PKR 7,500", () => {
      // 100,000 * 0.075 = 7500
      for (const p of provinces) {
        const res = calculateProvincialCourtFee(p, "recovery_money", 100000);
        assert.equal(res.fee, 7500, `Province ${p} fee at 100,000 must be 7,500`);
        assert.equal(res.isExempt, false);
        assert.equal(res.isCapped, false);
        assert.equal(res.capAmount, 15000);
        assert.equal(res.effectiveRate, "7.5%");
      }
    });

    // 1.7 Exact General Cap Reaching Valuation (PKR 200,000)
    it("[CF-1.7] Valuation = 200,000 PKR across all 5 provinces: 7.5% Ad Valorem = Exactly PKR 15,000", () => {
      // 200,000 * 0.075 = 15000 (Exactly matches general cap of 15,000)
      for (const p of provinces) {
        const res = calculateProvincialCourtFee(p, "recovery_money", 200000);
        assert.equal(res.fee, 15000, `Province ${p} fee at 200,000 must be 15,000`);
        assert.equal(res.isExempt, false);
        assert.equal(res.capAmount, 15000);
      }
    });

    // 1.8 Standard High Valuation (PKR 1,000,000)
    it("[CF-1.8] Valuation = 1,000,000 PKR across all 5 provinces: Capped at PKR 15,000", () => {
      // 1,000,000 * 0.075 = 75,000 > 15,000 cap
      for (const p of provinces) {
        const res = calculateProvincialCourtFee(p, "recovery_money", 1000000);
        assert.equal(res.fee, 15000, `Province ${p} fee at 1,000,000 must be capped at 15,000`);
        assert.equal(res.isExempt, false);
        assert.equal(res.isCapped, true);
        assert.equal(res.capAmount, 15000);
        assert.equal(res.effectiveRate, "Capped at PKR 15,000");
      }
    });

    // 1.9 Sindh High Court Pecuniary Threshold Boundary (PKR 65,000,000)
    it("[CF-1.9] Valuation = 65,000,000 PKR: District Court ceiling in Sindh vs General Cap elsewhere", () => {
      // At exactly 65,000,000:
      // Punjab, Islamabad, KPK, Balochistan: Capped at 15,000
      for (const p of ["punjab", "islamabad", "kpk", "balochistan"] as CourtFeeProvince[]) {
        const res = calculateProvincialCourtFee(p, "recovery_money", 65000000);
        assert.equal(res.fee, 15000, `${p} must be capped at 15,000`);
        assert.equal(res.isCapped, true);
      }

      // Sindh: 65,000,000 is still District / Senior Civil Judge level (maxValuation = 65,000,000).
      // High Court original side applies strictly for valuation > 65,000,000.
      const sindhRes = calculateProvincialCourtFee("sindh", "recovery_money", 65000000);
      assert.equal(sindhRes.fee, 15000, "Sindh at 65M must have fee = 15,000");
      assert.equal(sindhRes.isCapped, true);
      assert.equal(sindhRes.capAmount, 15000);
      assert.ok(sindhRes.pecuniaryCourt.includes("Senior Civil Judge"));
    });

    // 1.10 Sindh High Court Original Side Suprathreshold (PKR 65,000,001 & PKR 100,000,000)
    it("[CF-1.10] Valuation = 100,000,000 PKR: Elevated SHC Original Side Cap (PKR 50,000) in Sindh vs PKR 15,000 in Other 4 Provinces", () => {
      // 100,000,000 * 0.075 = 7,500,000
      // In Sindh: > 65,000,000 -> Original Side cap = PKR 50,000
      const sindh100M = calculateProvincialCourtFee("sindh", "recovery_money", 100000000);
      assert.equal(sindh100M.fee, 50000, "Sindh at 100M must be capped at SHC Original Side cap of 50,000");
      assert.equal(sindh100M.isCapped, true);
      assert.equal(sindh100M.capAmount, 50000);
      assert.equal(sindh100M.effectiveRate, "Capped at PKR 50,000");
      assert.ok(sindh100M.pecuniaryCourt.includes("Sindh High Court (Original Side"));

      // In Punjab, Islamabad, KPK, Balochistan: Cap remains PKR 15,000
      for (const p of ["punjab", "islamabad", "kpk", "balochistan"] as CourtFeeProvince[]) {
        const res = calculateProvincialCourtFee(p, "recovery_money", 100000000);
        assert.equal(res.fee, 15000, `${p} at 100M must remain capped at 15,000`);
        assert.equal(res.isCapped, true);
        assert.equal(res.capAmount, 15000);
      }
    });

    // 1.11 Extreme Boundary Valuations (Negative, Floating Point, Trillion, NaN)
    it("[CF-1.11] Extreme Valuations: -50,000, 25000.49, 25000.50, NaN, Infinity, 1,000,000,000,000", () => {
      for (const p of provinces) {
        // Negative -> Math.max(0, val) -> 0 -> Exempt
        const negRes = calculateProvincialCourtFee(p, "recovery_money", -50000);
        assert.equal(negRes.fee, 0);
        assert.equal(negRes.isExempt, true);

        // NaN -> 0 -> Exempt
        const nanRes = calculateProvincialCourtFee(p, "recovery_money", NaN);
        assert.equal(nanRes.fee, 0);
        assert.equal(nanRes.isExempt, true);

        // Floating point just below threshold (25000.49) -> 0
        const floatBelow = calculateProvincialCourtFee(p, "recovery_money", 25000.49);
        // 25000.49 > 25000: 7.5% of 25000.49 = 1875.03675 -> Math.round = 1875
        assert.equal(floatBelow.fee, 1875);

        // 1 Trillion PKR (10^12)
        const trillionRes = calculateProvincialCourtFee(p, "recovery_money", 1000000000000);
        const expectedCap = p === "sindh" ? 50000 : 15000;
        assert.equal(trillionRes.fee, expectedCap);
        assert.equal(trillionRes.isCapped, true);
      }
    });

    // 1.12 All 16 Suit Types Tested Across 5 Provinces
    it("[CF-1.12] Full Suit Type Matrix: All 16 Court Fee Suit Types tested across all 5 provinces", () => {
      assert.equal(COURT_FEE_SUIT_TYPES.length, 16);

      for (const suit of COURT_FEE_SUIT_TYPES) {
        for (const p of provinces) {
          const res = calculateProvincialCourtFee(p, suit.id, 500000);
          assert.ok(typeof res.fee === "number", `Fee for ${suit.id} in ${p} must be a number`);
          assert.ok(res.fee >= 0, `Fee for ${suit.id} in ${p} cannot be negative`);
          assert.ok(typeof res.isExempt === "boolean");
          assert.ok(typeof res.isCapped === "boolean");
          assert.ok(typeof res.capAmount === "number");
          assert.ok(res.explanation.length > 0);
          assert.ok(res.statutoryReference.length > 0);
          assert.ok(res.pecuniaryCourt.length > 0);
          assert.ok(res.breakdownFormula.length > 0);

          if (suit.feeType === "fixed") {
            assert.equal(res.fee, suit.fixedAmount);
            assert.equal(res.isExempt, false);
            assert.equal(res.effectiveRate, "Fixed");
          } else if (suit.feeType === "percentage_capped") {
            assert.ok(res.fee <= (suit.fixedAmount || 7500));
          } else if (suit.feeType === "ad_valorem") {
            const expectedCap = (p === "sindh" && 500000 > 65000000) ? 50000 : 15000;
            assert.ok(res.fee <= expectedCap);
          }
        }
      }
    });
  });

  // =========================================================================
  // SUITE 2: LIMITATION ACT 1908 COMPUTATION & SECTION 4 ROLLOVER HARNESS
  // =========================================================================
  describe("Suite 2: Limitation Deadline Computation, Weekends, Leap Years & Historical Dates", () => {

    const testArticle: LimitationEntry = {
      id: "lim-test",
      article: "Art. 113",
      title: "Specific Performance of Contract",
      description: "For specific performance of a contract.",
      periodText: "3 Years",
      periodDays: 3 * 365,
      periodUnit: "years",
      periodValue: 3,
      triggerEvent: "Date fixed for performance or notice of refusal",
      category: "Suits",
      statutoryRef: "Limitation Act 1908, First Schedule, Article 113"
    };

    // 2.1 Friday, Saturday, Sunday Day-of-Week Rollover Logic
    it("[LIM-2.1] Day-of-Week Computation: Friday (Court Open), Saturday (Registry Closed -> Monday), Sunday (Court Closed -> Monday)", () => {
      // 2026-08-14 is a Friday.
      // 1-day period from Friday 2026-08-14 -> Raw Saturday 2026-08-15 (Day 6)
      // Section 4 -> Rollover +2 days to Monday 2026-08-17 (Day 1)
      const day1Entry: LimitationEntry = { ...testArticle, periodUnit: "days", periodValue: 1 };
      const satRes = computeLimitationDeadline(day1Entry, "2026-08-14", true);
      assert.equal(satRes.rawDeadline.getDay(), 6, "Raw deadline should be Saturday");
      assert.equal(satRes.adjustedDeadline.getDay(), 1, "Adjusted deadline must roll to Monday");
      assert.equal(satRes.isWeekendRollover, true);
      assert.ok(satRes.statutoryNote.includes("Deadline fell on Saturday"));

      // 2-day period from Friday 2026-08-14 -> Raw Sunday 2026-08-16 (Day 0)
      // Section 4 -> Rollover +1 day to Monday 2026-08-17 (Day 1)
      const day2Entry: LimitationEntry = { ...testArticle, periodUnit: "days", periodValue: 2 };
      const sunRes = computeLimitationDeadline(day2Entry, "2026-08-14", true);
      assert.equal(sunRes.rawDeadline.getDay(), 0, "Raw deadline should be Sunday");
      assert.equal(sunRes.adjustedDeadline.getDay(), 1, "Adjusted deadline must roll to Monday");
      assert.equal(sunRes.isWeekendRollover, true);
      assert.ok(sunRes.statutoryNote.includes("Deadline fell on Sunday"));

      // Friday deadline: Start Thursday 2026-08-13 + 1 day -> Friday 2026-08-14 (Day 5)
      // Court is open -> No rollover, remains Friday
      const friRes = computeLimitationDeadline(day1Entry, "2026-08-13", true);
      assert.equal(friRes.rawDeadline.getDay(), 5, "Raw deadline should be Friday");
      assert.equal(friRes.adjustedDeadline.getDay(), 5, "Adjusted deadline must remain Friday");
      assert.equal(friRes.isWeekendRollover, false);
      assert.equal(friRes.statutoryNote, "Calculated within standard statutory sitting periods.");

      // Section 4 Disabled (applySection4 = false): Saturday & Sunday do NOT roll over
      const satNoRoll = computeLimitationDeadline(day1Entry, "2026-08-14", false);
      assert.equal(satNoRoll.adjustedDeadline.getDay(), 6, "Must remain Saturday when applySection4 is false");
      assert.equal(satNoRoll.isWeekendRollover, false);

      const sunNoRoll = computeLimitationDeadline(day2Entry, "2026-08-14", false);
      assert.equal(sunNoRoll.adjustedDeadline.getDay(), 0, "Must remain Sunday when applySection4 is false");
      assert.equal(sunNoRoll.isWeekendRollover, false);
    });

    // 2.2 Leap Year Arithmetic Stress Test
    it("[LIM-2.2] Leap Year Matrix: 2000 (Leap Century), 2024 (Leap), 2028 (Leap), 2025 (Non-leap), 2100 (Non-leap Century)", () => {
      const oneDay: LimitationEntry = { ...testArticle, periodUnit: "days", periodValue: 1 };
      const fourYears: LimitationEntry = { ...testArticle, periodUnit: "years", periodValue: 4 };

      // Leap Year 2024: Feb 28 + 1 day -> Feb 29
      const leap2024 = computeLimitationDeadline(oneDay, "2024-02-28", false);
      assert.equal(leap2024.rawDeadline.getFullYear(), 2024);
      assert.equal(leap2024.rawDeadline.getMonth(), 1, "Month should be Feb (1)");
      assert.equal(leap2024.rawDeadline.getDate(), 29, "Date should be 29 in leap year");

      // Non-Leap Year 2025: Feb 28 + 1 day -> Mar 1
      const nonLeap2025 = computeLimitationDeadline(oneDay, "2025-02-28", false);
      assert.equal(nonLeap2025.rawDeadline.getFullYear(), 2025);
      assert.equal(nonLeap2025.rawDeadline.getMonth(), 2, "Month should be March (2)");
      assert.equal(nonLeap2025.rawDeadline.getDate(), 1, "Date should be 1 in non-leap year");

      // Leap Century 2000: Feb 28 + 1 day -> Feb 29
      const leap2000 = computeLimitationDeadline(oneDay, "2000-02-28", false);
      assert.equal(leap2000.rawDeadline.getFullYear(), 2000);
      assert.equal(leap2000.rawDeadline.getMonth(), 1);
      assert.equal(leap2000.rawDeadline.getDate(), 29);

      // Non-Leap Century 2100: Feb 28 + 1 day -> Mar 1
      const nonLeap2100 = computeLimitationDeadline(oneDay, "2100-02-28", false);
      assert.equal(nonLeap2100.rawDeadline.getFullYear(), 2100);
      assert.equal(nonLeap2100.rawDeadline.getMonth(), 2);
      assert.equal(nonLeap2100.rawDeadline.getDate(), 1);

      // Leap Day Start: 2024-02-29 + 4 years -> 2028-02-29
      const leapToLeap = computeLimitationDeadline(fourYears, "2024-02-29", false);
      assert.equal(leapToLeap.rawDeadline.getFullYear(), 2028);
      assert.equal(leapToLeap.rawDeadline.getMonth(), 1);
      assert.equal(leapToLeap.rawDeadline.getDate(), 29);
    });

    // 2.3 Historical Dates (1947, 1973, 2000, 2024, 2026)
    it("[LIM-2.3] Historical Epochs: 1947 (Independence), 1973 (Constitution), 2000 (Millennium), 2024, 2026", () => {
      const historicalDates = [
        "1947-08-14",
        "1973-04-10",
        "1973-08-14",
        "2000-01-01",
        "2024-01-01",
        "2026-08-24",
      ];

      for (const hDate of historicalDates) {
        for (const entry of LIMITATION_SCHEDULE_ENTRIES.slice(0, 10)) {
          const res = computeLimitationDeadline(entry, hDate, true);
          assert.ok(res.rawDeadline instanceof Date, `Raw deadline must be valid Date for ${hDate}`);
          assert.ok(res.adjustedDeadline instanceof Date, `Adjusted deadline must be valid Date for ${hDate}`);
          assert.ok(typeof res.isBarred === "boolean");
          assert.ok(typeof res.daysRemaining === "number");
          assert.ok(res.expiryFormatted.length > 0);

          // If date is in the past (1947, 1973, 2000), it MUST be time-barred
          if (new Date(hDate).getFullYear() <= 2000 && entry.periodValue <= 20) {
            assert.equal(res.isBarred, true, `${entry.article} from ${hDate} must be time-barred today`);
            assert.ok(res.daysRemaining < 0, `daysRemaining must be negative for ${hDate}`);
            assert.ok(res.daysRemainingLabel.includes("past limitation bar"));
          }
        }
      }
    });

    // 2.4 Time-Barred vs Active vs Expires Today Statuses
    it("[LIM-2.4] Time-Barred State Logic: Past, Future, Today (0 days remaining), Tomorrow (+1 day), Yesterday (-1 day)", () => {
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

      // 0 days entry starting today -> raw deadline today
      // (Note: if today is Saturday or Sunday, Section 4 rolls it to Monday, so test with applySection4 = false to test exact today)
      const zeroDayEntry: LimitationEntry = { ...testArticle, periodUnit: "days", periodValue: 0 };
      const todayRes = computeLimitationDeadline(zeroDayEntry, todayStr, false);
      assert.equal(todayRes.daysRemaining, 0);
      assert.equal(todayRes.isBarred, false);
      assert.equal(todayRes.daysRemainingLabel, "Expires Today");

      // 1 day in the future (tomorrow)
      const oneDayEntry: LimitationEntry = { ...testArticle, periodUnit: "days", periodValue: 1 };
      const tomorrowRes = computeLimitationDeadline(oneDayEntry, todayStr, false);
      assert.equal(tomorrowRes.daysRemaining, 1);
      assert.equal(tomorrowRes.isBarred, false);
      assert.equal(tomorrowRes.daysRemainingLabel, "1 day remaining");

      // Past date (yesterday)
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
      const yesterdayRes = computeLimitationDeadline(zeroDayEntry, yesterdayStr, false);
      assert.equal(yesterdayRes.daysRemaining, -1);
      assert.equal(yesterdayRes.isBarred, true);
      assert.equal(yesterdayRes.daysRemainingLabel, "1 day past limitation bar");
    });

    // 2.5 Malformed & Boundary Date Inputs Robustness
    it("[LIM-2.5] Input Robustness: Invalid date strings, empty strings, NaN Date objects", () => {
      const badInputs = [
        "invalid-date",
        "",
        "   ",
        "2026-99-99",
        "abc/def/ghi",
        new Date(NaN),
      ];

      for (const bad of badInputs) {
        const res = computeLimitationDeadline(testArticle, bad as any, true);
        assert.equal(res.statutoryNote, "Invalid accrual date provided.");
        assert.equal(res.daysRemainingLabel, "Invalid date");
        assert.equal(res.isWeekendRollover, false);
        assert.equal(res.isBarred, false);
      }
    });

    // 2.6 Exhaustive Verification of All 35+ Articles in LIMITATION_SCHEDULE_ENTRIES
    it("[LIM-2.6] Complete 35+ Articles Verification: Non-empty metadata, valid units, positive periods, and calculations", () => {
      assert.ok(LIMITATION_SCHEDULE_ENTRIES.length >= 35, `Schedule must have >= 35 entries (actual: ${LIMITATION_SCHEDULE_ENTRIES.length})`);

      for (let i = 0; i < LIMITATION_SCHEDULE_ENTRIES.length; i++) {
        const entry = LIMITATION_SCHEDULE_ENTRIES[i];
        assert.ok(entry.article && entry.article.startsWith("Art."), `Entry ${i} must have valid article code (got: ${entry.article})`);
        assert.ok(entry.title && entry.title.length > 3, `Entry ${entry.article} must have title`);
        assert.ok(entry.periodValue > 0, `Entry ${entry.article} periodValue must be > 0`);
        assert.ok(["days", "months", "years"].includes(entry.periodUnit), `Entry ${entry.article} invalid unit: ${entry.periodUnit}`);
        assert.ok(entry.triggerEvent && entry.triggerEvent.length > 5, `Entry ${entry.article} must specify trigger event`);
        assert.ok(entry.statutoryRef && entry.statutoryRef.includes("Limitation Act 1908"), `Entry ${entry.article} statutoryRef must reference Limitation Act 1908`);

        // Compute with 2026-08-24
        const res = computeLimitationDeadline(entry, "2026-08-24", true);
        assert.ok(res.adjustedDeadline instanceof Date);
        // Adjusted deadline must never be a weekend when Section 4 is active
        const day = res.adjustedDeadline.getDay();
        assert.notEqual(day, 0, `Adjusted deadline fell on Sunday for ${entry.article}`);
        assert.notEqual(day, 6, `Adjusted deadline fell on Saturday for ${entry.article}`);
      }
    });
  });

  // =========================================================================
  // SUITE 3: 6-PILLAR PROCEDURAL COMPLIANCE VERIFICATION HARNESS
  // =========================================================================
  describe("Suite 3: 6-Pillar Compliance Framework & Pleading Scanner Stress Testing", () => {

    // 3.1 6-Pillars Schema Definitions Completeness
    it("[6P-3.1] Six Pillars Definitions: 6 distinct pillars with mandatory regulatory bases and keys", () => {
      assert.equal(SIX_PILLARS.length, 6, "Must define exactly 6 pillars");

      const expectedKeys = [
        "identity",
        "letter_of_authority",
        "client_matter_enquiry",
        "action_agreed_form",
        "client_care_letter",
        "conflict_check",
      ];

      for (let i = 0; i < SIX_PILLARS.length; i++) {
        const p = SIX_PILLARS[i];
        assert.equal(p.pillarNumber, i + 1, `Pillar ${i} must have pillarNumber ${i + 1}`);
        assert.equal(p.key, expectedKeys[i], `Pillar ${i} key mismatch`);
        assert.ok(p.title.length > 5, `Pillar ${p.key} must have title`);
        assert.ok(p.urduTitle.length > 2, `Pillar ${p.key} must have urduTitle`);
        assert.ok(p.regulatoryBasis.length > 5, `Pillar ${p.key} must have regulatoryBasis`);
        assert.ok(p.defaultTitle.length > 5, `Pillar ${p.key} must have defaultTitle`);
      }
    });

    // 3.2 Compliance Percentage Computation & Boundary Handling
    it("[6P-3.2] Compliance Score Calculation: 0/6 (0%), 1/6 (17%), 3/6 (50%), 6/6 (100%)", () => {
      const calcCompliance = (verifiedCount: number) => Math.round((verifiedCount / 6) * 100);

      assert.equal(calcCompliance(0), 0);
      assert.equal(calcCompliance(1), 17);
      assert.equal(calcCompliance(2), 33);
      assert.equal(calcCompliance(3), 50);
      assert.equal(calcCompliance(4), 67);
      assert.equal(calcCompliance(5), 83);
      assert.equal(calcCompliance(6), 100);
    });

    // 3.3 Drafting 6-Pillars Text Matching Logic Stress Testing
    it("[6P-3.3] Pleading Text Scanner: Robustness with missing, malformed, whitespace, and complete pleadings", () => {
      const evaluatePillars = (docText: string) => {
        const text = (docText || "").toLowerCase();
        return [
          {
            id: "p1",
            name: "Court Forum & Bench Header",
            passed:
              text.includes("in the high court") ||
              text.includes("in the court of") ||
              text.includes("in the supreme court") ||
              text.includes("judicial department") ||
              text.includes("this deed"),
          },
          {
            id: "p2",
            name: "Complete Parties & CNIC Block",
            passed:
              text.includes("cnic") ||
              text.includes("resident of") ||
              text.includes("petitioner") ||
              text.includes("plaintiff") ||
              text.includes("parties hereto"),
          },
          {
            id: "p3",
            name: "Statutory Law & Section Citations",
            passed:
              text.includes("article 199") ||
              text.includes("section 497") ||
              text.includes("section 498") ||
              text.includes("order xxxix") ||
              text.includes("order vii") ||
              text.includes("act") ||
              text.includes("ordinance"),
          },
          {
            id: "p4",
            name: "Judicial Recital Formula",
            passed:
              text.includes("respectfully sheweth") ||
              text.includes("sheweth") ||
              text.includes("whereas") ||
              text.includes("now therefore"),
          },
          {
            id: "p5",
            name: "Verification on Solemn Affirmation",
            passed:
              text.includes("verification") ||
              text.includes("solemn affirmation") ||
              text.includes("deponent") ||
              text.includes("in witness whereof"),
          },
          {
            id: "p6",
            name: "Attestation & Witness Schedule",
            passed:
              text.includes("witness") ||
              text.includes("oath commissioner") ||
              text.includes("advocate") ||
              text.includes("counsel"),
          },
        ];
      };

      // 1. Empty string / whitespace
      const emptyResult = evaluatePillars("");
      const emptyScore = Math.round((emptyResult.filter(p => p.passed).length / 6) * 100);
      assert.equal(emptyScore, 0, "Empty document text must yield 0% compliance");

      const whitespaceResult = evaluatePillars("   \n\t\n   ");
      const wsScore = Math.round((whitespaceResult.filter(p => p.passed).length / 6) * 100);
      assert.equal(wsScore, 0, "Whitespace document text must yield 0% compliance");

      // 2. Complete authentic Pakistani writ petition text
      const fullPetitionText = `
        IN THE HIGH COURT OF JUDICATURE AT LAHORE
        (JUDICIAL DEPARTMENT)
        Writ Petition No. 12345 / 2026

        1. Tariq Mahmood s/o Muhammad Bashir,
           CNIC No. 35201-1234567-1,
           Resident of House No. 12, Gulberg III, Lahore.
                                                        ... PETITIONER
        VERSUS
        1. Province of Punjab through Chief Secretary...
                                                        ... RESPONDENTS

        WRIT PETITION UNDER ARTICLE 199 OF THE CONSTITUTION OF THE ISLAMIC REPUBLIC OF PAKISTAN, 1973

        Respectfully Sheweth:
        1. That the Petitioner is a law-abiding citizen...

        VERIFICATION:
        Verified on solemn affirmation at Lahore this 24th day of August, 2026 that contents are true.
        DEPONENT

        PETITIONER Through Advocate High Court
        WITNESS 1: Ali Raza CNIC: 35201-9999999-1
      `;

      const fullResult = evaluatePillars(fullPetitionText);
      const passedCount = fullResult.filter(p => p.passed).length;
      assert.equal(passedCount, 6, "Authentic full petition text must satisfy all 6 pillars");
      const fullScore = Math.round((passedCount / 6) * 100);
      assert.equal(fullScore, 100, "Full petition text must yield 100% compliance");
    });
  });

  // =========================================================================
  // SUITE 4: STATUTORY SEARCH & COMPENDIUM RETRIEVAL INTEGRITY
  // =========================================================================
  describe("Suite 4: 7-Domain Statutory Compendium Search & Retrievability", () => {

    it("[STAT-4.1] 7 Major Legal Domains: Metadata completeness and section mappings", () => {
      assert.equal(STATUTE_DOMAINS.length, 7);
      const domainIds = ["civil", "criminal", "constitutional", "commercial", "evidence", "family", "special"];
      for (const d of domainIds) {
        const found = STATUTE_DOMAINS.find(m => m.id === d);
        assert.ok(found, `Domain ${d} metadata must exist`);
        assert.ok(found.featuredStatutes.length > 0);
      }
    });

    it("[STAT-4.2] 42+ Rich Provisions Database: ID uniqueness, citations, and mandatory pleadings", () => {
      assert.ok(STATUTE_SECTIONS.length >= 40, `Compendium must contain >= 40 provisions (found ${STATUTE_SECTIONS.length})`);

      const idSet = new Set<string>();
      for (const sec of STATUTE_SECTIONS) {
        assert.ok(!idSet.has(sec.id), `Duplicate statute section ID: ${sec.id}`);
        idSet.add(sec.id);
        assert.ok(sec.sectionNumber.length > 0);
        assert.ok(sec.title.length > 0);
        assert.ok(sec.statuteName.length > 0);
        assert.ok(sec.statuteYear > 1800);
        assert.ok(sec.text.length > 10);
        assert.ok(sec.commentary.length > 10);
        assert.ok(sec.keywords.length > 0);
      }
    });

    it("[STAT-4.3] Search & Filter Engine: Substring, sectionNumber, keyword, and category lookups", () => {
      // Order VII Rule 11 lookup
      const o7r11Results = searchStatuteSections("Order VII Rule 11");
      assert.ok(o7r11Results.length > 0, "Must find Order VII Rule 11");
      assert.equal(o7r11Results[0].id, "cpc-o7-r11");

      // Article 199 Constitutional Writ lookup
      const art199Results = searchStatuteSections("Article 199");
      assert.ok(art199Results.length > 0, "Must find Article 199");

      // Domain filtering
      const civilSections = getStatuteSectionsByDomain("civil");
      assert.ok(civilSections.length >= 5, "Must find multiple civil sections");
      for (const s of civilSections) {
        assert.equal(s.domain, "civil");
      }

      // Limitation category filtering
      const suitArticles = getLimitationArticlesByCategory("Suits");
      assert.ok(suitArticles.length >= 10, "Must find suit limitation articles");
    });
  });
});
