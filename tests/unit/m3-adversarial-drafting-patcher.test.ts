import { test, describe } from "node:test";
import assert from "node:assert";
import { applyLegalDraftEdit, findLegalDraftEditTarget, classifyLegalDraftFollowUp } from "../../server/legal-drafting-followup.ts";

describe("Adversarial Legal Drafting Patcher Tests", () => {
  const bailDraft = `IN THE COURT OF SESSIONS
...
GROUNDS:
A) That the FIR is delayed.

PRAYER:
Admit to bail.

APPLICANT
Through Counsel`;

  test("1. Target identification works for PRAYER", () => {
    const target = findLegalDraftEditTarget("Rewrite the PRAYER", bailDraft);
    assert.ok(target !== null);
    assert.strictEqual(target.label, "PRAYER");
    assert.strictEqual(target.action, "replace");
    assert.ok(target.text.includes("Admit to bail.")); 
    assert.ok(!target.text.includes("APPLICANT"));
  });

  test("2. Overgeneration strip works when AI hallucinates INDEX OF DOCUMENTS", () => {
    const target = findLegalDraftEditTarget("Rewrite the PRAYER", bailDraft);
    const replacementText = `PRAYER:
In view of the above, admit to interim bail.

INDEX OF DOCUMENTS
1. FIR
`;
    const result = applyLegalDraftEdit({ draftText: bailDraft, target: target!, replacementText });
    assert.strictEqual(result.ok, true);
    if (result.ok) {
      assert.ok(result.text.includes("In view of the above, admit to interim bail."));
      assert.ok(!result.text.includes("INDEX OF DOCUMENTS"));
      assert.ok(result.text.includes("APPLICANT\nThrough Counsel")); 
    }
  });

  test("3. Overgeneration strip works when AI omits the colon in heading", () => {
    const target = findLegalDraftEditTarget("Rewrite the PRAYER", bailDraft);
    const replacementText = `PRAYER
In view of the above, admit to interim bail.

INDEX OF DOCUMENTS
1. FIR
`;
    const result = applyLegalDraftEdit({ draftText: bailDraft, target: target!, replacementText });
    assert.strictEqual(result.ok, true);
    if (result.ok) {
      assert.ok(result.text.includes("In view of the above, admit to interim bail."));
      assert.ok(!result.text.includes("INDEX OF DOCUMENTS"));
    }
  });

  test("4. Missing target gracefully fails", () => {
    const target = findLegalDraftEditTarget("Edit the VERIFICATION", bailDraft);
    assert.ok(target === null);
  });
});
