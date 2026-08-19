import test from "node:test";
import assert from "node:assert/strict";
import {
  applyLegalDraftEdit,
  classifyLegalDraftFollowUp,
  findLegalDraftEditTarget,
  resolveExplicitSelectionTarget,
} from "../../server/legal-drafting-followup";

const DRAFT = `IN THE COURT OF THE SESSIONS JUDGE

BRIEF FACTS
1. That the applicant was nominated in the FIR.
2. That the applicant joined the investigation.

GROUNDS
A. That the case calls for further inquiry. The record supports this ground.
B. That the applicant is not a flight risk. He undertakes to attend trial.

PRAYER
It is respectfully prayed that bail may be granted.

VERIFICATION
Verified on oath.`;

test("follow-up classifier defaults ordinary questions to answer-only", () => {
  for (const prompt of ["Review my draft", "Is this bail application maintainable?", "Is this prayer correct?", "What did you change?"]) {
    assert.equal(classifyLegalDraftFollowUp({ prompt, hasDraft: true, hasSelection: false }), "answer");
  }
});

test("follow-up classifier never treats an unspecified edit as a full rewrite", () => {
  assert.equal(
    classifyLegalDraftFollowUp({ prompt: "make it stronger", hasDraft: true, hasSelection: false }),
    "clarify",
  );
  assert.equal(
    classifyLegalDraftFollowUp({ prompt: "rewrite everything", hasDraft: true, hasSelection: false }),
    "full-rewrite",
  );
  assert.equal(
    classifyLegalDraftFollowUp({ prompt: "delete paragraph 5", hasDraft: true, hasSelection: false }),
    "section-edit",
  );
  assert.equal(
    classifyLegalDraftFollowUp({ prompt: "apply that to paragraph 2", hasDraft: true, hasSelection: false }),
    "section-edit",
  );
});

test("section and paragraph targets produce bounded edits", () => {
  const prayer = findLegalDraftEditTarget("make the prayer stronger", DRAFT);
  assert.equal(prayer?.label, "PRAYER");
  assert.doesNotMatch(prayer?.text || "", /VERIFICATION/);
  const paragraph = findLegalDraftEditTarget("add this after paragraph 1", DRAFT);
  assert.equal(paragraph?.label, "PARAGRAPH 1");
  assert.equal(paragraph?.action, "insert-after");
  const finalGround = findLegalDraftEditTarget("strengthen ground B", DRAFT);
  assert.equal(finalGround?.label, "GROUND B");
  assert.doesNotMatch(finalGround?.text || "", /PRAYER/);
  const addGround = findLegalDraftEditTarget("add another ground", DRAFT);
  assert.equal(addGround?.action, "insert-after");

  const applied = applyLegalDraftEdit({
    draftText: DRAFT,
    target: paragraph!,
    replacementText: "1-A. That the complainant later withdrew the allegation.",
  });
  assert.equal(applied.ok, true);
  assert.match(applied.ok ? applied.text : "", /withdrew the allegation[\s\S]*2\. That the applicant joined/);
});

test("selection offsets must match the exact source text", () => {
  const snippet = "2. That the applicant joined the investigation.";
  const exactStart = DRAFT.indexOf(snippet);
  assert.ok(resolveExplicitSelectionTarget({
    draftText: DRAFT,
    selectedSnippet: snippet,
    selectedStart: exactStart,
    selectedEnd: exactStart + snippet.length,
    prompt: "shorten this",
  }));
  assert.equal(resolveExplicitSelectionTarget({
    draftText: `${DRAFT}\n${snippet}`,
    selectedSnippet: snippet,
    selectedStart: exactStart + 2,
    selectedEnd: exactStart + 2 + snippet.length,
    prompt: "shorten this",
  }), null);
});

test("replacing one section preserves the exact surrounding draft", () => {
  const target = findLegalDraftEditTarget("rewrite the prayer", DRAFT);
  assert.ok(target);
  const before = DRAFT.slice(0, target!.start);
  const after = DRAFT.slice(target!.end);
  const replacement = "PRAYER\nIt is respectfully prayed that post-arrest bail be granted.";
  const applied = applyLegalDraftEdit({ draftText: DRAFT, target: target!, replacementText: replacement });
  assert.equal(applied.ok, true);
  assert.equal(applied.ok ? applied.text : "", `${before}${replacement}${after}`);
});

test("an explicit whole rewrite overrides an incidental selection", () => {
  assert.equal(classifyLegalDraftFollowUp({
    prompt: "rewrite the whole draft",
    hasDraft: true,
    hasSelection: true,
  }), "full-rewrite");
});

test("narrative facts with embedded drafting command classifies as fresh draft", () => {
  const prompt = "Ali's name was placed on the ECL by the Ministry of Interior without giving him any notice or opportunity of hearing. He has no conviction and no court order restricting his travel. When he approaches the authorities for removal of his name, they refuse to provide reasons.\n\nTask: Draft a Constitutional Petition under Article 199 before the Lahore High Court seeking:\n\nRemoval of his name from the ECL.\nDeclaration that the impugned action is unlawful.\nInterim permission to travel abroad.";
  assert.equal(classifyLegalDraftFollowUp({
    prompt,
    hasDraft: false,
    hasSelection: false,
  }), "initial-draft");
  assert.equal(classifyLegalDraftFollowUp({
    prompt,
    hasDraft: true,
    hasSelection: false,
  }), "full-rewrite");
});

