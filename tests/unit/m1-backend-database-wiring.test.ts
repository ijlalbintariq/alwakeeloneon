import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  documentScans,
  scanFindings,
  orgActivityLogs,
  legalDrafts,
  documentScansRelations,
  scanFindingsRelations,
  orgActivityLogsRelations,
  legalDraftsRelations,
  insertDocumentScanSchema,
  insertScanFindingSchema,
  insertOrgActivityLogSchema,
  insertLegalDraftSchema,
  type DocumentScan,
  type InsertDocumentScan,
  type ScanFinding,
  type InsertScanFinding,
  type OrgActivityLog,
  type InsertOrgActivityLog,
  type LegalDraft,
  type InsertLegalDraft,
  searchHistory,
} from "../../shared/schema";

describe("Milestone 1: PostgreSQL Drizzle Schema & Table Definitions", () => {
  test("document_scans table has all required columns and definitions", () => {
    assert.ok(documentScans, "documentScans table must be defined");
    assert.ok(documentScans.id, "id column must exist");
    assert.ok(documentScans.userId, "userId column must exist");
    assert.ok(documentScans.title, "title column must exist");
    assert.ok(documentScans.documentType, "documentType column must exist");
    assert.ok(documentScans.text, "text column must exist");
    assert.ok(documentScans.summary, "summary column must exist");
    assert.ok(documentScans.overallRisk, "overallRisk column must exist");
    assert.ok(documentScans.scanDate, "scanDate column must exist");
    assert.ok(documentScans.createdAt, "createdAt column must exist");
    assert.ok(documentScans.updatedAt, "updatedAt column must exist");
  });

  test("scan_findings table has all required columns and definitions", () => {
    assert.ok(scanFindings, "scanFindings table must be defined");
    assert.ok(scanFindings.id, "id column must exist");
    assert.ok(scanFindings.scanId, "scanId column must exist");
    assert.ok(scanFindings.pillar, "pillar column must exist");
    assert.ok(scanFindings.category, "category column must exist");
    assert.ok(scanFindings.severity, "severity column must exist");
    assert.ok(scanFindings.issue, "issue column must exist");
    assert.ok(scanFindings.statuteRef, "statuteRef column must exist");
    assert.ok(scanFindings.recommendation, "recommendation column must exist");
    assert.ok(scanFindings.rawSnippet, "rawSnippet column must exist");
    assert.ok(scanFindings.isResolved, "isResolved column must exist");
    assert.ok(scanFindings.createdAt, "createdAt column must exist");
  });

  test("org_activity_logs table has all required columns and definitions", () => {
    assert.ok(orgActivityLogs, "orgActivityLogs table must be defined");
    assert.ok(orgActivityLogs.id, "id column must exist");
    assert.ok(orgActivityLogs.orgId, "orgId column must exist");
    assert.ok(orgActivityLogs.action, "action column must exist");
    assert.ok(orgActivityLogs.details, "details column must exist");
    assert.ok(orgActivityLogs.actorId, "actorId column must exist");
    assert.ok(orgActivityLogs.actorName, "actorName column must exist");
    assert.ok(orgActivityLogs.category, "category column must exist");
    assert.ok(orgActivityLogs.createdAt, "createdAt column must exist");
  });

  test("legal_drafts table has all required columns and definitions", () => {
    assert.ok(legalDrafts, "legalDrafts table must be defined");
    assert.ok(legalDrafts.id, "id column must exist");
    assert.ok(legalDrafts.userId, "userId column must exist");
    assert.ok(legalDrafts.title, "title column must exist");
    assert.ok(legalDrafts.templateType, "templateType column must exist");
    assert.ok(legalDrafts.content, "content column must exist");
    assert.ok(legalDrafts.status, "status column must exist");
    assert.ok(legalDrafts.metadata, "metadata column must exist");
    assert.ok(legalDrafts.createdAt, "createdAt column must exist");
    assert.ok(legalDrafts.updatedAt, "updatedAt column must exist");
  });

  test("Drizzle relations are exported for all four tables", () => {
    assert.ok(documentScansRelations, "documentScansRelations must be defined");
    assert.ok(scanFindingsRelations, "scanFindingsRelations must be defined");
    assert.ok(orgActivityLogsRelations, "orgActivityLogsRelations must be defined");
    assert.ok(legalDraftsRelations, "legalDraftsRelations must be defined");
  });

  test("insert schemas validate correct payloads and reject invalid payloads", () => {
    // DocumentScan insert schema
    const validScan: InsertDocumentScan = {
      title: "Plaint for Specific Performance",
      documentType: "pleading",
      text: "IN THE COURT OF SENIOR CIVIL JUDGE, LAHORE...",
      summary: "Suit for specific performance of contract",
      overallRisk: "Medium",
    };
    const parsedScan = insertDocumentScanSchema.parse(validScan);
    assert.equal(parsedScan.title, validScan.title);
    assert.throws(() => insertDocumentScanSchema.parse({}));

    // ScanFinding insert schema
    const validFinding: InsertScanFinding = {
      scanId: 1,
      pillar: "Statutory Compliance",
      category: "Order 7 Rule 11 CPC",
      severity: "High",
      issue: "Cause of action not explicitly disclosed in plaint paragraph 4",
      statuteRef: "CPC 1908 O.7 R.11",
      recommendation: "Amend paragraph 4 to plead exact date and breach of contract",
      rawSnippet: "The defendant failed to perform.",
      isResolved: false,
    };
    const parsedFinding = insertScanFindingSchema.parse(validFinding);
    assert.equal(parsedFinding.pillar, validFinding.pillar);
    assert.throws(() => insertScanFindingSchema.parse({ scanId: "invalid" }));

    // OrgActivityLog insert schema
    const validLog: InsertOrgActivityLog = {
      orgId: 10,
      action: "Created Legal Draft",
      details: "Commercial Lease Agreement v1.0",
      actorId: "usr_123",
      actorName: "Advocate Tariq",
      category: "Drafting",
    };
    const parsedLog = insertOrgActivityLogSchema.parse(validLog);
    assert.equal(parsedLog.orgId, 10);
    assert.throws(() => insertOrgActivityLogSchema.parse({}));

    // LegalDraft insert schema
    const validDraft: InsertLegalDraft = {
      userId: "usr_123",
      title: "Commercial Lease Agreement",
      templateType: "commercial_lease",
      content: "This agreement is entered into on this 29th day of August 2026...",
      status: "draft",
      metadata: { jurisdiction: "Punjab", rentAmount: 150000 },
    };
    const parsedDraft = insertLegalDraftSchema.parse(validDraft);
    assert.equal(parsedDraft.title, validDraft.title);
    assert.throws(() => insertLegalDraftSchema.parse({}));
  });

  test("searchHistory table is exported and valid", () => {
    assert.ok(searchHistory, "searchHistory table must be defined");
    assert.ok(searchHistory.id, "id column must exist");
    assert.ok(searchHistory.userId, "userId column must exist");
  });
});

describe("Milestone 1: REST API Route Surface Verification", () => {
  test("server/routes.ts contains active routes for Document Scans, Org Activity, Legal Drafts, and Search History", async () => {
    const fs = await import("node:fs");
    const routesContent = fs.readFileSync("/Users/macbook/Downloads/Alwakeelo/server/routes.ts", "utf-8");

    // 1. Document Scans routes
    assert.ok(routesContent.includes('app.post("/api/document-analyzer/scans"'), "POST /api/document-analyzer/scans must be defined");
    assert.ok(routesContent.includes('app.get("/api/document-analyzer/scans"'), "GET /api/document-analyzer/scans must be defined");
    assert.ok(routesContent.includes('app.get("/api/document-analyzer/scans/:id"'), "GET /api/document-analyzer/scans/:id must be defined");
    assert.ok(routesContent.includes('app.delete("/api/document-analyzer/scans/:id"'), "DELETE /api/document-analyzer/scans/:id must be defined");

    // 2. Org Activity Logs routes
    assert.ok(routesContent.includes('app.get("/api/org/:id/activity"'), "GET /api/org/:id/activity must be defined");
    assert.ok(routesContent.includes('app.post("/api/org/:id/activity"'), "POST /api/org/:id/activity must be defined");

    // 3. Legal Drafts routes
    assert.ok(routesContent.includes('app.get("/api/drafts"'), "GET /api/drafts must be defined");
    assert.ok(routesContent.includes('app.get("/api/drafts/:id"'), "GET /api/drafts/:id must be defined");
    assert.ok(routesContent.includes('app.post("/api/drafts"'), "POST /api/drafts must be defined");
    assert.ok(routesContent.includes('app.patch("/api/drafts/:id"'), "PATCH /api/drafts/:id must be defined");
    assert.ok(routesContent.includes('app.delete("/api/drafts/:id"'), "DELETE /api/drafts/:id must be defined");

    // 4. Search History deletion active database query
    assert.ok(
      routesContent.includes("await db.delete(searchHistory).where(and(eq(searchHistory.id, id), eq(searchHistory.userId, userId)));"),
      "Search history DELETE :id must actively execute db.delete"
    );
    assert.ok(
      routesContent.includes("await db.delete(searchHistory).where(eq(searchHistory.userId, userId));"),
      "Search history DELETE clear all must actively execute db.delete"
    );
  });
});
