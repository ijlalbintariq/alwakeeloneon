process.env.DATABASE_URL = "postgresql://localhost:5432/dummy_test_db";
process.env.PGHOST = "localhost";

import test from "node:test";
import assert from "node:assert/strict";
import { detectStatuteRef } from "../../server/pipeline/intent-classifier";
import { buildContext } from "../../server/pipeline/context-builder";
import { enforceProseCitationIntegrity, isDirectModePrompt } from "../../server/routes";

// ── Statute reference detection ─────────────────────────────────────────────
test("common English words and court codes are not statute abbreviations", () => {
  assert.equal(detectStatuteRef("what is 302 ppc")?.fullName, "Pakistan Penal Code");
  assert.equal(detectStatuteRef("what is 302 ppc")?.sectionOrArticle, "302");
  assert.equal(detectStatuteRef("limitation for suit is 3 years"), null);
  assert.equal(detectStatuteRef("PLD 2020 SC 123 facts"), null);
  assert.equal(detectStatuteRef("2025 SCMR 969"), null);
});

test("real statute references still resolve", () => {
  assert.equal(detectStatuteRef("497 crpc bail")?.abbr, "CRPC");
  assert.equal(detectStatuteRef("bail under 489-F PPC")?.sectionOrArticle, "489-f");
  assert.equal(detectStatuteRef("article 25 constitution")?.fullName, "Constitution of Pakistan 1973");
  assert.equal(detectStatuteRef("ATA 7")?.abbr, "ATA");
});

// ── Direct mode ─────────────────────────────────────────────────────────────
test("direct mode never swallows a legal question", () => {
  assert.equal(isDirectModePrompt("just give me 3 cases on bail cancellation"), false);
  assert.equal(isDirectModePrompt("exactly what is the punishment under 302 PPC"), false);
  assert.equal(isDirectModePrompt("is 2025 SCMR 969 good law? yes or no only"), false);
  assert.equal(isDirectModePrompt("Reply with YES only"), true);
  assert.equal(isDirectModePrompt("just say hello"), true);
});

// ── Prose citation scrubber ─────────────────────────────────────────────────
test("a citation that is a prefix of a trusted one is not trusted", async () => {
  const out = await enforceProseCitationIntegrity("See **[2024 SCMR 14]**.", new Set(["2024 SCMR 1419"]));
  assert.ok(!out.includes("2024 SCMR 14]"));
});

test("plain-text citations outside the pool are removed; pool citations stay", async () => {
  const out = await enforceProseCitationIntegrity(
    "As held in 2019 SCMR 1234, and in 2024 SCMR 1419, bail was refused.",
    new Set(["2024 SCMR 1419"]),
  );
  assert.ok(!out.includes("2019 SCMR 1234"));
  assert.ok(out.includes("[unverified citation removed]"));
  assert.ok(out.includes("2024 SCMR 1419"));
});

// ── Context labels ──────────────────────────────────────────────────────────
test("only rows with their own text are labelled verified; each block appears once", () => {
  const intent: any = { type: "case-law", topics: [], needsCaseLaw: true, needsStatutes: false, statuteRef: undefined };
  const row = (citation: string, textIntegrity: string) => ({
    row: { citation, court: "Lahore High Court", title: "A vs B", summary: "Bail refused.", sourceType: "judgment", textIntegrity },
    relevanceScore: 90,
  });
  const ctx = buildContext(intent, {
    caseLaw: [row("2020 SCMR 1", "own"), row("2021 SCMR 2", "headnote-only"), row("2022 SCMR 3", "unverified")],
    statutes: [],
    adminDocs: [],
    diagnostics: {} as any,
  } as any);
  const s = ctx.contextString;
  assert.match(s, /2020 SCMR 1 \| COURT: Lahore High Court.*SOURCE: Verified Judgment DB/);
  assert.match(s, /2021 SCMR 2 .*SOURCE: Headnote only/);
  assert.match(s, /2022 SCMR 3 .*SOURCE: Judgment DB \(text not verified\)/);
  assert.equal(s.split("2020 SCMR 1").length - 1, 1, "each judgment is listed exactly once");
  assert.ok(!s.includes("INTERNAL KNOWLEDGE VAULT"));
});
