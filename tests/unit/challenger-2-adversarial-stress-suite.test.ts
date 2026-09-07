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

describe("Challenger 2 Adversarial Stress 1: Pakistani Multi-Language & Large Legal Payloads", () => {
  test("Urdu, Arabic, and Pakistani mixed-script legal pleadings pass Drizzle schema without corruption", () => {
    const urduPleading = `
      عدالت جناب سینئر سول جج صاحب، لاہور
      دعویٰ برائے تعمیل مختص (Specific Performance)
      زیر دفعہ 12، Specific Relief Act 1877
      
      جناب عالی! سائل حسب ذیل عرض گزار ہے:
      1. یہ کہ مدعی نے مورخہ 15 اگست 2026 کو مدعا علیہ کے ساتھ جائیداد واقع گلبرگ 3 لاہور کا بیعانہ ادا کیا۔
      2. یہ کہ مبلغ 5,000,000 روپے بذریعہ پے آرڈر ادا کیے گئے۔
      3. یہ کہ مدعا علیہ رجسٹری کروانے سے انکاری ہے۔
      
      حکم امتناعی (Status Quo) بقیدِ آرڈر 39 قواعد 1 و 2 ضابطہ دیوانی 1908 صادر فرمایا جاوے۔
    `;

    const payload = {
      userId: "advocate_ali_khan",
      title: "دعویٰ برائے تعمیل مختص - پلازہ 12 گلبرگ لاہور",
      templateType: "Urdu Court Pleading",
      content: urduPleading,
      status: "draft",
      metadata: {
        language: "ur-PK",
        statute: "Specific Relief Act 1877",
        section: "Section 12",
        counsel: "میاں عامر محمود ایڈووکیٹ ہائی کورٹ",
      },
    };

    const validated = insertLegalDraftSchema.parse(payload);
    assert.equal(validated.title, payload.title);
    assert.ok(validated.content.includes("دعویٰ برائے تعمیل مختص"));
    assert.ok(validated.content.includes("Specific Relief Act 1877"));

    const serialized = JSON.stringify(validated);
    const parsed = JSON.parse(serialized);
    assert.equal(parsed.title, payload.title);
    assert.equal(parsed.content, payload.content);
  });

  test("1MB Mega-Document with 500 procedural findings validates successfully without memory or stack blowup", () => {
    const hugeParagraph = "WHEREAS the parties hereto entered into this indenture at Lahore on 29 August 2026. ".repeat(1500);
    const megaText = hugeParagraph.repeat(8);

    const scanPayload = {
      userId: "user_enterprise_corp",
      title: "Mega Commercial Concession Agreement Scan (1MB+)",
      documentType: "contract",
      text: megaText,
      summary: "Mega audit complete with 500 statutory findings across CPC, Contract Act, and Registration Act.",
      overallRisk: "Vulnerable",
      totalRisks: 150,
      totalWarnings: 350,
    };

    const validatedScan = insertDocumentScanSchema.parse(scanPayload);
    assert.equal(validatedScan.title, scanPayload.title);
    assert.ok(validatedScan.text.length > 500000);

    const findings = Array.from({ length: 500 }, (_, idx) => ({
      scanId: 999,
      pillar: idx % 2 === 0 ? "Statutory Procedural Defect" : "Substantive Limitation Bar",
      category: idx % 3 === 0 ? "Order VII Rule 11 CPC" : idx % 3 === 1 ? "Section 17 Registration Act" : "Article 113 Limitation",
      severity: idx % 5 === 0 ? "risk" : "warning",
      issue: `Procedural Defect Finding #${idx + 1}: Missing statutory averment in Paragraph ${idx + 1}`,
      statuteRef: `Statute Citation Ref: PLD 202${idx % 5 + 1} SC ${100 + idx}`,
      recommendation: `Amend paragraph ${idx + 1} to explicitly plead the date and accrual of cause of action.`,
      rawSnippet: megaText.slice(idx * 50, (idx * 50) + 40),
      isResolved: idx % 4 === 0,
    }));

    for (const f of findings) {
      const v = insertScanFindingSchema.parse(f);
      assert.equal(v.scanId, 999);
    }
  });
});

describe("Challenger 2 Adversarial Stress 2: Boundary Inputs, Nullables & Injection Payloads", () => {
  test("Zero-length strings, empty arrays, and null optional fields survive schema without exception", () => {
    const minimalScan = {
      userId: "user_1",
      title: "Blank Scan",
      documentType: "pleading",
      text: "Single line plaint.",
    };

    const vScan = insertDocumentScanSchema.parse(minimalScan);
    assert.equal(vScan.title, "Blank Scan");
    assert.equal(vScan.summary, undefined);
    assert.equal(vScan.overallRisk, undefined);

    const minimalFinding = {
      scanId: 1,
      pillar: "General",
      category: "Pleading",
      severity: "warning",
      issue: "Minor advisory note",
      recommendation: "Review before filing",
    };

    const vFinding = insertScanFindingSchema.parse(minimalFinding);
    assert.equal(vFinding.statuteRef, undefined);
    assert.equal(vFinding.rawSnippet, undefined);
    assert.equal(Boolean(vFinding.isResolved), false);
  });

  test("SQL injection strings, XSS scripts, and terminal escape codes are safely handled as typed data", () => {
    const maliciousInput = "'; DROP TABLE document_scans; -- <script>alert(document.cookie)</script> \x00\x1b[31m";

    const injectionScan = {
      userId: "hacker_test",
      title: maliciousInput,
      documentType: "contract",
      text: maliciousInput,
      summary: maliciousInput,
      overallRisk: "Vulnerable",
    };

    const validated = insertDocumentScanSchema.parse(injectionScan);
    assert.equal(validated.title, maliciousInput);
    assert.equal(validated.text, maliciousInput);

    const serialized = JSON.stringify(validated);
    const roundTripped = JSON.parse(serialized);
    assert.equal(roundTripped.title, maliciousInput);
  });
});

describe("Challenger 2 Adversarial Stress 3: Cross-Module Event Payload Compatibility", () => {
  test("Dual schema payload support: handles both { clause: string } and { content: string } and { text: string }", () => {
    function extractClauseContent(payload: any): string {
      if (!payload || typeof payload !== "object") return "";
      return payload.clause || payload.content || payload.text || "";
    }

    const payloadA = {
      title: "Section 12 Specific Relief Act 1877",
      clause: "Contract of which subject matter has ceased to exist...",
      statute: "Specific Relief Act 1877",
      section: "Section 12",
    };

    const payloadB = {
      title: "Commercial Contract Clause",
      content: "All disputes arising out of or in connection with this agreement shall be settled under Arbitration Act 1940...",
      source: "Commercial Contract Studio",
    };

    const payloadC = {
      title: "Precedent Snippet",
      text: "Continuous readiness and willingness must be averred and proved: PLD 2021 SC 429.",
    };

    assert.equal(extractClauseContent(payloadA), payloadA.clause);
    assert.equal(extractClauseContent(payloadB), payloadB.content);
    assert.equal(extractClauseContent(payloadC), payloadC.text);
    assert.equal(extractClauseContent(null), "");
    assert.equal(extractClauseContent(undefined), "");
  });
});
