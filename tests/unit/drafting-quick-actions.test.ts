import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyLegalDraftFollowUp,
  findLegalDraftEditTarget,
} from "../../server/legal-drafting-followup";

/** A loaded bail application, the state the studio is in when a chip is clicked. */
const DRAFT = `IN THE COURT OF THE LEARNED SESSIONS JUDGE, LAHORE

Criminal Miscellaneous (Bail) Application No. ____ of 2026

MOST RESPECTFULLY SHEWETH:

BRIEF FACTS:

1. That the applicant was nominated in FIR No. 412/2026.
2. That the applicant joined the investigation.

GROUNDS:

A. FURTHER INQUIRY: That the case calls for further inquiry.
B. NO FLIGHT RISK: That the applicant is not a flight risk.

PRAYER:

It is prayed that bail may be granted.

VERIFICATION:

Verified on oath.`;

/**
 * Verbatim from `quickActionChips` in RightDraftingSidebar.tsx. Each one starts
 * with "Draft"/"Generate", so a looser mutation rule would promote them to a
 * whole-document rewrite and silently destroy the pleading already on the canvas.
 */
const QUICK_ACTION_CHIPS: Array<[string, string]> = [
  ["AI Review & Suggestions", "Review this draft and suggest improvements for procedural compliance, legal strength, and clarity."],
  ["Injunction Triple Test", "Draft grounds for temporary injunction under Order 39 Rules 1 & 2 CPC satisfying the mandatory triple test."],
  ["CrPC 497(2) Bail Grounds", "Draft post-arrest bail grounds under Section 497(2) CrPC based on further inquiry and lack of overt role."],
  ["Art. 199 Writ Grounds", "Draft High Court writ petition grounds under Article 199 against an arbitrary executive order lacking lawful authority."],
  ["QSO Art. 17 Execution", "Generate an Article 17 Qanun-e-Shahadat Order attestation block with marginal witnesses."],
  ["Affidavit Verification", "Generate standard verification on solemn affirmation under Order XIX CPC for this petition."],
];

test("no quick-action chip rewrites the whole draft", () => {
  for (const [label, prompt] of QUICK_ACTION_CHIPS) {
    const op = classifyLegalDraftFollowUp({ prompt, hasDraft: true, hasSelection: false });
    assert.notEqual(op, "full-rewrite", `chip "${label}" would rewrite the entire pleading`);
    assert.notEqual(op, "conversion", `chip "${label}" would convert the filing type`);
  }
});

test("the review chip answers instead of editing", () => {
  assert.equal(
    classifyLegalDraftFollowUp({ prompt: QUICK_ACTION_CHIPS[0][1], hasDraft: true, hasSelection: false }),
    "answer",
  );
});

test("the grounds chips target GROUNDS, the verification chip targets VERIFICATION", () => {
  for (const [label, prompt] of QUICK_ACTION_CHIPS.slice(1, 4)) {
    const target = findLegalDraftEditTarget(prompt, DRAFT);
    assert.equal(target?.label, "GROUNDS", `chip "${label}" did not bind to GROUNDS`);
    assert.doesNotMatch(target?.text || "", /PRAYER|VERIFICATION/);
  }
  assert.equal(findLegalDraftEditTarget(QUICK_ACTION_CHIPS[5][1], DRAFT)?.label, "VERIFICATION");
});

test("conversion is its own operation, not a full rewrite", () => {
  for (const prompt of [
    "turn this into a writ petition",
    "convert this to a constitutional petition under Article 199",
    "convert this into a plaint",
  ]) {
    assert.equal(
      classifyLegalDraftFollowUp({ prompt, hasDraft: true, hasSelection: false }),
      "conversion",
      `"${prompt}" did not classify as a conversion`,
    );
  }
  // A conversion with no draft is simply a fresh draft of the new type.
  assert.equal(
    classifyLegalDraftFollowUp({ prompt: "turn this into a writ petition", hasDraft: false, hasSelection: false }),
    "initial-draft",
  );
});

test("an explicit whole rewrite still reaches full-rewrite", () => {
  for (const prompt of ["rewrite everything", "rewrite the whole draft from scratch"]) {
    assert.equal(
      classifyLegalDraftFollowUp({ prompt, hasDraft: true, hasSelection: false }),
      "full-rewrite",
    );
  }
});

/**
 * "Draft Fix" in the risk scanner feeds a model-written prompt straight into the
 * same pipeline, so those prompts must land on a bounded edit too.
 */
test("risk-scanner Draft Fix prompts stay bounded", () => {
  const cases: Array<[string, string | null]> = [
    ["Add a proper verification clause under Order VI Rule 15 CPC to this draft.", "VERIFICATION"],
    ["The prayer clause is vague. Redraft it with specific, enforceable relief.", "PRAYER"],
  ];
  for (const [prompt, expected] of cases) {
    const op = classifyLegalDraftFollowUp({ prompt, hasDraft: true, hasSelection: false });
    assert.notEqual(op, "full-rewrite", `"${prompt}" escalated to a full rewrite`);
    assert.equal(findLegalDraftEditTarget(prompt, DRAFT)?.label, expected);
  }
});

/**
 * A section-keyword guard stops chips like "Draft bail grounds" from rewriting the
 * whole pleading. It used to fire even when the instruction named the document as
 * its scope, so "rewrite the whole draft, keeping the same facts" edited BRIEF
 * FACTS and left the rest of the petition untouched.
 */
test("a whole-document rewrite survives an incidental section word", () => {
  for (const prompt of [
    "rewrite the whole draft from scratch, keeping the same facts and parties",
    "redraft the entire petition but keep the facts",
    "regenerate the whole application, same grounds",
    "start over with the same prayer",
  ]) {
    assert.equal(
      classifyLegalDraftFollowUp({ prompt, hasDraft: true, hasSelection: false }),
      "full-rewrite",
      `"${prompt}" was demoted to a section edit`,
    );
  }
});

test("the section guard still holds when the scope is a section", () => {
  for (const prompt of [
    "do a complete rewrite of the grounds",
    "rewrite the entire grounds section",
    "Draft post-arrest bail grounds under Section 497(2) CrPC based on further inquiry and lack of overt role.",
  ]) {
    assert.equal(
      classifyLegalDraftFollowUp({ prompt, hasDraft: true, hasSelection: false }),
      "section-edit",
      `"${prompt}" escalated to a whole-document rewrite`,
    );
  }
});

/**
 * Authorities belong in GROUNDS. "add case law according to the facts of this
 * plaint" names "facts" only to say what the authorities must match, and matching
 * the FACTS section first put the citations in BRIEF FACTS and left GROUNDS alone.
 */
test("a case-law request targets GROUNDS, not BRIEF FACTS", () => {
  const draft = [
    "IN THE COURT OF THE LEARNED CIVIL JUDGE, LAHORE",
    "",
    "BRIEF FACTS:",
    "",
    "1. That the defendant agreed to sell the suit property.",
    "",
    "GROUNDS:",
    "",
    "A. That the agreement is binding.",
    "",
    "PRAYER:",
    "",
    "It is prayed that the suit be decreed.",
  ].join("\n");

  for (const prompt of [
    "add case law according to the facts of this plaint",
    "add relevant judgments based on the facts",
    "cite precedents supporting these facts",
  ]) {
    assert.equal(findLegalDraftEditTarget(prompt, draft)?.label, "GROUNDS", `"${prompt}"`);
  }
});

test("naming the facts section explicitly still targets it", () => {
  const draft = "BRIEF FACTS:\n\n1. That x.\n\nGROUNDS:\n\nA. That y.\n\nPRAYER:\n\nz.";
  assert.equal(findLegalDraftEditTarget("add a reference in the facts", draft)?.label, "BRIEF FACTS");
  assert.equal(findLegalDraftEditTarget("rewrite the brief facts", draft)?.label, "BRIEF FACTS");
});
