import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  insertDocumentScanSchema,
  insertScanFindingSchema,
  insertOrgActivityLogSchema,
  insertLegalDraftSchema,
  type DocumentScan,
  type ScanFinding,
  type OrgActivityLog,
  type LegalDraft,
} from "../../shared/schema";

const ROOT_DIR = path.resolve(process.cwd());

describe("Milestone 2: Document Analyzer Zero-Mock State Migration", () => {
  const analyzerFilePath = path.join(
    ROOT_DIR,
    "client/src/experimental/pages/PreviewDocumentAnalyzer.tsx"
  );
  const analyzerSource = fs.readFileSync(analyzerFilePath, "utf-8");

  test("PreviewDocumentAnalyzer eliminates localStorage text and findings keys", () => {
    assert.ok(
      !analyzerSource.includes('const STORAGE_KEY_TEXT = "alwakeelo_preview_doc_analyzer_text_v6"'),
      "STORAGE_KEY_TEXT must be removed from PreviewDocumentAnalyzer"
    );
    assert.ok(
      !analyzerSource.includes('const STORAGE_KEY_FINDINGS = "alwakeelo_preview_doc_analyzer_findings_v6"'),
      "STORAGE_KEY_FINDINGS must be removed from PreviewDocumentAnalyzer"
    );
    assert.ok(
      !analyzerSource.includes("localStorage.setItem(STORAGE_KEY_TEXT"),
      "localStorage.setItem for canvas text must be removed"
    );
  });

  test("PreviewDocumentAnalyzer integrates React Query and live /api/document-analyzer/scans API", () => {
    assert.ok(
      analyzerSource.includes("@tanstack/react-query"),
      "PreviewDocumentAnalyzer must import from @tanstack/react-query"
    );
    assert.ok(
      analyzerSource.includes('queryKey: ["/api/document-analyzer/scans"]'),
      "PreviewDocumentAnalyzer must query /api/document-analyzer/scans"
    );
    assert.ok(
      analyzerSource.includes('fetch("/api/document-analyzer/scans"'),
      "PreviewDocumentAnalyzer must fetch /api/document-analyzer/scans"
    );
    assert.ok(
      analyzerSource.includes("/api/document-analyzer/scans/"),
      "PreviewDocumentAnalyzer must support individual scan loading and deletion"
    );
  });

  test("Document Analyzer scan and findings Drizzle schema validates live payloads", () => {
    const scanPayload = {
      title: "Suit for Declaration & Injunction Scan",
      documentType: "pleading",
      text: "IN THE COURT OF SENIOR CIVIL JUDGE, LAHORE\nSuit No. 124 of 2026",
      summary: "Action Required procedural health. 2 statutory findings identified.",
      overallRisk: "Action Required",
    };

    const parsedScan = insertDocumentScanSchema.parse(scanPayload);
    assert.equal(parsedScan.title, scanPayload.title);
    assert.equal(parsedScan.overallRisk, "Action Required");

    const findingPayload = {
      scanId: 101,
      pillar: "Specific Relief Act",
      category: "Specific Relief Act 1877",
      severity: "risk",
      issue: "Absence of Section 24(c) readiness and willingness averment",
      statuteRef: "Section 24(c) Specific Relief Act 1877 & PLD 2021 SC 429",
      recommendation: "Plaintiff has always been ready and willing to perform the agreement.",
      rawSnippet: "Plaintiff approached defendant multiple times.",
      isResolved: false,
    };

    const parsedFinding = insertScanFindingSchema.parse(findingPayload);
    assert.equal(parsedFinding.scanId, 101);
    assert.equal(parsedFinding.severity, "risk");
  });
});

describe("Milestone 2: Organization Activity Logs Live React Query Migration", () => {
  const orgFilePath = path.join(
    ROOT_DIR,
    "client/src/experimental/pages/PreviewOrganization.tsx"
  );
  const orgSource = fs.readFileSync(orgFilePath, "utf-8");

  test("PreviewOrganization eliminates localStorage activity logging keys", () => {
    assert.ok(
      !orgSource.includes('const STORAGE_KEY = "alwakeelo_preview_organization"'),
      "STORAGE_KEY must be removed from PreviewOrganization"
    );
    assert.ok(
      !orgSource.includes('localStorage.setItem(STORAGE_KEY + "_activity"'),
      "localStorage activity logging must be removed"
    );
    assert.ok(
      !orgSource.includes('localStorage.setItem(STORAGE_KEY_V2 + "_activity"'),
      "localStorage v2 activity logging must be removed"
    );
  });

  test("PreviewOrganization queries and records activity via live /api/org/:id/activity backend", () => {
    assert.ok(
      orgSource.includes('queryKey: ["/api/org", orgId, "activity"]') ||
        orgSource.includes("queryKey: ['/api/org', orgId, 'activity']"),
      "PreviewOrganization must query /api/org/:id/activity with React Query"
    );
    assert.ok(
      orgSource.includes("logActivityMutation"),
      "PreviewOrganization must define logActivityMutation"
    );
    assert.ok(
      orgSource.includes("/api/org/${orgId}/activity") || orgSource.includes("/api/org/\" + orgId + \"/activity"),
      "PreviewOrganization must post activity logs to /api/org/:id/activity"
    );
  });

  test("Organization activity log schema validates chamber actions", () => {
    const inviteAction = {
      orgId: 1,
      action: "Dispatched invitation to Advocate Ali Khan (Associate Advocate)",
      details: "WP No. 4812/2026",
      actorName: "Advocate Ali Khan",
      category: "Roster",
    };

    const parsedLog = insertOrgActivityLogSchema.parse(inviteAction);
    assert.equal(parsedLog.orgId, 1);
    assert.equal(parsedLog.category, "Roster");

    const reassignAction = {
      orgId: 1,
      action: "Reallocated matter counsel for WP No. 4812/2026",
      details: "Lead Counsel: 1, Assisting Counsel: 2",
      category: "Pleadings",
    };

    const parsedReassign = insertOrgActivityLogSchema.parse(reassignAction);
    assert.equal(parsedReassign.action, reassignAction.action);
  });
});

describe("Milestone 2: Legal & Contract Drafting Studio Zero-Mock Migration", () => {
  const contractFilePath = path.join(
    ROOT_DIR,
    "client/src/experimental/pages/PreviewContractDrafting.tsx"
  );
  const contractSource = fs.readFileSync(contractFilePath, "utf-8");

  const draftingFilePath = path.join(
    ROOT_DIR,
    "client/src/experimental/pages/PreviewDrafting.tsx"
  );
  const draftingSource = fs.readFileSync(draftingFilePath, "utf-8");

  test("PreviewContractDrafting eliminates localStorage autosave key in favor of /api/drafts", () => {
    assert.ok(
      !contractSource.includes('const AUTOSAVE_KEY = "alwakeelo_preview_contract_drafting_v1"'),
      "AUTOSAVE_KEY must be removed from PreviewContractDrafting"
    );
    assert.ok(
      contractSource.includes('queryKey: ["/api/drafts"]'),
      "PreviewContractDrafting must query /api/drafts with React Query"
    );
    assert.ok(
      contractSource.includes('fetch("/api/drafts"'),
      "PreviewContractDrafting must persist drafts to POST /api/drafts"
    );
    assert.ok(
      contractSource.includes("/api/drafts/${activeDraftId}"),
      "PreviewContractDrafting must update drafts via PATCH /api/drafts/:id"
    );
  });

  test("PreviewDrafting integrates PostgreSQL /api/drafts persistence and tabs management", () => {
    assert.ok(
      draftingSource.includes('queryKey: ["/api/drafts"]'),
      "PreviewDrafting must query /api/drafts with React Query"
    );
    assert.ok(
      draftingSource.includes("saveDraftToDb"),
      "PreviewDrafting must define saveDraftToDb function"
    );
    assert.ok(
      draftingSource.includes("dbDraftId"),
      "DocumentTab must support dbDraftId for PostgreSQL persistence"
    );
    assert.ok(
      draftingSource.includes("handleLoadSavedDraft"),
      "PreviewDrafting must support loading saved drafts from PostgreSQL"
    );
  });

  test("TipTap custom event bridge alwakeelo-drafting-insert is preserved across drafting studios", () => {
    assert.ok(
      contractSource.includes("alwakeelo-drafting-insert"),
      "PreviewContractDrafting must maintain alwakeelo-drafting-insert event bridge"
    );
    assert.ok(
      draftingSource.includes("alwakeelo-drafting-insert"),
      "PreviewDrafting must maintain alwakeelo-drafting-insert event bridge"
    );
  });

  test("Legal draft schema validates contract and court pleading records", () => {
    const draftPayload = {
      userId: "user_test_123",
      title: "Commercial Lease Agreement - Gulberg Lahore",
      templateType: "Commercial Lease Agreement",
      content: "<h1>COMMERCIAL LEASE AGREEMENT</h1><p>This deed of lease is executed at Lahore...</p>",
      status: "draft",
      metadata: {
        category: "Real Estate & Tenancy",
        governingLaw: "Transfer of Property Act 1882",
      },
    };

    const parsedDraft = insertLegalDraftSchema.parse(draftPayload);
    assert.equal(parsedDraft.title, draftPayload.title);
    assert.equal(parsedDraft.userId, "user_test_123");
    assert.equal(parsedDraft.status, "draft");
  });
});

describe("Milestone 2: Experimental Route Surface & Integrity Audit", () => {
  const routerFilePath = path.join(
    ROOT_DIR,
    "client/src/experimental/AppPreviewRouter.tsx"
  );
  const routerSource = fs.readFileSync(routerFilePath, "utf-8");

  test("AppPreviewRouter configures all core litigation workstations and route aliases", () => {
    const expectedRoutes = [
      "/preview/analyzer",
      "/preview/contracts",
      "/preview/drafting",
      "/preview/organization",
      "/preview/chat",
      "/preview/judgments",
      "/preview/statutes",
      "/preview/cases",
      "/preview/diary",
      "/preview/bookmarks",
      "/preview/history",
      "/preview/settings",
      "/preview/admin",
    ];

    for (const route of expectedRoutes) {
      assert.ok(
        routerSource.includes(`path="${route}"`),
        `Router must contain route: ${route}`
      );
    }
  });

  test("AppPreviewRouter has fallback loader and wildcard redirects", () => {
    assert.ok(
      routerSource.includes("<FallbackLoader />"),
      "Router must render Suspense fallback loader"
    );
    assert.ok(
      routerSource.includes('path="/preview/*"'),
      "Router must catch unmatched preview routes"
    );
    assert.ok(
      routerSource.includes('path="*"'),
      "Router must have global fallback route"
    );
  });
});
