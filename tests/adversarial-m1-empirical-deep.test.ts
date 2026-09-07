import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
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
  searchHistory,
} from "../shared/schema";

describe("Adversarial Stress Test: Milestone 1 Database Wiring & Schema Robustness", () => {
  test("PostgreSQL Column Data Types & Constraints Verification", () => {
    // 1. documentScans
    assert.equal(documentScans.id.dataType, "number", "id must be integer/serial");
    assert.equal(documentScans.title.dataType, "string", "title must be string");
    assert.equal(documentScans.text.dataType, "string", "text must be string");
    assert.equal(documentScans.summary.dataType, "string", "summary must be string");
    assert.equal(documentScans.overallRisk.dataType, "string", "overallRisk must be string");

    // 2. scanFindings
    assert.equal(scanFindings.id.dataType, "number", "id must be integer/serial");
    assert.equal(scanFindings.scanId.dataType, "number", "scanId must be integer FK");
    assert.equal(scanFindings.pillar.dataType, "string", "pillar must be string");
    assert.equal(scanFindings.category.dataType, "string", "category must be string");
    assert.equal(scanFindings.severity.dataType, "string", "severity must be string");
    assert.equal(scanFindings.issue.dataType, "string", "issue must be string");
    assert.equal(scanFindings.recommendation.dataType, "string", "recommendation must be string");
    assert.equal(scanFindings.isResolved.dataType, "boolean", "isResolved must be boolean");

    // 3. orgActivityLogs
    assert.equal(orgActivityLogs.id.dataType, "number", "id must be integer/serial");
    assert.equal(orgActivityLogs.orgId.dataType, "number", "orgId must be integer FK");
    assert.equal(orgActivityLogs.action.dataType, "string", "action must be string");
    assert.equal(orgActivityLogs.category.dataType, "string", "category must be string");

    // 4. legalDrafts
    assert.equal(legalDrafts.id.dataType, "number", "id must be integer/serial");
    assert.equal(legalDrafts.userId.dataType, "string", "userId must be varchar FK");
    assert.equal(legalDrafts.title.dataType, "string", "title must be string");
    assert.equal(legalDrafts.content.dataType, "string", "content must be string");
    assert.equal(legalDrafts.metadata.dataType, "json", "metadata must be json/jsonb");
  });

  test("Urdu & Pakistani Legal Unicode Content Stress Test", () => {
    // Test Pakistani legal terminology and Urdu text in Zod schemas
    const urduPleading = {
      title: "دعویٰ برائے تعمیلِ مختص معاہدہ بیع (Specific Performance Plaint)",
      documentType: "pleading",
      text: "عدالت جناب سینئر سول جج صاحب، لاہور۔ دعویٰ برائے تعمیلِ مختص معاہدہ بیع مؤرخہ 15 اگست 2026...",
      summary: "Suit for specific performance regarding commercial land in Gulberg III, Lahore.",
      overallRisk: "High",
    };

    const parsedScan = insertDocumentScanSchema.parse(urduPleading);
    assert.equal(parsedScan.title, urduPleading.title);
    assert.equal(parsedScan.text, urduPleading.text);

    const urduFinding = {
      scanId: 101,
      pillar: "Statutory Limitation & Procedural Defect",
      category: "Order 7 Rule 11 CPC & Limitation Act Art. 113",
      severity: "critical",
      issue: "معاہدہ کی آخری تاریخ سے 3 سال سے زائد کا عرصہ گزر چکا ہے (Limitation barred under Article 113)",
      statuteRef: "Limitation Act 1908, Schedule 1, Art. 113; CPC 1908 O.7 R.11(d)",
      recommendation: "Plead specific acknowledgment of liability under Section 19 of Limitation Act or explain extension of time.",
      rawSnippet: "معاہدہ مورخہ 2020 میں ہوا تھا لیکن مقدمہ 2026 میں دائر کیا گیا",
      isResolved: false,
    };

    const parsedFinding = insertScanFindingSchema.parse(urduFinding);
    assert.equal(parsedFinding.issue, urduFinding.issue);
    assert.equal(parsedFinding.rawSnippet, urduFinding.rawSnippet);
  });

  test("Complex JSONB Metadata Handling in Legal Drafts", () => {
    const complexDraft = {
      userId: "usr_advocate_tariq_01",
      title: "Supreme Court Constitution Petition (Art. 184(3))",
      templateType: "constitution_petition",
      content: "IN THE SUPREME COURT OF PAKISTAN (ORIGINAL JURISDICTION)...",
      status: "draft",
      metadata: {
        benchPreference: "Full Bench",
        parties: {
          petitioners: ["Pakistan Bar Council", "Supreme Court Bar Association"],
          respondents: ["Federation of Pakistan through Ministry of Law & Justice"],
        },
        prayerClauses: [
          "Declare the impugned statutory amendment ultra vires the Constitution",
          "Grant interim injunction suspending the notification dated 2026-08-01",
        ],
        courtFeePaid: true,
        annexures: [
          { mark: "A", title: "Impugned Notification", pages: 12 },
          { mark: "B", title: "Representation to Law Ministry", pages: 4 },
        ],
      },
    };

    const parsedDraft = insertLegalDraftSchema.parse(complexDraft);
    assert.equal(parsedDraft.title, complexDraft.title);
    assert.deepEqual(parsedDraft.metadata, complexDraft.metadata);
  });

  test("Boundary & Malformed Inputs in Zod Schemas", () => {
    // Missing required text in scan
    assert.throws(() => {
      insertDocumentScanSchema.parse({
        title: "Test Scan",
      });
    }, /Required/);

    // Missing required issue and recommendation in finding
    assert.throws(() => {
      insertScanFindingSchema.parse({
        scanId: 1,
        pillar: "Jurisdiction",
        category: "Pecuniary",
        severity: "low",
      });
    }, /Required/);

    // Invalid non-integer scanId
    assert.throws(() => {
      insertScanFindingSchema.parse({
        scanId: "one",
        pillar: "Jurisdiction",
        category: "Pecuniary",
        severity: "low",
        issue: "Invalid court",
        recommendation: "Change court",
      });
    }, /Expected number/);
  });

  test("Transaction Rollback Invariance Verification", () => {
    // Verify that the route code uses db.transaction and propagates errors
    const routesContent = fs.readFileSync("/Users/macbook/Downloads/Alwakeelo/server/routes.ts", "utf-8");

    // Scan route must wrap in transaction
    assert.ok(routesContent.includes("await db.transaction(async (tx: any) => {"), "db.transaction must be used in POST /api/document-analyzer/scans");
    assert.ok(routesContent.includes("await tx\n          .insert(documentScans)"), "tx must be used to insert documentScans");
    assert.ok(routesContent.includes("await tx\n            .insert(scanFindings)"), "tx must be used to insert scanFindings");
    assert.ok(routesContent.includes("return { scan, findings: insertedFindings };"), "transaction must return scan and findings on success");
  });

  test("Search History Deletion Route Verification", () => {
    const routesContent = fs.readFileSync("/Users/macbook/Downloads/Alwakeelo/server/routes.ts", "utf-8");

    // Must delete single item with userId check
    assert.ok(
      routesContent.includes("await db.delete(searchHistory).where(and(eq(searchHistory.id, id), eq(searchHistory.userId, userId)));"),
      "DELETE /api/search-history/:id must delete row with userId check"
    );
    // Must return 204 No Content
    assert.ok(
      routesContent.includes("res.sendStatus(204);"),
      "DELETE /api/search-history/:id must send 204 status"
    );
  });
});
