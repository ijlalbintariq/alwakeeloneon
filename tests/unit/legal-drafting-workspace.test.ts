import test from "node:test";
import assert from "node:assert/strict";
import {
  LEGAL_DRAFTING_WORKSPACE_VERSION,
  legalDraftWorkspaceStateSchema,
} from "../../shared/legal-drafting";

test("workspace schema persists clarification chat and review state", () => {
  const parsed = legalDraftWorkspaceStateSchema.parse({
    draftTitle: "Constitutional Petition",
    docText: "Complete draft",
    draftChatMessages: [{
      id: "clarify-1",
      role: "assistant",
      kind: "clarification",
      content: "Which filing type?",
      suggestedTypes: [{ key: "writ", label: "Writ Petition" }],
      originalPrompt: "Draft my case",
      createdAt: 1,
    }],
    recommendations: [{
      id: "rec-1",
      title: "Add jurisdiction",
      reason: "Required",
      originalSnippet: "",
      suggestedText: "JURISDICTION",
      impact: "high",
    }],
  });

  assert.equal(parsed.version, LEGAL_DRAFTING_WORKSPACE_VERSION);
  assert.equal(parsed.draftChatMessages[0].kind, "clarification");
  assert.equal(parsed.recommendations?.[0].impact, "high");
});

test("workspace schema rejects malformed recommendation state", () => {
  const parsed = legalDraftWorkspaceStateSchema.safeParse({
    recommendations: [{
      id: "rec-1",
      title: "Bad",
      reason: "Bad impact",
      originalSnippet: "",
      suggestedText: "Text",
      impact: "critical",
    }],
  });

  assert.equal(parsed.success, false);
});
