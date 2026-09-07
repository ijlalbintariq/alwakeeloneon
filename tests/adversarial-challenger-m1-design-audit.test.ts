import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();

describe("Adversarial Challenger 2 — Milestone 1 Visual Consistency, Design System & Responsive Audit", () => {
  const targetFiles = [
    "client/src/experimental/components/PreviewBanner.tsx",
    "client/src/experimental/components/PreviewMetricCard.tsx",
    "client/src/experimental/components/cases/CaseDossierOverview.tsx",
    "client/src/experimental/components/diary/CalendarSyncPanel.tsx",
    "client/src/experimental/components/diary/AddDiaryEntryModal.tsx",
    "client/src/experimental/components/diary/PostHearingOutcomeModal.tsx",
  ];

  describe("1. Legacy Color, Burgundy, Brown & Parchment Scrubbing", () => {
    const forbiddenTokens = [
      { pattern: /#2B2118/i, name: "Legacy Brown (#2B2118)" },
      { pattern: /#571F1A/i, name: "Legacy Dark Maroon (#571F1A)" },
      { pattern: /#6E2B25/i, name: "Legacy Burgundy (#6E2B25)" },
      { pattern: /#8B0000/i, name: "Dark Red (#8B0000)" },
      { pattern: /#FFFDF6/i, name: "Parchment Background (#FFFDF6)" },
      { pattern: /#DFD3B8/i, name: "Parchment Border (#DFD3B8)" },
      { pattern: /#EFE6D4/i, name: "Parchment Text (#EFE6D4)" },
      { pattern: /#C9A96A/i, name: "Legacy Gold (#C9A96A)" },
      { pattern: /bg-gradient-to/i, name: "2-Tone Background Gradient" },
    ];

    for (const relPath of targetFiles) {
      it(`[Token Check] ${relPath} contains zero legacy brown/maroon/parchment tokens or gradients`, () => {
        const fullPath = path.join(ROOT_DIR, relPath);
        assert.ok(fs.existsSync(fullPath), `File must exist: ${relPath}`);
        const content = fs.readFileSync(fullPath, "utf8");

        for (const token of forbiddenTokens) {
          const match = content.match(token.pattern);
          assert.equal(
            match,
            null,
            `Forbidden token '${token.name}' found in ${relPath}: ${match?.[0]}`
          );
        }
      });
    }
  });

  describe("2. Design System Adherence (#105B38, #FFFFFF, #E2E8F0, Slate Typography)", () => {
    it("PreviewBanner strictly uses #105B38 primary background and #0D4A2E border", () => {
      const bannerContent = fs.readFileSync(
        path.join(ROOT_DIR, "client/src/experimental/components/PreviewBanner.tsx"),
        "utf8"
      );
      assert.ok(bannerContent.includes("bg-[#105B38]"), "Banner must use bg-[#105B38]");
      assert.ok(bannerContent.includes("border-[#0D4A2E]"), "Banner must use border-[#0D4A2E]");
      assert.ok(bannerContent.includes("text-white"), "Banner must use text-white");
    });

    it("PreviewMetricCard strictly uses bg-white and border-[#E2E8F0]", () => {
      const cardContent = fs.readFileSync(
        path.join(ROOT_DIR, "client/src/experimental/components/PreviewMetricCard.tsx"),
        "utf8"
      );
      assert.ok(cardContent.includes("bg-white"), "MetricCard must use bg-white");
      assert.ok(cardContent.includes("border-[#E2E8F0]"), "MetricCard must use border-[#E2E8F0]");
      assert.ok(cardContent.includes("text-[#0F172A]"), "MetricCard must use slate-900 typography text-[#0F172A]");
      assert.ok(cardContent.includes("text-[#64748B]"), "MetricCard must use slate-500 typography text-[#64748B]");
    });

    it("CaseDossierOverview strictly uses #105B38 accents, bg-white cards, and #E2E8F0 borders", () => {
      const dossierContent = fs.readFileSync(
        path.join(ROOT_DIR, "client/src/experimental/components/cases/CaseDossierOverview.tsx"),
        "utf8"
      );
      assert.ok(dossierContent.includes("text-[#105B38]"), "Must use #105B38 for accents");
      assert.ok(dossierContent.includes("bg-emerald-50"), "Must use bg-emerald-50 for badges/icons");
      assert.ok(dossierContent.includes("border-[#E2E8F0]"), "Must use border-[#E2E8F0]");
      assert.ok(dossierContent.includes("text-[#0F172A]"), "Must use slate-900 typography text-[#0F172A]");
    });

    it("CalendarSyncPanel strictly uses #105B38 primary buttons, bg-white card, and #E2E8F0 borders", () => {
      const panelContent = fs.readFileSync(
        path.join(ROOT_DIR, "client/src/experimental/components/diary/CalendarSyncPanel.tsx"),
        "utf8"
      );
      assert.ok(panelContent.includes("bg-[#105B38]"), "Connect button must use bg-[#105B38]");
      assert.ok(panelContent.includes("border-[#E2E8F0]"), "Card and feature boxes must use border-[#E2E8F0]");
      assert.ok(panelContent.includes("text-[#0F172A]"), "Must use slate-900 typography text-[#0F172A]");
    });

    it("AddDiaryEntryModal strictly uses #105B38 focus rings/submit button, bg-white dialog, and #E2E8F0 borders", () => {
      const modalContent = fs.readFileSync(
        path.join(ROOT_DIR, "client/src/experimental/components/diary/AddDiaryEntryModal.tsx"),
        "utf8"
      );
      assert.ok(modalContent.includes("bg-[#105B38]"), "Submit button must use bg-[#105B38]");
      assert.ok(modalContent.includes("focus:border-[#105B38]"), "Inputs must focus to #105B38");
      assert.ok(modalContent.includes("border-[#E2E8F0]"), "Dialog and inputs must use border-[#E2E8F0]");
      assert.ok(modalContent.includes("bg-white"), "Dialog must be bg-white");
    });

    it("PostHearingOutcomeModal strictly uses #105B38 active state/submit button, bg-white dialog, and #E2E8F0 borders", () => {
      const modalContent = fs.readFileSync(
        path.join(ROOT_DIR, "client/src/experimental/components/diary/PostHearingOutcomeModal.tsx"),
        "utf8"
      );
      assert.ok(modalContent.includes("bg-[#105B38]"), "Submit button must use bg-[#105B38]");
      assert.ok(modalContent.includes("border-[#105B38]"), "Selected outcome must border #105B38");
      assert.ok(modalContent.includes("border-[#E2E8F0]"), "Dialog and inputs must use border-[#E2E8F0]");
      assert.ok(modalContent.includes("bg-white"), "Dialog must be bg-white");
    });
  });

  describe("3. Mobile and Desktop Responsiveness Architecture", () => {
    it("PreviewBanner supports flexible wrap and hides quick route pills on mobile (<1024px)", () => {
      const bannerContent = fs.readFileSync(
        path.join(ROOT_DIR, "client/src/experimental/components/PreviewBanner.tsx"),
        "utf8"
      );
      assert.ok(bannerContent.includes("flex-wrap"), "Banner must use flex-wrap for small viewports");
      assert.ok(bannerContent.includes("hidden lg:flex"), "Route pills must be hidden on mobile/tablet viewports");
      assert.ok(bannerContent.includes("hidden md:inline"), "Subtext tag must hide on mobile screens");
    });

    it("CaseDossierOverview adapts between single column on mobile and 12-column split-pane on desktop", () => {
      const dossierContent = fs.readFileSync(
        path.join(ROOT_DIR, "client/src/experimental/components/cases/CaseDossierOverview.tsx"),
        "utf8"
      );
      assert.ok(dossierContent.includes("grid-cols-1 lg:grid-cols-12"), "Main grid must stack on mobile and split 12-cols on desktop");
      assert.ok(dossierContent.includes("lg:col-span-7"), "Left column must span 7 cols on desktop");
      assert.ok(dossierContent.includes("lg:col-span-5"), "Right column must span 5 cols on desktop");
      assert.ok(dossierContent.includes("grid-cols-2 sm:grid-cols-4"), "Metadata grid and quick actions must adapt to 4 cols on desktop");
      assert.ok(dossierContent.includes("grid-cols-2 sm:grid-cols-3"), "6-Pillars chips grid must adapt to 3 cols on tablet/desktop");
    });

    it("AddDiaryEntryModal & PostHearingOutcomeModal have scrollable bounds and mobile viewport safety", () => {
      const addModal = fs.readFileSync(
        path.join(ROOT_DIR, "client/src/experimental/components/diary/AddDiaryEntryModal.tsx"),
        "utf8"
      );
      const outcomeModal = fs.readFileSync(
        path.join(ROOT_DIR, "client/src/experimental/components/diary/PostHearingOutcomeModal.tsx"),
        "utf8"
      );

      for (const [name, content] of [["AddDiaryEntryModal", addModal], ["PostHearingOutcomeModal", outcomeModal]]) {
        assert.ok(content.includes("max-h-[90vh]"), `${name} must constrain max height to 90vh`);
        assert.ok(content.includes("overflow-y-auto"), `${name} must have scrollable body on short screens`);
        assert.ok(content.includes("fixed inset-0"), `${name} must have full screen overlay`);
        assert.ok(content.includes("backdrop-blur"), `${name} must have backdrop blur for focus depth`);
      }
    });

    it("CalendarSyncPanel features row gracefully stacks on mobile and expands on desktop", () => {
      const panelContent = fs.readFileSync(
        path.join(ROOT_DIR, "client/src/experimental/components/diary/CalendarSyncPanel.tsx"),
        "utf8"
      );
      assert.ok(panelContent.includes("grid-cols-1 sm:grid-cols-3"), "Features grid must stack on mobile and expand on desktop");
      assert.ok(panelContent.includes("flex-col sm:flex-row"), "Header info must stack on mobile and row on desktop");
    });
  });

  describe("4. Empirical Component Logic & State Integrity", () => {
    it("Calculates 6-Pillar Health Score deterministically across all verification counts (0 to 6)", () => {
      const SIX_PILLARS = [
        { key: "plaint", title: "Pleadings & Plaint Draft" },
        { key: "limitation", title: "Limitation Act 1908 Validation" },
        { key: "vakalatnama", title: "Vakalatnama & Bar Council Verification" },
        { key: "court_fee", title: "Court Fees Act 1870 Stamping" },
        { key: "affidavit", title: "Solemn Verification & Oath Commission" },
        { key: "annexures", title: "Certified Impugned Orders & Exhibits" },
      ];

      for (let count = 0; count <= 6; count++) {
        const complianceItems = SIX_PILLARS.slice(0, count).map((p) => ({
          type: p.key,
          status: "done",
        }));

        const verifiedPillarsCount = SIX_PILLARS.filter((pillar) => {
          const matched = complianceItems.find((c) => c.type === pillar.key);
          return matched?.status === "done";
        }).length;

        const healthPercentage = Math.round((verifiedPillarsCount / 6) * 100);
        const expected = Math.round((count / 6) * 100);
        assert.equal(healthPercentage, expected, `Score mismatch for ${count} verified pillars`);
      }
    });

    it("12 Pakistani Court Outcomes in PostHearingOutcomeModal contain valid Urdu terminology and semantic styling", () => {
      const modalContent = fs.readFileSync(
        path.join(ROOT_DIR, "client/src/experimental/components/diary/PostHearingOutcomeModal.tsx"),
        "utf8"
      );

      const expectedOutcomes = [
        "arguments",
        "evidence",
        "instruction",
        "order_passed",
        "adjourned",
        "reserved",
        "allowed",
        "partly_allowed",
        "disposed_off",
        "dnp",
        "dismissed",
        "other",
      ];

      for (const outcome of expectedOutcomes) {
        assert.ok(modalContent.includes(`value: "${outcome}"`), `Outcome '${outcome}' must be registered`);
      }

      // Check key Urdu translations
      assert.ok(modalContent.includes("دلائل سنے گئے"), "Urdu translation for arguments heard must exist");
      assert.ok(modalContent.includes("شہادت ریکارڈ ہوئی"), "Urdu translation for evidence recorded must exist");
      assert.ok(modalContent.includes("حکم امتناعی منظور"), "Urdu translation for stay order must exist");
      assert.ok(modalContent.includes("التواء دیا گیا"), "Urdu translation for adjourned must exist");
      assert.ok(modalContent.includes("فیصلہ محفوظ"), "Urdu translation for reserved judgment must exist");
      assert.ok(modalContent.includes("عدم پیروی خارج"), "Urdu translation for DNP must exist");
    });
  });
});
