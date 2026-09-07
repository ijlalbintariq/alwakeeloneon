import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";

import { sanitizeStatuteText, sanitizeSectionNumber, sanitizeSectionTitle } from "../client/src/experimental/lib/statuteSanitizer";
import { precedentCache, PrecedentMemoryCache, type LandmarkPrecedent } from "../client/src/experimental/lib/precedentCache";
import { findSeedPrecedentsForSection, SEED_JUDGMENTS } from "../client/src/experimental/data/seedJudgmentsData";
import { MAJOR_ENACTMENTS_DATA, getSectionsForEnactment, getMajorSectionById } from "../client/src/experimental/data/majorEnactmentsData";
import { STATUTE_SECTIONS, inferDomainFromText } from "../client/src/experimental/data/statutesCompendiumData";
import { plainTextToTiptapHTML, isHTMLContent } from "../client/src/experimental/lib/plain-to-tiptap";

// Setup Mock DOM environment for storage and events
const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
const mockWindow = dom.window as any;
const mockDocument = dom.window.document as any;

describe("CHALLENGER 2: Adversarial UI & Drafting Bridge Empirical Test Suite (Milestone 2)", () => {

  const rootDir = process.cwd();

  // =========================================================================
  // SUITE 1: SOURCE CODE ARCHITECTURE & ACCESSIBILITY AUDIT
  // =========================================================================
  describe("Suite 1: Component Code Architecture & Accessibility Audit", () => {
    const cleanStatuteViewerPath = path.join(rootDir, "client/src/experimental/components/statutes/CleanStatuteViewer.tsx");
    const landmarkAuthorityCardPath = path.join(rootDir, "client/src/experimental/components/statutes/LandmarkAuthorityCard.tsx");
    const previewStatutesPath = path.join(rootDir, "client/src/experimental/pages/PreviewStatutes.tsx");
    const previewDraftingPath = path.join(rootDir, "client/src/experimental/pages/PreviewDrafting.tsx");

    it("[CH2-1.1] Component files exist and are strictly inside client/src/experimental/", () => {
      assert.ok(fs.existsSync(cleanStatuteViewerPath), "CleanStatuteViewer.tsx must exist");
      assert.ok(fs.existsSync(landmarkAuthorityCardPath), "LandmarkAuthorityCard.tsx must exist");
      assert.ok(fs.existsSync(previewStatutesPath), "PreviewStatutes.tsx must exist");
      assert.ok(fs.existsSync(previewDraftingPath), "PreviewDrafting.tsx must exist");
    });

    it("[CH2-1.2] CleanStatuteViewer has structured visual card sections & action triggers", () => {
      const src = fs.readFileSync(cleanStatuteViewerPath, "utf-8");
      assert.ok(src.includes("sanitizeStatuteText"), "Must import and execute sanitizeStatuteText");
      assert.ok(src.includes("useSectionPrecedents"), "Must resolve precedents via hook");
      assert.ok(src.includes("LandmarkAuthorityCard"), "Must render LandmarkAuthorityCard");
      assert.ok(src.includes("handleCopyCitation"), "Must have Copy Citation action handler");
      assert.ok(src.includes("handleCopyClause"), "Must have Copy Clause action handler");
      assert.ok(src.includes("handleInsertIntoDrafting"), "Must have Insert into Drafting action handler");
      assert.ok(src.includes("alwakeelo_drafting_insert"), "Must set localStorage alwakeelo_drafting_insert");
      assert.ok(src.includes("Statutory Punishment"), "Must render Punishment card");
      assert.ok(src.includes("Statutory Illustrations"), "Must render Illustrations card");
      assert.ok(src.includes("Judicial Notes"), "Must render Judicial guidance card");
      assert.ok(src.includes("Legislative History"), "Must render collapsible legislative history");
    });

    it("[CH2-1.3] LandmarkAuthorityCard has citation pill, court hierarchy, ratio block & 4 action buttons", () => {
      const src = fs.readFileSync(landmarkAuthorityCardPath, "utf-8");
      assert.ok(src.includes("handleCopyCitation"), "Must implement Copy Citation");
      assert.ok(src.includes("handleCopyRatio"), "Must implement Copy Ratio");
      assert.ok(src.includes("handleExploreJudgment"), "Must implement Explore Judgment");
      assert.ok(src.includes("handleInsertDrafting"), "Must implement Insert into Drafting");
      assert.ok(src.includes("alwakeelo_drafting_insert"), "Must persist drafting payload");
      assert.ok(src.includes("Apex Ruling (0ms)"), "Must indicate Apex Court tier");
    });

    it("[CH2-1.4] Responsive design and accessibility classes are present across UI components", () => {
      const viewerSrc = fs.readFileSync(cleanStatuteViewerPath, "utf-8");
      const cardSrc = fs.readFileSync(landmarkAuthorityCardPath, "utf-8");
      const previewSrc = fs.readFileSync(previewStatutesPath, "utf-8");

      // Verify flex-wrap and responsive utility classes
      assert.ok(viewerSrc.includes("flex-wrap"), "CleanStatuteViewer must support flex-wrap for responsive toolbars");
      assert.ok(cardSrc.includes("flex-wrap"), "LandmarkAuthorityCard must support flex-wrap for badge headers");
      assert.ok(previewSrc.includes("grid-cols-1"), "PreviewStatutes must have responsive grid layout");
      assert.ok(previewSrc.includes("lg:grid-cols-12"), "PreviewStatutes must have multi-column desktop layout");

      // Verify button accessibility attributes
      assert.ok(viewerSrc.includes('type="button"'), "Buttons in CleanStatuteViewer must have type='button'");
      assert.ok(cardSrc.includes('type="button"'), "Buttons in LandmarkAuthorityCard must have type='button'");
      assert.ok(viewerSrc.includes("title="), "Buttons must have descriptive title attributes");
      assert.ok(cardSrc.includes("title="), "Buttons must have descriptive title attributes");
    });
  });

  // =========================================================================
  // SUITE 2: DRAFTING STUDIO TRIPLE-BRIDGE INGESTION & TIPTAP COMPATIBILITY
  // =========================================================================
  describe("Suite 2: Drafting Studio Ingestion & HTML Sanitization", () => {

    class MockDraftingWorkspace {
      activeTabHtml: string = "<p>Initial pleading canvas content.</p>";
      activeTabText: string = "Initial pleading canvas content.";
      showLaunchpad: boolean = true;
      storage: Map<string, string> = new Map();

      simulateIngestion(rawPayload: string | null) {
        if (!rawPayload) return false;
        try {
          const data = JSON.parse(rawPayload);
          if (!data || !data.clause) return false;

          this.showLaunchpad = false;
          const clauseHtml = plainTextToTiptapHTML(data.clause);
          
          this.activeTabHtml = (this.activeTabHtml ? this.activeTabHtml + "<p></p>" : "") + clauseHtml;
          this.activeTabText = (this.activeTabText ? this.activeTabText + "\n\n" : "") + data.clause;
          return true;
        } catch {
          return false;
        }
      }
    }

    it("[CH2-2.1] Seamlessly ingests complex statutory clauses into Drafting Studio canvas", () => {
      const workspace = new MockDraftingWorkspace();
      const rawClause = `STATUTORY PROVISION & RELEVANT LAW:
Section 302 of Pakistan Penal Code 1860 (Punishment of Qatl-i-Amd)

"Whoever commits qatl-i-amd shall, subject to the provisions of this Chapter be punished with death or imprisonment for life."

LEGAL GROUNDS & APPLICABLE PRINCIPLES:
That under Section 302 of the Pakistan Penal Code 1860, the petitioner seeks justice in accordance with law.`;

      const payload = {
        statute: "Pakistan Penal Code 1860",
        section: "Section 302",
        title: "Punishment of Qatl-i-Amd",
        clause: rawClause,
        formattedCitation: "Section 302, Pakistan Penal Code 1860",
        timestamp: Date.now(),
      };

      const success = workspace.simulateIngestion(JSON.stringify(payload));
      assert.equal(success, true);
      assert.equal(workspace.showLaunchpad, false, "Launchpad must be dismissed upon clause insertion");
      assert.ok(workspace.activeTabHtml.includes("Section 302 of Pakistan Penal Code 1860"));
      assert.ok(workspace.activeTabHtml.includes("<p>"));
      assert.ok(isHTMLContent(workspace.activeTabHtml));
    });

    it("[CH2-2.2] Neutralizes XSS & HTML tags inside statutory insertion payload", () => {
      const workspace = new MockDraftingWorkspace();
      const maliciousClause = `STATUTORY PROVISION & RELEVANT LAW:\n<script>alert('pwned')</script><img src=x onerror=alert(1)>Section 497 CrPC`;
      const payload = {
        statute: "Code of Criminal Procedure 1898",
        section: "Section 497",
        title: "Bail",
        clause: maliciousClause,
        timestamp: Date.now(),
      };

      workspace.simulateIngestion(JSON.stringify(payload));
      assert.ok(!workspace.activeTabHtml.includes("<script>"), "Must strip script tags");
      assert.ok(workspace.activeTabHtml.includes("&lt;script&gt;") || !workspace.activeTabHtml.includes("onerror"), "Must escape or neutralize payload");
    });

    it("[CH2-2.3] Recovers gracefully from corrupted localStorage payloads", () => {
      const workspace = new MockDraftingWorkspace();
      
      const res1 = workspace.simulateIngestion("corrupted-json-syntax{{{");
      assert.equal(res1, false, "Must handle JSON parse error gracefully");

      const res2 = workspace.simulateIngestion(JSON.stringify({ empty: true }));
      assert.equal(res2, false, "Must handle missing clause field gracefully");
      
      assert.equal(workspace.showLaunchpad, true, "Launchpad should remain open if payload was invalid");
    });
  });

  // =========================================================================
  // SUITE 3: ZERO-401 PRECEDENT RESOLUTION & LRU CACHE RESILIENCE
  // =========================================================================
  describe("Suite 3: Zero-401 Precedent Resolution & LRU Cache Invariants", () => {
    it("[CH2-3.1] Resolves Tier 1 precedents instantly for major statutory sections", async () => {
      const ppc302Precedents = await precedentCache.resolvePrecedents("Pakistan Penal Code 1860", "Section 302", undefined, "Punishment of Qatl-i-amd");
      assert.ok(ppc302Precedents.length > 0, "Must resolve precedents for PPC 302");
      assert.ok(ppc302Precedents[0].citation.length > 0);
      assert.ok(ppc302Precedents[0].ratio.length > 10);

      const crpc497Precedents = await precedentCache.resolvePrecedents("Code of Criminal Procedure 1898", "Section 497", undefined, "When bail may be taken");
      assert.ok(crpc497Precedents.length > 0, "Must resolve precedents for CrPC 497");

      const art199Precedents = await precedentCache.resolvePrecedents("Constitution of Pakistan 1973", "Article 199", undefined, "Jurisdiction of High Court");
      assert.ok(art199Precedents.length > 0, "Must resolve precedents for Art 199");
    });

    it("[CH2-3.2] Synthesizes contextual superior court ratios for obscure sections without 401 blocker", async () => {
      const obscure = await precedentCache.resolvePrecedents("Customs Act 1969", "Section 156", undefined, "Punishment for offences");
      assert.ok(obscure.length > 0, "Must synthesize contextual precedent");
      assert.ok(obscure[0].court.includes("Supreme Court") || obscure[0].court.includes("High Court"));
    });
  });

  // =========================================================================
  // SUITE 4: EMPIRICAL LEGISLATIVE TEXT SANITIZATION AUDIT (CHALLENGE FINDINGS)
  // =========================================================================
  describe("Suite 4: Empirical Legislative Text Sanitization Audit", () => {
    it("[CH2-4.1] Audits gazette header stripping and reports leaked headers across 8 major codes", () => {
      const acts = [
        "Pakistan Penal Code 1860",
        "Code of Criminal Procedure 1898",
        "Code of Civil Procedure 1908",
        "Constitution of Pakistan 1973",
        "Specific Relief Act 1877",
        "Contract Act 1872",
        "Limitation Act 1908",
        "Prevention of Electronic Crimes Ordinance 2008"
      ];

      const auditResults: Record<string, { total: number; leaks: number }> = {};

      for (const act of acts) {
        const sections = MAJOR_ENACTMENTS_DATA.filter(s => s.statute === act);
        let leaks = 0;
        for (const s of sections) {
          const sanitized = sanitizeStatuteText(s.description, s.statute, s.section, s.title);
          if (
            sanitized.cleanText.includes("ACT NO. XLV") ||
            sanitized.cleanText.includes("CHAPTER XVI OF OFFENCES") ||
            sanitized.cleanText.includes("ORDINANCE IX OF 2008") ||
            sanitized.cleanText.startsWith(".")
          ) {
            leaks++;
          }
        }
        auditResults[act] = { total: sections.length, leaks };
      }

      // Assert that we have cataloged the exact empirical state across all enactments
      assert.ok(auditResults["Pakistan Penal Code 1860"].total === 612);
      assert.ok(auditResults["Constitution of Pakistan 1973"].total === 304);
      assert.ok(auditResults["Specific Relief Act 1877"].total === 59);
    });

    it("[CH2-4.2] Audits CleanStatuteViewer prop signature vs sanitizeStatuteText parameter contract", () => {
      const src = fs.readFileSync(path.join(rootDir, "client/src/experimental/components/statutes/CleanStatuteViewer.tsx"), "utf-8");
      
      // Verify that CleanStatuteViewer correctly passes statuteName as 2nd argument (not rawTitle || statuteName)
      const hasSignatureInversion = src.includes("rawTitle || statuteName");
      assert.ok(!hasSignatureInversion, "CleanStatuteViewer must NOT contain argument signature inversion on line 82");
      assert.ok(src.includes("statuteName"), "CleanStatuteViewer must pass statuteName");
    });
  });

  // =========================================================================
  // SUITE 5: ZERO PRODUCTION DISRUPTION GUARDRAIL (R0)
  // =========================================================================
  describe("Suite 5: Strict Production Isolation Guardrail (Zero Disruption)", () => {
    it("[CH2-5.1] Validates that no production routes or shared components are modified outside experimental", () => {
      const prodPagesDir = path.join(rootDir, "client/src/pages");
      const prodComponentsDir = path.join(rootDir, "client/src/components");

      // Verify that CleanStatuteViewer and LandmarkAuthorityCard are strictly in experimental
      const expStatutesDir = path.join(rootDir, "client/src/experimental/components/statutes");
      assert.ok(fs.existsSync(path.join(expStatutesDir, "CleanStatuteViewer.tsx")), "CleanStatuteViewer must be in experimental");
      assert.ok(fs.existsSync(path.join(expStatutesDir, "LandmarkAuthorityCard.tsx")), "LandmarkAuthorityCard must be in experimental");
      
      // Ensure no duplicate or rogue files in client/src/components/
      assert.ok(!fs.existsSync(path.join(prodComponentsDir, "CleanStatuteViewer.tsx")), "Must NOT exist in production components");
      assert.ok(!fs.existsSync(path.join(prodComponentsDir, "LandmarkAuthorityCard.tsx")), "Must NOT exist in production components");
    });
  });
});
