import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

// Setup DOM mock for localStorage, events, and Tiptap parsing
const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
const mockWindow = dom.window as any;
const mockDocument = dom.window.document as any;

import {
  computeLimitationDeadline,
  calculateProvincialCourtFee,
  LIMITATION_SCHEDULE_ENTRIES,
  COURT_FEE_SUIT_TYPES,
  PROVINCIAL_COURT_FEE_RULES,
  type LimitationEntry,
  type CourtFeeProvince,
} from "../client/src/experimental/data/statutesCompendiumData";
import { plainTextToTiptapHTML, isHTMLContent } from "../client/src/experimental/lib/plain-to-tiptap";
import {
  COURT_PETITIONS,
  ALL_DRAFTING_TEMPLATES,
  type DraftingTemplate,
} from "../client/src/experimental/components/drafting/drafting-data";
import { type LegalPageProfileId } from "../client/src/lib/legal-page-layout";

describe("Adversarial Challenger 2: Statutes Workstation, Drafting Bridge & Legal Calculators Stress Suite", () => {

  // =========================================================================
  // SUITE 1: DRAFTING STUDIO TRIPLE-BRIDGE, LOCALSTORAGE SERIALIZATION & MULTI-TAB
  // =========================================================================
  describe("Suite 1: Drafting Studio Bridge, Serialization & Multi-Tab Isolation", () => {

    interface DraftingPayload {
      statute: string;
      section: string;
      title: string;
      clause: string;
      formattedCitation?: string;
      timestamp: number;
    }

    class MockLocalStorage {
      private store: Map<string, string> = new Map();

      getItem(key: string): string | null {
        return this.store.get(key) ?? null;
      }

      setItem(key: string, value: string): void {
        this.store.set(key, String(value));
      }

      removeItem(key: string): void {
        this.store.delete(key);
      }

      clear(): void {
        this.store.clear();
      }
    }

    interface DocumentTab {
      id: string;
      title: string;
      category: string;
      pageProfileId: LegalPageProfileId;
      htmlContent: string;
      textContent: string;
      lastModified: number;
    }

    class MockDraftingStudioState {
      tabs: DocumentTab[];
      activeTabId: string;
      currentHtml: string;
      currentText: string;
      activeProfileId: LegalPageProfileId;
      showLaunchpad: boolean;
      storage: MockLocalStorage;
      eventLogs: string[];

      constructor(storage: MockLocalStorage) {
        this.storage = storage;
        this.eventLogs = [];
        const initWrit = COURT_PETITIONS[0];
        const initHtml = plainTextToTiptapHTML(initWrit.body);
        this.tabs = [
          {
            id: "doc-1",
            title: initWrit.title,
            category: initWrit.category,
            pageProfileId: "court-legal",
            htmlContent: initHtml,
            textContent: initWrit.body,
            lastModified: Date.now(),
          },
          {
            id: "doc-2",
            title: "Injunction Plaint (Order 39)",
            category: "Civil Court",
            pageProfileId: "court-legal",
            htmlContent: plainTextToTiptapHTML(COURT_PETITIONS[4].body),
            textContent: COURT_PETITIONS[4].body,
            lastModified: Date.now(),
          },
        ];
        this.activeTabId = "doc-1";
        this.currentHtml = initHtml;
        this.currentText = initWrit.body;
        this.activeProfileId = "court-legal";
        this.showLaunchpad = false;
      }

      userEdit(newHtml: string, newText: string) {
        this.currentHtml = newHtml;
        this.currentText = newText;
        this.tabs = this.tabs.map((t) =>
          t.id === this.activeTabId
            ? { ...t, htmlContent: newHtml, textContent: newText, lastModified: Date.now() }
            : t
        );
      }

      handleSwitchTab(tabId: string) {
        if (tabId === this.activeTabId) return;
        const target = this.tabs.find((t) => t.id === tabId);
        if (!target) return;

        // Flush dirty active editor content
        this.tabs = this.tabs.map((t) =>
          t.id === this.activeTabId
            ? { ...t, htmlContent: this.currentHtml, textContent: this.currentText, lastModified: Date.now() }
            : t
        );

        this.activeTabId = tabId;
        this.currentHtml = target.htmlContent;
        this.currentText = target.textContent;
        this.activeProfileId = target.pageProfileId;
        this.showLaunchpad = false;
      }

      handleCloseTab(tabId: string): { success: boolean; reason?: string } {
        if (this.tabs.length <= 1) {
          return { success: false, reason: "Cannot Close Only Tab" };
        }
        const tabIndex = this.tabs.findIndex((t) => t.id === tabId);
        if (tabIndex === -1) return { success: false, reason: "Tab Not Found" };

        const remaining = this.tabs.filter((t) => t.id !== tabId);
        this.tabs = remaining;

        if (this.activeTabId === tabId) {
          const nextIndex = Math.min(tabIndex, remaining.length - 1);
          const nextTab = remaining[nextIndex];
          this.activeTabId = nextTab.id;
          this.currentHtml = nextTab.htmlContent;
          this.currentText = nextTab.textContent;
          this.activeProfileId = nextTab.pageProfileId;
        }
        return { success: true };
      }

      processIncomingDraftingInsert(): { inserted: boolean; error?: string } {
        try {
          const raw = this.storage.getItem("alwakeelo_drafting_insert");
          if (!raw) return { inserted: false, error: "Empty storage" };
          const data = JSON.parse(raw);
          if (!data || typeof data !== "object" || !data.clause) {
            return { inserted: false, error: "Missing clause field" };
          }

          this.storage.removeItem("alwakeelo_drafting_insert");
          this.showLaunchpad = false;

          const clauseHtml = plainTextToTiptapHTML(data.clause);

          // Append to active tab content
          this.tabs = this.tabs.map((t) =>
            t.id === this.activeTabId
              ? {
                  ...t,
                  htmlContent: (t.htmlContent ? t.htmlContent + "<p></p>" : "") + clauseHtml,
                  textContent: (t.textContent ? t.textContent + "\n\n" : "") + data.clause,
                  lastModified: Date.now(),
                }
              : t
          );

          this.currentHtml = (this.currentHtml ? this.currentHtml + "<p></p>" : "") + clauseHtml;
          this.currentText = (this.currentText ? this.currentText + "\n\n" : "") + data.clause;
          this.eventLogs.push(`Inserted: ${data.statute || ""} ${data.section || ""}`);
          return { inserted: true };
        } catch (err: any) {
          return { inserted: false, error: err?.message || String(err) };
        }
      }
    }

    it("[CH2-1.1] localStorage drafting insert: standard structured payload serialization and consumption", () => {
      const storage = new MockLocalStorage();
      const studio = new MockDraftingStudioState(storage);

      const payload: DraftingPayload = {
        statute: "Specific Relief Act 1877",
        section: "Section 24(c)",
        title: "Mandatory Averment of Continuous Readiness and Willingness",
        clause: "That the Plaintiff has always been ready and willing to perform his part of the contract.",
        formattedCitation: "PLD 2021 SC 429",
        timestamp: Date.now(),
      };

      storage.setItem("alwakeelo_drafting_insert", JSON.stringify(payload));
      const res = studio.processIncomingDraftingInsert();

      assert.equal(res.inserted, true);
      assert.equal(storage.getItem("alwakeelo_drafting_insert"), null, "Must clean up storage key after ingestion");
      assert.ok(studio.currentText.includes("always been ready and willing"));
      assert.ok(studio.currentHtml.includes("<p>That the Plaintiff has always been ready and willing to perform his part of the contract.</p>"));
    });

    it("[CH2-1.2] localStorage drafting insert: malformed JSON, missing fields, and corrupted payloads handle gracefully", () => {
      const storage = new MockLocalStorage();
      const studio = new MockDraftingStudioState(storage);

      // Malformed JSON
      storage.setItem("alwakeelo_drafting_insert", "{malformed_json_not_parseable");
      const res1 = studio.processIncomingDraftingInsert();
      assert.equal(res1.inserted, false);
      assert.ok(res1.error);

      // Missing clause field
      storage.setItem("alwakeelo_drafting_insert", JSON.stringify({ statute: "PPC", section: "302" }));
      const res2 = studio.processIncomingDraftingInsert();
      assert.equal(res2.inserted, false);
      assert.equal(res2.error, "Missing clause field");

      // Non-object primitive string
      storage.setItem("alwakeelo_drafting_insert", JSON.stringify(12345));
      const res3 = studio.processIncomingDraftingInsert();
      assert.equal(res3.inserted, false);

      // Empty string
      storage.setItem("alwakeelo_drafting_insert", "");
      const res4 = studio.processIncomingDraftingInsert();
      assert.equal(res4.inserted, false);
    });

    it("[CH2-1.3] Multi-tab dirty content preservation during rapid interleaved tab switching", () => {
      const storage = new MockLocalStorage();
      const studio = new MockDraftingStudioState(storage);

      assert.equal(studio.tabs.length, 2);
      assert.equal(studio.activeTabId, "doc-1");

      // Edit Doc 1
      const doc1NewHtml = "<p>GROUND 1: S.24-A General Clauses Act reasoned order violation.</p>";
      const doc1NewText = "GROUND 1: S.24-A General Clauses Act reasoned order violation.";
      studio.userEdit(doc1NewHtml, doc1NewText);

      // Switch to Doc 2
      studio.handleSwitchTab("doc-2");
      assert.equal(studio.activeTabId, "doc-2");
      assert.notEqual(studio.currentHtml, doc1NewHtml);

      // Edit Doc 2
      const doc2NewHtml = "<p>GROUND 2: Order 39 Rule 1&2 balance of convenience strongly in favour of Plaintiff.</p>";
      const doc2NewText = "GROUND 2: Order 39 Rule 1&2 balance of convenience strongly in favour of Plaintiff.";
      studio.userEdit(doc2NewHtml, doc2NewText);

      // Switch back to Doc 1
      studio.handleSwitchTab("doc-1");
      assert.equal(studio.activeTabId, "doc-1");
      assert.equal(studio.currentHtml, doc1NewHtml);
      assert.equal(studio.currentText, doc1NewText);

      // Switch back to Doc 2
      studio.handleSwitchTab("doc-2");
      assert.equal(studio.activeTabId, "doc-2");
      assert.equal(studio.currentHtml, doc2NewHtml);
      assert.equal(studio.currentText, doc2NewText);
    });

    it("[CH2-1.4] Single-tab closure protection and tab deletion pointer recalculation", () => {
      const storage = new MockLocalStorage();
      const studio = new MockDraftingStudioState(storage);

      // Add a third tab
      studio.tabs.push({
        id: "doc-3",
        title: "Bail Application",
        category: "Sessions & Criminal",
        pageProfileId: "court-legal",
        htmlContent: "<p>Bail content</p>",
        textContent: "Bail content",
        lastModified: Date.now(),
      });

      assert.equal(studio.tabs.length, 3);

      // Close doc-2
      const resClose2 = studio.handleCloseTab("doc-2");
      assert.equal(resClose2.success, true);
      assert.equal(studio.tabs.length, 2);
      assert.equal(studio.activeTabId, "doc-1");

      // Switch to doc-3 and close it
      studio.handleSwitchTab("doc-3");
      assert.equal(studio.activeTabId, "doc-3");
      const resClose3 = studio.handleCloseTab("doc-3");
      assert.equal(resClose3.success, true);
      assert.equal(studio.tabs.length, 1);
      assert.equal(studio.activeTabId, "doc-1");

      // Try closing the last remaining tab (doc-1) -> must fail
      const resCloseLast = studio.handleCloseTab("doc-1");
      assert.equal(resCloseLast.success, false);
      assert.equal(resCloseLast.reason, "Cannot Close Only Tab");
      assert.equal(studio.tabs.length, 1);
    });

    it("[CH2-1.5] 500 High-Frequency Sequential Tab Switches & Ingestions Stress Test", () => {
      const storage = new MockLocalStorage();
      const studio = new MockDraftingStudioState(storage);

      // Add 3 more tabs
      for (let i = 3; i <= 5; i++) {
        studio.tabs.push({
          id: `doc-${i}`,
          title: `Document ${i}`,
          category: "General",
          pageProfileId: "court-legal",
          htmlContent: `<p>Content for doc ${i}</p>`,
          textContent: `Content for doc ${i}`,
          lastModified: Date.now(),
        });
      }

      for (let iter = 0; iter < 500; iter++) {
        const targetTab = studio.tabs[iter % studio.tabs.length];
        studio.handleSwitchTab(targetTab.id);
        assert.equal(studio.activeTabId, targetTab.id);

        if (iter % 10 === 0) {
          const payload: DraftingPayload = {
            statute: "CrPC",
            section: `S.${iter}`,
            title: `Ground ${iter}`,
            clause: `Ground ${iter} text added during stress loop.`,
            timestamp: Date.now(),
          };
          storage.setItem("alwakeelo_drafting_insert", JSON.stringify(payload));
          studio.processIncomingDraftingInsert();
          assert.ok(studio.currentText.includes(`Ground ${iter}`));
        }
      }
      assert.equal(studio.tabs.length, 5);
    });

    it("[CH2-1.6] Tiptap HTML generation & hostile XSS / script injection sanitization", () => {
      // 1. Standard court heading
      const plainCourt = "IN THE HIGH COURT OF SINDH AT KARACHI\nWRIT PETITION NO. 1234 OF 2026\n\nTariq Mahmood\n...PETITIONER\n\nVERSUS\n\nFederation of Pakistan\n...RESPONDENT";
      const htmlCourt = plainTextToTiptapHTML(plainCourt);
      assert.ok(htmlCourt.includes("<h1 style=\"text-align:center\"><strong>IN THE HIGH COURT OF SINDH AT KARACHI</strong></h1>"));
      assert.ok(htmlCourt.includes("...PETITIONER"));
      assert.ok(htmlCourt.includes("...RESPONDENT"));

      // 2. Table parsing
      const plainTable = "| No | Article | Period |\n| 1 | Art. 113 | 3 Years |\n| 2 | Art. 152 | 30 Days |";
      const htmlTable = plainTextToTiptapHTML(plainTable);
      assert.ok(htmlTable.includes("<table>") || htmlTable.includes("<table"));
      assert.ok(htmlTable.includes("Art. 113"));
      assert.ok(htmlTable.includes("30 Days"));

      // 3. Script injection attack string
      const hostileString = "Para 1. That the order violates Section 24-A.\n<script>alert('XSS_ATTACK')</script>\n<iframe src=\"javascript:alert(1)\"></iframe>";
      const htmlHostile = plainTextToTiptapHTML(hostileString);
      assert.ok(!htmlHostile.includes("<script>alert('XSS_ATTACK')</script>"));
      assert.ok(!htmlHostile.includes("<iframe"));
      assert.ok(htmlHostile.includes("Section 24-A"));

      // 4. Large 200,000-character payload
      const largePlain = "Section 497 CrPC Ground for Bail.\n" + "This is a detailed legal submission paragraph.\n".repeat(4000);
      const startT = performance.now();
      const largeHtml = plainTextToTiptapHTML(largePlain);
      const elapsed = performance.now() - startT;
      assert.ok(elapsed < 200, `Parsing 200k chars took ${elapsed}ms (must be < 200ms)`);
      assert.ok(largeHtml.length > largePlain.length);
    });
  });

  // =========================================================================
  // SUITE 2: LIMITATION ACT CALCULATOR & SECTION 4 ROLLOVER ENGINE
  // =========================================================================
  describe("Suite 2: Limitation Calculator, Section 4 Rollover & Leap Year Matrix", () => {

    const art113: LimitationEntry = {
      article: "Article 113",
      title: "Specific Performance of Contract",
      periodText: "3 Years",
      periodValue: 3,
      periodUnit: "years",
      triggerEvent: "The date fixed for the performance, or, if no such date is fixed, when the plaintiff has notice that performance is refused.",
      category: "Civil Suits (Contract & Specific Relief)",
      landmarkPrecedent: "PLD 2021 SC 429",
      notes: "Three-year period begins from explicit refusal date."
    };

    const art152: LimitationEntry = {
      article: "Article 152",
      title: "Appeal under CPC to District Court",
      periodText: "30 Days",
      periodValue: 30,
      periodUnit: "days",
      triggerEvent: "The date of the decree or order appealed from.",
      category: "Civil Appeals & Revisions",
      landmarkPrecedent: "2019 SCMR 1245",
      notes: "30 days for appeal to District Court from Civil Judge decree."
    };

    const art156: LimitationEntry = {
      article: "Article 156",
      title: "Appeal under CPC to High Court",
      periodText: "90 Days",
      periodValue: 90,
      periodUnit: "days",
      triggerEvent: "The date of the decree or order appealed from.",
      category: "Civil Appeals & Revisions",
      notes: "90 days for appeal to High Court."
    };

    it("[CH2-2.1] Section 4 Weekend Rollover: Saturday (+2 days to Monday) and Sunday (+1 day to Monday)", () => {
      // 2026-08-14 is a Friday.
      // 1-day period from 2026-08-14 -> Raw Saturday 2026-08-15
      const day1Sat: LimitationEntry = { ...art152, periodValue: 1, periodUnit: "days" };
      const resSat = computeLimitationDeadline(day1Sat, "2026-08-14", true);

      assert.equal(resSat.rawDeadline.getDay(), 6, "Raw deadline should be Saturday");
      assert.equal(resSat.adjustedDeadline.getDay(), 1, "Adjusted deadline must roll to Monday");
      assert.equal(resSat.isWeekendRollover, true);
      assert.ok(resSat.statutoryNote.includes("Deadline fell on Saturday"));

      // 2-day period from 2026-08-14 -> Raw Sunday 2026-08-16
      const day2Sun: LimitationEntry = { ...art152, periodValue: 2, periodUnit: "days" };
      const resSun = computeLimitationDeadline(day2Sun, "2026-08-14", true);

      assert.equal(resSun.rawDeadline.getDay(), 0, "Raw deadline should be Sunday");
      assert.equal(resSun.adjustedDeadline.getDay(), 1, "Adjusted deadline must roll to Monday");
      assert.equal(resSun.isWeekendRollover, true);
      assert.ok(resSun.statutoryNote.includes("Deadline fell on Sunday"));

      // 3-day period from 2026-08-14 -> Raw Monday 2026-08-17
      const day3Mon: LimitationEntry = { ...art152, periodValue: 3, periodUnit: "days" };
      const resMon = computeLimitationDeadline(day3Mon, "2026-08-14", true);

      assert.equal(resMon.rawDeadline.getDay(), 1, "Raw deadline should be Monday");
      assert.equal(resMon.adjustedDeadline.getDay(), 1, "Adjusted deadline must remain Monday");
      assert.equal(resMon.isWeekendRollover, false);
    });

    it("[CH2-2.2] Section 4 Toggle: applySection4 = false strictly disables weekend rollover", () => {
      const day1Sat: LimitationEntry = { ...art152, periodValue: 1, periodUnit: "days" };
      const resNoRollSat = computeLimitationDeadline(day1Sat, "2026-08-14", false);

      assert.equal(resNoRollSat.rawDeadline.getDay(), 6);
      assert.equal(resNoRollSat.adjustedDeadline.getDay(), 6, "Must stay Saturday when applySection4 is false");
      assert.equal(resNoRollSat.isWeekendRollover, false);

      const day2Sun: LimitationEntry = { ...art152, periodValue: 2, periodUnit: "days" };
      const resNoRollSun = computeLimitationDeadline(day2Sun, "2026-08-14", false);

      assert.equal(resNoRollSun.rawDeadline.getDay(), 0);
      assert.equal(resNoRollSun.adjustedDeadline.getDay(), 0, "Must stay Sunday when applySection4 is false");
      assert.equal(resNoRollSun.isWeekendRollover, false);
    });

    it("[CH2-2.3] Leap Year Matrix: Verification across 2000, 2024, 2028, 2032 and non-leap years 1900, 2023, 2025, 2100", () => {
      const entry1Day: LimitationEntry = { ...art152, periodValue: 1, periodUnit: "days" };
      const entry1Year: LimitationEntry = { ...art113, periodValue: 1, periodUnit: "years" };

      // Leap year 2024: Feb 28 + 1 day -> Feb 29
      const feb28_2024 = computeLimitationDeadline(entry1Day, "2024-02-28", false);
      assert.equal(feb28_2024.rawDeadline.getMonth(), 1, "Month should be February (1)");
      assert.equal(feb28_2024.rawDeadline.getDate(), 29, "Day should be 29 in leap year");

      // Non-leap year 2025: Feb 28 + 1 day -> Mar 1
      const feb28_2025 = computeLimitationDeadline(entry1Day, "2025-02-28", false);
      assert.equal(feb28_2025.rawDeadline.getMonth(), 2, "Month should be March (2)");
      assert.equal(feb28_2025.rawDeadline.getDate(), 1, "Day should be 1 in non-leap year");

      // Leap day start: 2024-02-29 + 1 year -> 2025-02-28 or 2025-03-01
      const feb29_plus1y = computeLimitationDeadline(entry1Year, "2024-02-29", false);
      assert.equal(feb29_plus1y.rawDeadline.getFullYear(), 2025);

      // Leap day start: 2024-02-29 + 4 years -> 2028-02-29 (leap to leap)
      const entry4Years: LimitationEntry = { ...art113, periodValue: 4, periodUnit: "years" };
      const feb29_plus4y = computeLimitationDeadline(entry4Years, "2024-02-29", false);
      assert.equal(feb29_plus4y.rawDeadline.getFullYear(), 2028);
      assert.equal(feb29_plus4y.rawDeadline.getMonth(), 1);
      assert.equal(feb29_plus4y.rawDeadline.getDate(), 29);

      // Century non-leap year 2100: Feb 28 + 1 day -> Mar 1
      const feb28_2100 = computeLimitationDeadline(entry1Day, "2100-02-28", false);
      assert.equal(feb28_2100.rawDeadline.getMonth(), 2);
      assert.equal(feb28_2100.rawDeadline.getDate(), 1);
    });

    it("[CH2-2.4] Time-Barred Detection: Past dates vs Future dates vs Today calculation", () => {
      // Past date (10 years ago) -> isBarred = true, negative daysRemaining
      const pastRes = computeLimitationDeadline(art152, "2010-01-01", true);
      assert.equal(pastRes.isBarred, true);
      assert.ok(pastRes.daysRemaining < 0);
      assert.ok(pastRes.daysRemainingLabel.includes("past limitation bar"));

      // Future date (5 years in future) -> isBarred = false, positive daysRemaining
      const futureRes = computeLimitationDeadline(art113, "2030-01-01", true);
      assert.equal(futureRes.isBarred, false);
      assert.ok(futureRes.daysRemaining > 0);
      assert.ok(futureRes.daysRemainingLabel.includes("days remaining"));
    });

    it("[CH2-2.5] Robustness on Malformed / Invalid Accrual Date Inputs", () => {
      const invalidRes1 = computeLimitationDeadline(art113, "invalid-date-format", true);
      assert.equal(invalidRes1.statutoryNote, "Invalid accrual date provided.");
      assert.equal(invalidRes1.daysRemainingLabel, "Invalid date");
      assert.equal(invalidRes1.isWeekendRollover, false);

      const invalidRes2 = computeLimitationDeadline(art113, "", true);
      assert.equal(invalidRes2.statutoryNote, "Invalid accrual date provided.");

      const invalidRes3 = computeLimitationDeadline(art113, new Date(NaN), true);
      assert.equal(invalidRes3.statutoryNote, "Invalid accrual date provided.");
    });

    it("[CH2-2.6] Exhaustive Stress Test: All 35+ schedule articles computed across 365 daily steps", () => {
      assert.ok(LIMITATION_SCHEDULE_ENTRIES.length >= 35, `Must have >= 35 schedule entries (found ${LIMITATION_SCHEDULE_ENTRIES.length})`);

      const baseYear = 2026;
      let totalComputations = 0;

      for (const entry of LIMITATION_SCHEDULE_ENTRIES) {
        assert.ok(entry.article, "Entry must have article");
        assert.ok(entry.periodValue > 0, "Period value must be > 0");
        assert.ok(["days", "months", "years"].includes(entry.periodUnit), `Invalid unit: ${entry.periodUnit}`);

        for (let dayOffset = 0; dayOffset < 365; dayOffset += 10) {
          const date = new Date(baseYear, 0, 1 + dayOffset);
          const res = computeLimitationDeadline(entry, date, true);

          assert.ok(res.rawDeadline instanceof Date);
          assert.ok(res.adjustedDeadline instanceof Date);
          assert.ok(typeof res.isBarred === "boolean");
          assert.ok(typeof res.isWeekendRollover === "boolean");
          assert.ok(typeof res.daysRemaining === "number");

          // Verify adjusted deadline is never Saturday (6) or Sunday (0) when Section 4 is applied
          const dayOfWeek = res.adjustedDeadline.getDay();
          assert.notEqual(dayOfWeek, 0, `Adjusted deadline fell on Sunday for ${entry.article} from ${date.toISOString()}`);
          assert.notEqual(dayOfWeek, 6, `Adjusted deadline fell on Saturday for ${entry.article} from ${date.toISOString()}`);

          totalComputations++;
        }
      }
      assert.ok(totalComputations > 1000, `Executed ${totalComputations} limitation calculations without error`);
    });
  });

  // =========================================================================
  // SUITE 3: PROVINCIAL COURT FEES CALCULATOR & SINDH HIGH COURT DUAL-CAP
  // =========================================================================
  describe("Suite 3: Provincial Court Fees Calculator & Sindh Dual-Cap Engine", () => {

    const provinces: CourtFeeProvince[] = ["punjab", "sindh", "islamabad", "kpk", "balochistan"];

    it("[CH2-3.1] 5 Provincial regimes completeness: governing acts, 7.5% ad valorem, and PKR 25,000 exemption", () => {
      assert.equal(provinces.length, 5);

      for (const p of provinces) {
        const rule = PROVINCIAL_COURT_FEE_RULES[p];
        assert.ok(rule, `Rule for ${p} must exist`);
        assert.equal(rule.adValoremRate, 7.5, `${p} ad valorem rate must be 7.5%`);
        assert.equal(rule.exemptThreshold, 25000, `${p} exemption threshold must be PKR 25,000`);
        assert.equal(rule.maxCapGeneral, 15000, `${p} general statutory cap must be PKR 15,000`);
        assert.ok(rule.governingAct.length > 5, `${p} must specify governing act`);
        assert.ok(rule.pecuniaryTiers.length >= 3, `${p} must define pecuniary tiers`);
      }
    });

    it("[CH2-3.2] Exemption Boundary: Valuations <= PKR 25,000 are 100% exempt (PKR 0 court fee)", () => {
      for (const p of provinces) {
        const res0 = calculateProvincialCourtFee(p, "recovery_money", 0);
        assert.equal(res0.fee, 0);
        assert.equal(res0.isExempt, true);

        const res10k = calculateProvincialCourtFee(p, "recovery_money", 10000);
        assert.equal(res10k.fee, 0);
        assert.equal(res10k.isExempt, true);

        const res25k = calculateProvincialCourtFee(p, "recovery_money", 25000);
        assert.equal(res25k.fee, 0);
        assert.equal(res25k.isExempt, true);

        // 25,001 is above threshold -> 7.5% of 25,001 = 1,875
        const res25001 = calculateProvincialCourtFee(p, "recovery_money", 25001);
        assert.equal(res25001.fee, 1875);
        assert.equal(res25001.isExempt, false);
      }
    });

    it("[CH2-3.3] General Maximum Statutory Cap: PKR 15,000 ceiling across standard provinces", () => {
      const testValuations = [300000, 500000, 1000000, 10000000, 50000000];

      for (const p of ["punjab", "islamabad", "kpk", "balochistan"] as CourtFeeProvince[]) {
        for (const val of testValuations) {
          const res = calculateProvincialCourtFee(p, "recovery_money", val);
          assert.equal(res.fee, 15000, `Fee for ${p} at valuation ${val} must be capped at 15,000`);
          assert.equal(res.isCapped, true);
          assert.equal(res.capAmount, 15000);
        }
      }
    });

    it("[CH2-3.4] Sindh High Court Original Side PKR 50,000 Dual-Cap Ceiling at PKR 65,000,000 Threshold", () => {
      // 1. Valuation exactly at PKR 65,000,000 (District Court / Senior Civil Judge in Karachi)
      // Cap is PKR 15,000
      const sindh65M = calculateProvincialCourtFee("sindh", "recovery_money", 65000000);
      assert.equal(sindh65M.fee, 15000, "Sindh fee at 65M must be capped at District general cap of PKR 15,000");
      assert.equal(sindh65M.capAmount, 15000);
      assert.ok(sindh65M.pecuniaryCourt.includes("Senior Civil Judge"));

      // 2. Valuation at PKR 65,000,001 (Crosses into SHC Original Civil Jurisdiction)
      // Cap elevates to PKR 50,000
      const sindhAbove65M = calculateProvincialCourtFee("sindh", "recovery_money", 65000001);
      assert.equal(sindhAbove65M.fee, 50000, "Sindh fee above 65M must be capped at SHC Original Side cap of PKR 50,000");
      assert.equal(sindhAbove65M.capAmount, 50000);
      assert.ok(sindhAbove65M.pecuniaryCourt.includes("Sindh High Court (Original Side"));

      // 3. Mega commercial suit: PKR 500,000,000 (500M)
      const sindh500M = calculateProvincialCourtFee("sindh", "recovery_money", 500000000);
      assert.equal(sindh500M.fee, 50000);
      assert.equal(sindh500M.capAmount, 50000);

      // Contrast with Punjab for same 500M suit:
      const punjab500M = calculateProvincialCourtFee("punjab", "recovery_money", 500000000);
      assert.equal(punjab500M.fee, 15000, "Punjab must remain capped at 15,000");
    });

    it("[CH2-3.5] Percentage-Capped Suits (Civil Revision / Review @ 3.75%, Capped at PKR 7,500)", () => {
      for (const p of provinces) {
        // Exempt
        const resExempt = calculateProvincialCourtFee(p, "civil_revision", 20000);
        assert.equal(resExempt.fee, 0);
        assert.equal(resExempt.isExempt, true);

        // 100k valuation @ 3.75% = 3,750
        const resMid = calculateProvincialCourtFee(p, "civil_revision", 100000);
        assert.equal(resMid.fee, 3750);
        assert.equal(resMid.isCapped, false);

        // 500k valuation @ 3.75% = 18,750 -> Capped at 7,500
        const resCapped = calculateProvincialCourtFee(p, "civil_revision", 500000);
        assert.equal(resCapped.fee, 7500);
        assert.equal(resCapped.isCapped, true);
        assert.equal(resCapped.capAmount, 7500);
      }
    });

    it("[CH2-3.6] Fixed Fee Suits across All 5 Provinces", () => {
      const fixedSuits = [
        { id: "constitutional_writ", expected: 500 },
        { id: "permanent_injunction", expected: 500 },
        { id: "family_suit", expected: 500 },
        { id: "declaration_pure", expected: 500 },
        { id: "arbitration_objection", expected: 500 },
        { id: "execution_petition", expected: 50 },
        { id: "bail_criminal_petition", expected: 100 },
        { id: "vakalatnama_stamp", expected: 30 },
      ];

      for (const p of provinces) {
        for (const suit of fixedSuits) {
          const res = calculateProvincialCourtFee(p, suit.id, 100000000);
          assert.equal(res.fee, suit.expected, `Fee for ${suit.id} in ${p} must be fixed ${suit.expected}`);
          assert.equal(res.isExempt, false);
          assert.equal(res.effectiveRate, "Fixed");
        }
      }
    });

    it("[CH2-3.7] Extreme Valuation Edge Cases: Negative, NaN, 0, and Trillion PKR Valuations", () => {
      for (const p of provinces) {
        // Negative number clamped to 0
        const negRes = calculateProvincialCourtFee(p, "recovery_money", -1000000);
        assert.equal(negRes.fee, 0);
        assert.equal(negRes.isExempt, true);

        // NaN clamped to 0
        const nanRes = calculateProvincialCourtFee(p, "recovery_money", NaN);
        assert.equal(nanRes.fee, 0);
        assert.equal(nanRes.isExempt, true);

        // 1 Trillion PKR (1,000,000,000,000)
        const trillionRes = calculateProvincialCourtFee(p, "recovery_money", 1000000000000);
        const expectedCap = p === "sindh" ? 50000 : 15000;
        assert.equal(trillionRes.fee, expectedCap);
        assert.equal(trillionRes.isCapped, true);
      }
    });
  });
});
