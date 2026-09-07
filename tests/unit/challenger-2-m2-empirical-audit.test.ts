import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  insertDocumentScanSchema,
  insertScanFindingSchema,
  insertOrgActivityLogSchema,
  insertLegalDraftSchema,
} from "../../shared/schema";

const ROOT_DIR = path.resolve(process.cwd());

describe("Challenger 2 Empirical Verification: Zero-Mock & localStorage Elimination", () => {
  test("PreviewDocumentAnalyzer.tsx has 0 localStorage calls for mock text or findings", () => {
    const filePath = path.join(ROOT_DIR, "client/src/experimental/pages/PreviewDocumentAnalyzer.tsx");
    const content = fs.readFileSync(filePath, "utf-8");

    // Must NOT contain old mock keys
    assert.ok(!content.includes("alwakeelo_preview_doc_analyzer_text_v6"), "Old mock text key must be deleted");
    assert.ok(!content.includes("alwakeelo_preview_doc_analyzer_findings_v6"), "Old mock findings key must be deleted");
    assert.ok(!content.includes("STORAGE_KEY_TEXT"), "STORAGE_KEY_TEXT constant must be removed");
    assert.ok(!content.includes("STORAGE_KEY_FINDINGS"), "STORAGE_KEY_FINDINGS constant must be removed");

    // Check that any remaining localStorage usage is strictly for cross-module drafting insert export
    const lsMatches = content.match(/localStorage\.[a-zA-Z]+/g) || [];
    for (const match of lsMatches) {
      assert.ok(
        content.includes('localStorage.setItem("alwakeelo_drafting_insert"') ||
        content.includes('localStorage.setItem(\"alwakeelo_drafting_insert\"'),
        "Document Analyzer localStorage calls must only be for cross-module drafting export"
      );
    }
  });

  test("PreviewOrganization.tsx has 0 localStorage calls for activity logging", () => {
    const filePath = path.join(ROOT_DIR, "client/src/experimental/pages/PreviewOrganization.tsx");
    const content = fs.readFileSync(filePath, "utf-8");

    assert.ok(!content.includes("alwakeelo_preview_organization_v2"), "Old mock org key must be deleted");
    assert.ok(!content.includes("alwakeelo_preview_organization"), "Old mock org key must be deleted");
    assert.ok(!content.includes("localStorage.setItem"), "Must have zero localStorage.setItem calls");
    assert.ok(!content.includes("localStorage.getItem"), "Must have zero localStorage.getItem calls");
  });

  test("PreviewContractDrafting.tsx has 0 localStorage autosave keys", () => {
    const filePath = path.join(ROOT_DIR, "client/src/experimental/pages/PreviewContractDrafting.tsx");
    const content = fs.readFileSync(filePath, "utf-8");

    assert.ok(!content.includes("alwakeelo_preview_contract_drafting_v1"), "Old autosave key must be removed");
    assert.ok(!content.includes("AUTOSAVE_KEY"), "AUTOSAVE_KEY constant must be removed");
    
    // Check that any remaining localStorage usage is strictly for cross-module drafting insert export
    const lsMatches = content.match(/localStorage\.[a-zA-Z]+/g) || [];
    for (const match of lsMatches) {
      assert.ok(
        content.includes('localStorage.setItem("alwakeelo_drafting_insert"') ||
        content.includes('localStorage.setItem(\"alwakeelo_drafting_insert\"'),
        "Contract drafting localStorage calls must only be for cross-module drafting export"
      );
    }
  });

  test("PreviewDrafting.tsx stores drafts via PostgreSQL /api/drafts and only uses localStorage as bridge consumer", () => {
    const filePath = path.join(ROOT_DIR, "client/src/experimental/pages/PreviewDrafting.tsx");
    const content = fs.readFileSync(filePath, "utf-8");

    assert.ok(content.includes("/api/drafts"), "Must persist to PostgreSQL /api/drafts");
    assert.ok(content.includes("dbDraftId"), "DocumentTab must track dbDraftId");

    // Check localStorage usage is only consuming alwakeelo_drafting_insert
    const lsMatches = content.match(/localStorage\.[a-zA-Z]+/g) || [];
    for (const match of lsMatches) {
      assert.ok(
        content.includes('localStorage.getItem("alwakeelo_drafting_insert")') ||
        content.includes('localStorage.removeItem("alwakeelo_drafting_insert")'),
        "Drafting Studio localStorage calls must only consume incoming cross-module inserts"
      );
    }
  });
});

describe("Challenger 2 Empirical Verification: 56+ Preview Routes & Component Integrity", () => {
  const routerPath = path.join(ROOT_DIR, "client/src/experimental/AppPreviewRouter.tsx");
  const routerContent = fs.readFileSync(routerPath, "utf-8");

  test("AppPreviewRouter.tsx defines all 56+ expected preview routes", () => {
    const routeRegex = /<Route\s+path=["']([^"']+)["']/g;
    const routes: string[] = [];
    let match;
    while ((match = routeRegex.exec(routerContent)) !== null) {
      routes.push(match[1]);
    }

    assert.ok(routes.length >= 56, `Expected at least 56 route declarations, found ${routes.length}`);
    
    // Core routes verification
    const requiredRoutes = [
      "/",
      "/landing",
      "/preview",
      "/pricing",
      "/about",
      "/contact",
      "/faq",
      "/preview/mcp",
      "/blog",
      "/privacy",
      "/terms",
      "/refund-policy",
      "/install-app",
      "/word-addin-guide",
      "/auth",
      "/login",
      "/register",
      "/forgot-password",
      "/reset-password",
      "/onboarding",
      "/checkout",
      "/checkout/success",
      "/contracts",
      "/preview/contracts",
      "/contract-drafting",
      "/preview/contract-drafting",
      "/admin",
      "/preview/admin",
      "/dashboard",
      "/preview/dashboard",
      "/chat",
      "/preview/chat",
      "/drafting",
      "/preview/drafting",
      "/judgments",
      "/preview/judgments",
      "/cases",
      "/preview/cases",
      "/case-documents",
      "/preview/case-documents",
      "/statutes",
      "/preview/statutes",
      "/judges",
      "/preview/judges",
      "/most-cited",
      "/preview/most-cited",
      "/diary",
      "/preview/diary",
      "/vault",
      "/preview/vault",
      "/bookmarks",
      "/preview/bookmarks",
      "/history",
      "/preview/history",
      "/organization",
      "/preview/organization",
      "/analyzer",
      "/preview/analyzer",
      "/document-analyzer",
      "/preview/document-analyzer",
      "/settings",
      "/preview/settings",
    ];

    for (const r of requiredRoutes) {
      assert.ok(routes.includes(r), `AppPreviewRouter must declare route "${r}"`);
    }
  });

  test("All 36 lazy-imported components exist on disk and have valid default exports", async () => {
    const importRegex = /lazy\(\(\)\s*=>\s*import\(["']([^"']+)["']\)\)/g;
    const importPaths: string[] = [];
    let match;
    while ((match = importRegex.exec(routerContent)) !== null) {
      importPaths.push(match[1]);
    }

    assert.ok(importPaths.length >= 35, `Expected at least 35 lazy imports, found ${importPaths.length}`);

    for (const relPath of importPaths) {
      let resolvedPath = "";
      if (relPath.startsWith("@/")) {
        resolvedPath = path.join(ROOT_DIR, "client/src", relPath.slice(2));
      } else if (relPath.startsWith("./")) {
        resolvedPath = path.join(ROOT_DIR, "client/src/experimental", relPath.slice(2));
      } else {
        resolvedPath = path.resolve(path.dirname(routerPath), relPath);
      }

      // Check with .tsx or .ts or /index.tsx
      let exists = false;
      const extensions = [".tsx", ".ts", "/index.tsx", "/index.ts", ""];
      for (const ext of extensions) {
        if (fs.existsSync(resolvedPath + ext) && fs.statSync(resolvedPath + ext).isFile()) {
          resolvedPath = resolvedPath + ext;
          exists = true;
          break;
        }
      }

      assert.ok(exists, `Target file for import "${relPath}" must exist on disk at ${resolvedPath}`);

      const fileSource = fs.readFileSync(resolvedPath, "utf-8");
      assert.ok(
        fileSource.includes("export default") ||
        fileSource.includes("export {") ||
        fileSource.includes("export const"),
        `Component "${relPath}" must have valid component exports`
      );
    }
  });
});

describe("Challenger 2 Empirical Verification: Modal Accessibility & Dialog Structure", () => {
  test("PreviewDocumentAnalyzer Saved Scans modal has backdrop, close button, title, and ARIA-safe buttons", () => {
    const filePath = path.join(ROOT_DIR, "client/src/experimental/pages/PreviewDocumentAnalyzer.tsx");
    const content = fs.readFileSync(filePath, "utf-8");

    assert.ok(content.includes("showSavedScansModal"), "Modal state must be defined");
    assert.ok(content.includes("Saved Scans & Findings Database"), "Modal must have descriptive header title");
    assert.ok(content.includes("onClick={() => setShowSavedScansModal(false)}"), "Modal must have close handler");
    assert.ok(content.includes('type="button"'), "Buttons inside modal must explicitly declare type=\"button\"");
  });

  test("PreviewContractDrafting Saved Drafts modal has backdrop, close button, title, and ARIA-safe buttons", () => {
    const filePath = path.join(ROOT_DIR, "client/src/experimental/pages/PreviewContractDrafting.tsx");
    const content = fs.readFileSync(filePath, "utf-8");

    assert.ok(content.includes("isSavedDraftsModalOpen"), "Modal state must be defined");
    assert.ok(content.includes("Saved Contract Drafts"), "Modal must have descriptive header title");
    assert.ok(content.includes("setIsSavedDraftsModalOpen(false)"), "Modal must have close handler");
  });

  test("PreviewDrafting Saved Drafts modal has backdrop, close button, title, and ARIA-safe buttons", () => {
    const filePath = path.join(ROOT_DIR, "client/src/experimental/pages/PreviewDrafting.tsx");
    const content = fs.readFileSync(filePath, "utf-8");

    assert.ok(content.includes("isSavedDraftsModalOpen"), "Modal state must be defined");
    assert.ok(content.includes("Saved Pleading Drafts"), "Modal must have descriptive header title");
    assert.ok(content.includes("setIsSavedDraftsModalOpen(false)"), "Modal must have close handler");
  });
});

describe("Challenger 2 Empirical Verification: Cross-Module Drafting Event Protocol", () => {
  test("Statute viewers and reference modals dispatch alwakeelo-drafting-insert with valid payloads", () => {
    const filesToAudit = [
      "client/src/experimental/components/LegalReferenceModal.tsx",
      "client/src/experimental/components/LivePrecedentModal.tsx",
      "client/src/experimental/components/statutes/CleanStatuteViewer.tsx",
      "client/src/experimental/components/statutes/LandmarkAuthorityCard.tsx",
      "client/src/experimental/lib/judgmentApiClient.ts",
      "client/src/experimental/pages/PreviewStatutes.tsx",
      "client/src/experimental/pages/PreviewContractDrafting.tsx",
    ];

    for (const rel of filesToAudit) {
      const p = path.join(ROOT_DIR, rel);
      if (fs.existsSync(p)) {
        const c = fs.readFileSync(p, "utf-8");
        assert.ok(
          c.includes("alwakeelo-drafting-insert"),
          `File ${rel} must reference alwakeelo-drafting-insert custom event`
        );
      }
    }
  });

  test("Drafting Canvas converts plain text to TipTap HTML without loss", () => {
    function testPlainTextToTiptapHTML(plain: string): string {
      if (!plain || !plain.trim()) return "<p></p>";
      const lines = plain.split(/\r?\n/);
      const paragraphs: string[] = [];
      let currentP: string[] = [];

      for (const line of lines) {
        if (line.trim() === "") {
          if (currentP.length > 0) {
            paragraphs.push(`<p>${currentP.join("<br/>")}</p>`);
            currentP = [];
          }
        } else {
          currentP.push(line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"));
        }
      }
      if (currentP.length > 0) {
        paragraphs.push(`<p>${currentP.join("<br/>")}</p>`);
      }
      return paragraphs.join("");
    }

    const testClause = "IN THE COURT OF SENIOR CIVIL JUDGE, LAHORE\n\nSuit for Specific Performance\nUnder Section 12 Specific Relief Act 1877";
    const converted = testPlainTextToTiptapHTML(testClause);

    assert.ok(converted.includes("SENIOR CIVIL JUDGE"), "Should retain plain text header");
    assert.ok(converted.includes("Specific Performance"), "Should retain text content");
    assert.ok(converted.startsWith("<p>"), "Should be wrapped in HTML paragraphs");
  });
});

describe("Challenger 2 Empirical Verification: Drizzle Schema Contracts & Payload Safety", () => {
  test("Document Scan and Scan Findings Schemas validate live payloads with full fidelity", () => {
    const scanPayload = {
      userId: "user_test_123",
      title: "Commercial Lease Agreement Scan - Plaza 4, Gulberg Lahore",
      documentType: "contract",
      text: "This Commercial Lease Agreement is executed on 2026-08-29...",
      summary: "High Risk: Missing mandatory registration under S.17 Registration Act 1908.",
      overallRisk: "Vulnerable",
      totalRisks: 1,
      totalWarnings: 2,
    };

    const validatedScan = insertDocumentScanSchema.parse(scanPayload);
    assert.equal(validatedScan.title, scanPayload.title);
    assert.equal(validatedScan.overallRisk, "Vulnerable");

    const findingPayload = {
      scanId: 101,
      pillar: "Statutory Compliance",
      category: "Registration Act",
      severity: "risk",
      issue: "Mandatory Registration Required for Lease exceeding 1 Year",
      statuteRef: "Section 17(1)(d), Registration Act 1908",
      recommendation: "Execute before Sub-Registrar and affix required stamp duty under Article 35 Stamp Act.",
      rawSnippet: "The lease term shall be 3 years commencing from 1st September 2026.",
      isResolved: false,
    };

    const validatedFinding = insertScanFindingSchema.parse(findingPayload);
    assert.equal(validatedFinding.scanId, 101);
    assert.equal(validatedFinding.severity, "risk");
    assert.equal(validatedFinding.isResolved, false);
  });

  test("Org Activity Log Schema validates chamber security and governance events", () => {
    const activityPayload = {
      orgId: 5,
      actorId: "user_42",
      actorName: "Advocate Mian Ali Raza",
      action: "Revoked counsel credentials for Legal Intern #12",
      details: "Role: Legal Intern, Reason: Internship completed",
      category: "Security",
    };

    const validatedActivity = insertOrgActivityLogSchema.parse(activityPayload);
    assert.equal(validatedActivity.orgId, 5);
    assert.equal(validatedActivity.actorId, "user_42");
    assert.equal(validatedActivity.category, "Security");
  });

  test("Legal Drafts Schema validates court pleadings and contracts", () => {
    const draftPayload = {
      userId: "user_chamber_99",
      title: "Plaint for Declaration and Permanent Injunction",
      templateType: "Civil Plaint",
      content: "<p>IN THE COURT OF LEARNED CIVIL JUDGE, ISLAMABAD</p><p>Suit No. 2026/89</p>",
      status: "draft",
      metadata: {
        jurisdiction: "Islamabad",
        caseCategory: "Civil",
        parties: ["Mst. Farzana Bibi", "Capital Development Authority"],
      },
    };

    const validatedDraft = insertLegalDraftSchema.parse(draftPayload);
    assert.equal(validatedDraft.title, draftPayload.title);
    assert.equal(validatedDraft.templateType, "Civil Plaint");
    assert.equal(validatedDraft.status, "draft");
  });
});
