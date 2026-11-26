import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

process.env.DATABASE_URL ??= "postgresql://localhost:5432/dummy_test_db";
process.env.PGHOST ??= "localhost";

const { parseQualityReview } = await import("../../server/output-quality");
const { applyAlWakeeloSafetyGuardrails, enforceInternalCaseCitationIntegrity } = await import("../../server/routes");

describe("Output quality quote normalization and grounding", () => {
  it("matches answerEvidence and sourceEvidence across markdown formatting", () => {
    const assessment = parseQualityReview(
      {
        relevance: 5,
        completeness: 5,
        caseLawRelevance: 5,
        requiresCaseLaw: true,
        requiresSources: true,
        grounding: "supported",
        confidence: 0.92,
        reason: "The answer directly explains 2005 SCMR 720 using the supplied source excerpt.",
        queryEvidence: "2005 scmr 720",
        answerEvidence: "In 2005 SCMR 720, the Supreme Court held that bail could not be canceled lightly.",
        sourceEvidence: "2005 SCMR 720 — Supreme Court held that bail could not be canceled lightly.",
      },
      {
        feature: "chat",
        query: "2005 scmr 720",
        answer: "In **2005 SCMR 720**, the Supreme Court held that bail could not be canceled lightly.",
        sourceContext: "`2005 SCMR 720` — **Supreme Court** held that bail could not be canceled lightly.",
      },
    );

    assert.equal(assessment.status, "reviewed");
    assert.equal(assessment.score, 5);
    assert.equal(assessment.grounding, "supported");
    assert.deepEqual(assessment.flags, []);
  });
});

describe("Attachment citation preservation vs strict hallucination scrubbing", () => {
  it("preserves user-attached citations in prose when preserveAttachmentCitations is true", async () => {
    const transcribedAnswer =
      "The attached image lists 2021 CLC 999 and 2019 YLR 888 regarding specific performance of an agreement to sell.";

    const guarded = await applyAlWakeeloSafetyGuardrails(
      transcribedAnswer,
      undefined,
      [],
      undefined,
      { preserveAttachmentCitations: true },
    );

    assert.match(guarded, /2021 CLC 999/);
    assert.match(guarded, /2019 YLR 888/);
    assert.doesNotMatch(guarded, /unverified citation removed/i);

    const internalChecked = await enforceInternalCaseCitationIntegrity(transcribedAnswer, {
      trustedCitations: [],
      preserveAttachmentCitations: true,
    });

    assert.match(internalChecked.content, /2021 CLC 999/);
    assert.match(internalChecked.content, /2019 YLR 888/);
    assert.doesNotMatch(internalChecked.content, /unverified citation removed/i);
  });

  it("still scrubs unverified citations by default when preserveAttachmentCitations is not set", async () => {
    const hallucinated = "As held in 2020 PTD 500, this appeal succeeds.";
    const res = await enforceInternalCaseCitationIntegrity(hallucinated, {
      trustedCitations: [],
    });

    assert.doesNotMatch(res.content, /2020 PTD 500/);
  });
});

describe("Operational MCP telemetry and chat sourceContext wiring", () => {
  it("marks raw MCP tool and RAG context calls as operational in server/mcp-server.ts", () => {
    const src = fs.readFileSync(path.resolve("server/mcp-server.ts"), "utf8");
    assert.match(src, /const isOperationalTool =[\s\S]*?feature === "search-judgments"[\s\S]*?feature === "search-statutes"[\s\S]*?feature === "legal-research"/);
    assert.match(src, /operational:\s*isOperationalTool/);
  });

  it("wires operational quality logging and sourceContext/attachment preservation in server/routes.ts", () => {
    const src = fs.readFileSync(path.resolve("server/routes.ts"), "utf8");
    assert.match(src, /skipQualityLog:\s*true/);
    assert.match(src, /logOutputQuality\(userId,\s*"legal-research",\s*"mcp-rag-context",\s*query,\s*rawContext,\s*\{\s*userQuery:\s*query,\s*operational:\s*true\s*\}\)/);
    assert.match(src, /preserveAttachmentCitations:\s*hasUserImageAttachment/);
  });
});
