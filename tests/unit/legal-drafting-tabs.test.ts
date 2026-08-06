import test from "node:test";
import assert from "node:assert/strict";
import { normalizeStoredDraftTabs } from "../../client/src/contexts/draft-tabs-context";

test("stored legal drafting tabs retain isolated document and AI state", () => {
  const restored = normalizeStoredDraftTabs({
    activeTabId: "tab-b",
    tabs: [
      {
        id: "tab-a",
        draftId: 101,
        title: "Plaint",
        editorHtml: "<p>Plaint content</p>",
        docText: "Plaint content",
        chatMessages: [{ id: "a-chat", role: "user", content: "Plaint instruction" }],
        memoryItems: [{ id: "a-memory", kind: "instruction", text: "Plaint only", ts: 1 }],
        draftReferences: { caseLaw: [], statutes: [], removedCaseCitations: [], unresolvedStatutes: [] },
        recommendations: [],
        hasDraftInSession: true,
      },
      {
        id: "tab-b",
        draftId: 202,
        title: "Bail",
        editorHtml: "<p>Bail content</p>",
        docText: "Bail content",
        chatMessages: [{ id: "b-chat", role: "user", content: "Bail instruction" }],
        memoryItems: [{ id: "b-memory", kind: "risk", text: "Bail only", ts: 2 }],
        draftReferences: { caseLaw: [], statutes: [], removedCaseCitations: [], unresolvedStatutes: [] },
        recommendations: [{
          id: "b-rec",
          title: "Add FIR date",
          reason: "Required",
          originalSnippet: "",
          suggestedText: "FIR dated [______]",
          impact: "high",
        }],
        hasDraftInSession: true,
      },
    ],
  });

  assert.equal(restored?.activeTabId, "tab-b");
  assert.equal(restored?.tabs[0].chatMessages[0].content, "Plaint instruction");
  assert.equal(restored?.tabs[1].chatMessages[0].content, "Bail instruction");
  assert.equal(restored?.tabs[0].memoryItems[0].text, "Plaint only");
  assert.equal(restored?.tabs[1].recommendations[0].id, "b-rec");
});
