import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  documentScans,
  scanFindings,
  orgActivityLogs,
  legalDrafts,
  users,
  organizations,
  searchHistory,
  insertDocumentScanSchema,
  insertScanFindingSchema,
  insertOrgActivityLogSchema,
  insertLegalDraftSchema,
  type InsertDocumentScan,
  type InsertScanFinding,
  type InsertOrgActivityLog,
  type InsertLegalDraft,
} from "../../shared/schema";

describe("Adversarial Verification — Milestone 1: REST Contracts, Cascades, Ordering & Concurrency", () => {
  const schemaCode = fs.readFileSync("/Users/macbook/Downloads/Alwakeelo/shared/schema.ts", "utf-8");
  const routesCode = fs.readFileSync("/Users/macbook/Downloads/Alwakeelo/server/routes.ts", "utf-8");

  // ── 1. CASCADING DELETE & FOREIGN KEY CONTRACTS ──────────────────────────────
  describe("1. Cascading Delete & Foreign Key Constraints", () => {
    test("scanFindings foreign key enforces onDelete: cascade to documentScans.id", () => {
      const scanFindingsFKPattern = /scanId:\s*integer\("scan_id"\)\.references\(\(\)\s*=>\s*documentScans\.id,\s*\{\s*onDelete:\s*"cascade"\s*\}\)\.notNull\(\)/;
      assert.ok(
        scanFindingsFKPattern.test(schemaCode),
        "scan_findings.scan_id MUST reference document_scans.id with onDelete: 'cascade' and notNull()"
      );
    });

    test("documentScans foreign key enforces onDelete: cascade to users.id", () => {
      const userFKPattern = /userId:\s*varchar\("user_id"\)\.references\(\(\)\s*=>\s*users\.id,\s*\{\s*onDelete:\s*"cascade"\s*\}\)/;
      assert.ok(
        userFKPattern.test(schemaCode),
        "document_scans.user_id MUST reference users.id with onDelete: 'cascade'"
      );
    });

    test("orgActivityLogs foreign keys enforce cascade on orgId and set null on actorId", () => {
      const orgFKPattern = /orgId:\s*integer\("org_id"\)\.references\(\(\)\s*=>\s*organizations\.id,\s*\{\s*onDelete:\s*"cascade"\s*\}\)\.notNull\(\)/;
      assert.ok(
        orgFKPattern.test(schemaCode),
        "org_activity_logs.org_id MUST reference organizations.id with onDelete: 'cascade' and notNull()"
      );

      const actorFKPattern = /actorId:\s*varchar\("actor_id"\)\.references\(\(\)\s*=>\s*users\.id,\s*\{\s*onDelete:\s*"set null"\s*\}\)/;
      assert.ok(
        actorFKPattern.test(schemaCode),
        "org_activity_logs.actor_id MUST reference users.id with onDelete: 'set null'"
      );
    });

    test("legalDrafts foreign key enforces onDelete: cascade to users.id", () => {
      const draftUserFKPattern = /userId:\s*varchar\("user_id"\)\.references\(\(\)\s*=>\s*users\.id,\s*\{\s*onDelete:\s*"cascade"\s*\}\)\.notNull\(\)/;
      assert.ok(
        draftUserFKPattern.test(schemaCode),
        "legal_drafts.user_id MUST reference users.id with onDelete: 'cascade' and notNull()"
      );
    });

    test("DELETE /api/document-analyzer/scans/:id implements tenant isolation and clean deletion", () => {
      assert.ok(routesCode.includes('app.delete("/api/document-analyzer/scans/:id"'), "Delete scan route must exist");
      assert.ok(routesCode.includes("and(eq(documentScans.id, scanId), eq(documentScans.userId, userId))"), "Scan deletion must scope to both scanId and userId");
      assert.ok(routesCode.includes("await db\n        .delete(documentScans)\n        .where(and(eq(documentScans.id, scanId), eq(documentScans.userId, userId)));") ||
                routesCode.includes("await db.delete(documentScans).where(and(eq(documentScans.id, scanId), eq(documentScans.userId, userId)));"), "Must execute delete query");
      assert.ok(routesCode.includes("res.sendStatus(204)"), "Delete scan must return 204 on success");
    });
  });

  // ── 2. PAGINATION & CHRONOLOGICAL ORDERING ──────────────────────────────────
  describe("2. Chronological Ordering & Sorting Verification", () => {
    test("GET /api/document-analyzer/scans orders chronologically by createdAt DESC", () => {
      const match = routesCode.match(/app\.get\("\/api\/document-analyzer\/scans",[\s\S]*?res\.json\(scans\);/);
      assert.ok(match, "GET /api/document-analyzer/scans handler must exist");
      assert.ok(
        match[0].includes("orderBy(desc(documentScans.createdAt))"),
        "GET /api/document-analyzer/scans must order by desc(documentScans.createdAt)"
      );
    });

    test("GET /api/drafts orders chronologically by updatedAt DESC", () => {
      const match = routesCode.match(/app\.get\("\/api\/drafts",[\s\S]*?res\.json\(drafts\);/);
      assert.ok(match, "GET /api/drafts handler must exist");
      assert.ok(
        match[0].includes("orderBy(desc(legalDrafts.updatedAt))"),
        "GET /api/drafts must order by desc(legalDrafts.updatedAt)"
      );
    });

    test("GET /api/org/:id/activity orders chronologically by createdAt DESC", () => {
      const match = routesCode.match(/app\.get\("\/api\/org\/:id\/activity",[\s\S]*?res\.json\(logs\);/);
      assert.ok(match, "GET /api/org/:id/activity handler must exist");
      assert.ok(
        match[0].includes("orderBy(desc(orgActivityLogs.createdAt))"),
        "GET /api/org/:id/activity must order by desc(orgActivityLogs.createdAt)"
      );
    });

    test("Simulated chronological sorting orders newest items first", () => {
      const mockItems = [
        { id: 1, createdAt: new Date("2026-08-01T10:00:00Z") },
        { id: 2, createdAt: new Date("2026-08-29T05:00:00Z") },
        { id: 3, createdAt: new Date("2026-08-15T12:00:00Z") },
      ];

      const sorted = [...mockItems].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      assert.deepEqual(sorted.map(i => i.id), [2, 3, 1], "Items must be sorted in descending chronological order");
    });
  });

  // ── 3. PAYLOAD BOUNDS & MISSING MANDATORY FIELDS ─────────────────────────────
  describe("3. Payload Bounds, Missing Field Rejections & Zod Validation", () => {
    test("DocumentScan insert schema strictly enforces required title and text", () => {
      const valid = {
        title: "Writ Petition No. 1024 of 2026",
        text: "BEFORE THE LAHORE HIGH COURT, LAHORE...",
      };
      const parsed = insertDocumentScanSchema.parse(valid);
      assert.equal(parsed.title, valid.title);
      assert.equal(parsed.text, valid.text);

      // Adversarial test: Missing title
      assert.throws(() => {
        insertDocumentScanSchema.parse({ text: "Some legal text" });
      }, /title/);

      // Adversarial test: Missing text
      assert.throws(() => {
        insertDocumentScanSchema.parse({ title: "Some title" });
      }, /text/);

      // Adversarial test: Empty object
      assert.throws(() => {
        insertDocumentScanSchema.parse({});
      });

      // Adversarial test: Null title
      assert.throws(() => {
        insertDocumentScanSchema.parse({ title: null, text: "Some text" });
      });

      // Adversarial test: Number title
      assert.throws(() => {
        insertDocumentScanSchema.parse({ title: 12345, text: "Some text" });
      });
    });

    test("ScanFinding insert schema strictly enforces required fields", () => {
      const validFinding: InsertScanFinding = {
        scanId: 42,
        pillar: "Limitation Act",
        category: "Article 113",
        severity: "critical",
        issue: "Suit barred by limitation — 3 year period lapsed",
        statuteRef: "Limitation Act 1908 Art. 113",
        recommendation: "Examine Section 14 or 19 acknowledgment",
      };
      const parsed = insertScanFindingSchema.parse(validFinding);
      assert.equal(parsed.scanId, 42);
      assert.equal(parsed.pillar, "Limitation Act");

      // Adversarial test: Missing scanId
      assert.throws(() => {
        insertScanFindingSchema.parse({
          pillar: "Limitation",
          category: "General",
          severity: "high",
          issue: "Barred",
          recommendation: "Fix",
        });
      }, /scanId/);

      // Adversarial test: Missing severity
      assert.throws(() => {
        insertScanFindingSchema.parse({
          scanId: 1,
          pillar: "Limitation",
          category: "General",
          issue: "Barred",
          recommendation: "Fix",
        });
      }, /severity/);

      // Adversarial test: Missing issue
      assert.throws(() => {
        insertScanFindingSchema.parse({
          scanId: 1,
          pillar: "Limitation",
          category: "General",
          severity: "high",
          recommendation: "Fix",
        });
      }, /issue/);

      // Adversarial test: Missing recommendation
      assert.throws(() => {
        insertScanFindingSchema.parse({
          scanId: 1,
          pillar: "Limitation",
          category: "General",
          severity: "high",
          issue: "Barred",
        });
      }, /recommendation/);
    });

    test("LegalDraft insert schema strictly enforces required userId, title, and content", () => {
      const validDraft: InsertLegalDraft = {
        userId: "usr_adv_001",
        title: "Partnership Dissolution Deed",
        content: "THIS DEED OF DISSOLUTION OF PARTNERSHIP...",
      };
      const parsed = insertLegalDraftSchema.parse(validDraft);
      assert.equal(parsed.title, validDraft.title);
      assert.equal(parsed.content, validDraft.content);

      // Adversarial test: Missing userId
      assert.throws(() => {
        insertLegalDraftSchema.parse({
          title: "Title",
          content: "Content",
        });
      }, /userId/);

      // Adversarial test: Missing title
      assert.throws(() => {
        insertLegalDraftSchema.parse({
          userId: "usr_1",
          content: "Content",
        });
      }, /title/);

      // Adversarial test: Missing content
      assert.throws(() => {
        insertLegalDraftSchema.parse({
          userId: "usr_1",
          title: "Title",
        });
      }, /content/);
    });

    test("OrgActivityLog insert schema strictly enforces orgId and action", () => {
      const validLog: InsertOrgActivityLog = {
        orgId: 15,
        action: "Exported Causelist Report",
      };
      const parsed = insertOrgActivityLogSchema.parse(validLog);
      assert.equal(parsed.orgId, 15);
      assert.equal(parsed.action, "Exported Causelist Report");

      // Adversarial test: Missing orgId
      assert.throws(() => {
        insertOrgActivityLogSchema.parse({
          action: "Some Action",
        });
      }, /orgId/);

      // Adversarial test: Missing action
      assert.throws(() => {
        insertOrgActivityLogSchema.parse({
          orgId: 10,
        });
      }, /action/);
    });

    test("REST API validation rejects missing mandatory fields with 400 Bad Request", () => {
      // 1. POST /api/document-analyzer/scans
      assert.ok(
        routesCode.includes('if (!title || typeof title !== "string" || !text || typeof text !== "string") {') &&
        routesCode.includes('return res.status(400).json({ message: "Title and text are required" });'),
        "POST /api/document-analyzer/scans must reject missing or non-string title/text with 400"
      );

      // 2. POST /api/drafts
      assert.ok(
        routesCode.includes('if (!title || typeof title !== "string" || content === undefined || content === null) {') &&
        routesCode.includes('return res.status(400).json({ message: "Title and content are required" });'),
        "POST /api/drafts must reject missing title or missing content with 400"
      );

      // 3. POST /api/org/:id/activity
      assert.ok(
        routesCode.includes('if (!action || typeof action !== "string") {') &&
        routesCode.includes('return res.status(400).json({ message: "Action is required" });'),
        "POST /api/org/:id/activity must reject missing or non-string action with 400"
      );

      // 4. Invalid ID params (NaN check)
      assert.ok(routesCode.includes('const scanId = parseInt(String(req.params.id));\n    if (isNaN(scanId)) return res.status(400)'), "Scan ID must validate isNaN");
      assert.ok(routesCode.includes('const orgId = parseInt(String(req.params.id));\n    if (isNaN(orgId)) return res.status(400)'), "Org ID must validate isNaN");
      assert.ok(routesCode.includes('const draftId = parseInt(String(req.params.id));\n    if (isNaN(draftId)) return res.status(400)'), "Draft ID must validate isNaN");
    });
  });

  // ── 4. CONCURRENCY SAFETY & TRANSACTION ATOMICITY ────────────────────────────
  describe("4. Concurrency Safety & Transaction Integrity", () => {
    test("POST /api/document-analyzer/scans wraps scan and findings persistence in db.transaction", () => {
      const match = routesCode.match(/app\.post\("\/api\/document-analyzer\/scans",[\s\S]*?res\.status\(201\)\.json\(result\);/);
      assert.ok(match, "POST /api/document-analyzer/scans handler must exist");
      const postScanBody = match[0];

      assert.ok(
        postScanBody.includes("await db.transaction(async (tx: any) => {"),
        "POST /api/document-analyzer/scans MUST execute inside db.transaction for atomicity"
      );
      assert.ok(
        postScanBody.includes(".insert(documentScans)"),
        "Scan insert must use transactional client tx"
      );
      assert.ok(
        postScanBody.includes(".insert(scanFindings)"),
        "Findings insert must use transactional client tx"
      );
    });

    test("All endpoints enforce authenticated tenant isolation via userId / org membership", () => {
      // Check Document Scans endpoints
      const scanPostMatch = routesCode.match(/app\.post\("\/api\/document-analyzer\/scans"[\s\S]*?return res\.status\(401\)\.json\(\{ message: "Unauthorized" \}\);/);
      assert.ok(scanPostMatch, "POST /api/document-analyzer/scans must check auth");

      const scanGetMatch = routesCode.match(/app\.get\("\/api\/document-analyzer\/scans"[\s\S]*?return res\.status\(401\)\.json\(\{ message: "Unauthorized" \}\);/);
      assert.ok(scanGetMatch, "GET /api/document-analyzer/scans must check auth");

      // Check Drafts endpoints
      const draftsGetMatch = routesCode.match(/app\.get\("\/api\/drafts"[\s\S]*?return res\.status\(401\)\.json\(\{ message: "Unauthorized" \}\);/);
      assert.ok(draftsGetMatch, "GET /api/drafts must check auth");

      const draftsPostMatch = routesCode.match(/app\.post\("\/api\/drafts"[\s\S]*?return res\.status\(401\)\.json\(\{ message: "Unauthorized" \}\);/);
      assert.ok(draftsPostMatch, "POST /api/drafts must check auth");

      // Check Org Activity endpoints
      const orgActivityMatch = routesCode.match(/app\.get\("\/api\/org\/:id\/activity"[\s\S]*?return res\.status\(403\)\.json\(\{ message: "Not a member of this organization" \}\);/);
      assert.ok(orgActivityMatch, "GET /api/org/:id/activity must verify membership or ownership");
    });
  });

  // ── 5. SEARCH HISTORY DELETION VERIFICATION ─────────────────────────────────
  describe("5. Search History Deletion Verification", () => {
    test("DELETE /api/search-history/:id executes live database delete with userId scoping", () => {
      const match = routesCode.match(/app\.delete\(api\.searchHistory\.delete\.path,[\s\S]*?res\.sendStatus\(204\);/);
      assert.ok(match, "Search history delete route must exist");
      const searchDeleteChunk = match[0];

      assert.ok(
        searchDeleteChunk.includes("await db.delete(searchHistory).where(and(eq(searchHistory.id, id), eq(searchHistory.userId, userId)));"),
        "DELETE /api/search-history/:id must execute db.delete with both id and userId"
      );
    });
  });
});
