import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyLegalDraftFollowUp,
  findLegalDraftEditTarget,
  applyLegalDraftEdit,
} from "../../server/legal-drafting-followup";

/**
 * Taken from the app's own "Post-Arrest Bail Application (Sec. 497 CrPC)"
 * template, which letter-spaces its headings.
 */
const SPACED_DRAFT = `IN THE COURT OF THE LEARNED SESSIONS JUDGE, LAHORE

MOST RESPECTFULLY SHEWETH:

1. That the applicant was nominated in the FIR.

G R O U N D S:

A. FATAL AND UNEXPLAINED DELAY IN LODGING FIR: That the delay is unexplained.
B. OFFENCE DOES NOT FALL WITHIN THE PROHIBITORY CLAUSE: That bail is a rule.

P R A Y E R:

It is prayed that bail may be granted.

VERIFICATION:

Verified on oath.`;

test("letter-spaced headings are still found as edit targets", () => {
  const grounds = findLegalDraftEditTarget("strengthen the grounds", SPACED_DRAFT);
  assert.ok(grounds, 'no target found for "G R O U N D S:"');
  assert.equal(grounds.label, "GROUNDS");

  const prayer = findLegalDraftEditTarget("expand the prayer", SPACED_DRAFT);
  assert.ok(prayer, 'no target found for "P R A Y E R:"');
  assert.equal(prayer.label, "PRAYER");
});

test("a spaced GROUNDS edit stops at the spaced PRAYER heading", () => {
  const grounds = findLegalDraftEditTarget("strengthen the grounds", SPACED_DRAFT)!;
  assert.doesNotMatch(grounds.text, /P R A Y E R/, "grounds target swallowed the prayer");
  assert.doesNotMatch(grounds.text, /VERIFICATION/);
  assert.match(grounds.text, /PROHIBITORY CLAUSE/);

  const patched = applyLegalDraftEdit({
    draftText: SPACED_DRAFT,
    target: grounds,
    replacementText: "G R O U N D S:\n\nA. REPLACED GROUND: That the replacement applied.",
  });
  assert.equal(patched.ok, true);
  const text = patched.ok ? patched.text : "";
  assert.match(text, /REPLACED GROUND/);
  // Everything outside the target is untouched.
  assert.match(text, /P R A Y E R:/);
  assert.match(text, /It is prayed that bail may be granted\./);
  assert.match(text, /Verified on oath\./);
  assert.match(text, /MOST RESPECTFULLY SHEWETH:/);
});

test('"fill in the facts" is an edit instruction, not a clarification', () => {
  for (const prompt of [
    "Fill in the facts: applicant Asad Mehmood, FIR 412/2026 under 379 PPC",
    "complete the prayer section",
  ]) {
    const op = classifyLegalDraftFollowUp({ prompt, hasDraft: true, hasSelection: false });
    assert.notEqual(op, "clarify", `"${prompt}" was sent to clarification`);
  }
});

test("the index table is never dropped inside the facts section", async () => {
  const { normalizeCourtReadyDraftingText } = await import("../../server/routes");
  const draft = [
    "IN THE COURT OF THE LEARNED SESSIONS JUDGE, LAHORE",
    "",
    "MOST RESPECTFULLY SHEWETH:",
    "",
    "BRIEF FACTS:",
    "",
    "1. That the applicant was arrested in FIR No. 412/2026.",
    "",
    "P R A Y E R:",
    "",
    "It is prayed that bail may be granted.",
  ].join("\n");

  // normalize is a no-op here; the guard is that BRIEF FACTS keeps its own first
  // paragraph adjacent, with no table wedged between them.
  const out = normalizeCourtReadyDraftingText(draft);
  const facts = out.indexOf("BRIEF FACTS");
  const firstFact = out.indexOf("1. That the applicant");
  assert.ok(facts >= 0 && firstFact > facts, "facts heading lost its paragraph");
  assert.doesNotMatch(
    out.slice(facts, firstFact),
    /INDEX OF DOCUMENTS|<table/i,
    "index table was inserted between the facts heading and its first paragraph",
  );
});
