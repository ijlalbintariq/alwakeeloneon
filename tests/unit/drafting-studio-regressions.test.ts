import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { CitationNode } from "../../client/src/components/citation-node";
import { DraftSaveQueue, draftFingerprint, hasDraftContent, normalizeDraftingTabs, type DocumentTab } from "../../client/src/experimental/lib/drafting-persistence";
import { computeWordDiff } from "../../client/src/experimental/lib/text-diff";
import { parseInlineFormatting } from "../../client/src/experimental/lib/plain-to-tiptap";
import { buildLegalPrintDocument } from "../../client/src/lib/print-legal-document";
import { legalDraftInputSchema, legalDraftBriefSchema } from "../../shared/legal-drafting";

const tab: DocumentTab = { id: "a", title: "Bail", category: "Criminal", documentType: "sessions-bail-application", pageProfileId: "court-legal", htmlContent: "<p>Draft</p>", textContent: "Draft", lastModified: 1 };

test("autosave serializes a first create and drains the latest edits without duplicate creation", async () => {
  let release!: () => void;
  let started!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const firstStarted = new Promise<void>((resolve) => { started = resolve; });
  const writes: Array<{ text: string; method: string }> = [];
  let databaseId: number | undefined;
  const queue = new DraftSaveQueue<DocumentTab>(async (snapshot) => {
    writes.push({ text: snapshot.textContent, method: databaseId ? "PATCH" : "POST" });
    if (writes.length === 1) { started(); await gate; databaseId = 17; }
  });
  const first = queue.save(tab);
  await firstStarted;
  const second = queue.save({ ...tab, textContent: "Intermediate" });
  const third = queue.save({ ...tab, textContent: "Latest edits" });
  release();
  await Promise.all([first, second, third]);
  assert.deepEqual(writes, [{ text: "Draft", method: "POST" }, { text: "Latest edits", method: "PATCH" }]);
});

test("a failed save can be retried and different tabs save independently", async () => {
  let fail = true;
  const saved: string[] = [];
  const queue = new DraftSaveQueue<DocumentTab>(async (snapshot) => {
    if (fail && snapshot.id === "a") throw new Error("offline");
    saved.push(snapshot.id);
  });
  await assert.rejects(queue.save(tab), /offline/);
  await queue.save({ ...tab, id: "b" });
  fail = false;
  await queue.save(tab);
  assert.deepEqual(saved, ["b", "a"]);
});

test("restored tabs reject duplicate IDs and invalid profiles and preserve filing type", () => {
  const restored = normalizeDraftingTabs({ tabs: [tab, { ...tab }, { ...tab, id: "b", pageProfileId: "toString", dbDraftId: -1 }], activeTabId: "missing" });
  assert.equal(restored?.tabs.length, 2);
  assert.equal(restored?.activeTabId, "a");
  assert.equal(restored?.tabs[1].pageProfileId, "court-legal");
  assert.equal(restored?.tabs[1].dbDraftId, undefined);
  assert.equal(restored?.tabs[0].documentType, tab.documentType);
  assert.equal(draftFingerprint(tab), draftFingerprint({ ...tab, dbDraftId: 17, lastModified: 99 }));
  assert.notEqual(draftFingerprint(tab), draftFingerprint({ ...tab, pageProfileId: "a4" }));
});

test("autosave retains non-text document structures while ignoring untouched empty paragraphs", () => {
  assert.equal(hasDraftContent({ ...tab, htmlContent: "<p></p>", textContent: "" }), false);
  assert.equal(hasDraftContent({ ...tab, htmlContent: "<table><tr><td></td></tr></table>", textContent: "" }), true);
  assert.equal(hasDraftContent({ ...tab, htmlContent: '<div data-type="legal-page-break"></div>', textContent: "" }), true);
});

test("draft persistence retains filing type and rejects invalid page profiles", () => {
  const parsed = legalDraftInputSchema.parse({ title: "Bail", content: "Draft", metadata: { documentType: tab.documentType, pageProfileId: "a4" } });
  assert.equal(parsed.metadata?.documentType, tab.documentType);
  assert.equal(legalDraftInputSchema.safeParse({ title: "Bail", content: "Draft", metadata: { pageProfileId: "unknown" } }).success, false);
  assert.equal(legalDraftBriefSchema.safeParse(42).success, false);
  assert.equal(legalDraftBriefSchema.safeParse({ forum: {}, matterTitle: "X", reliefType: "Y" }).success, false);
});

test("inline formatting never restores event attributes from plaintext", () => {
  assert.doesNotMatch(parseInlineFormatting("<span onclick=alert(1)>clause</span>"), /<span\s/i);
  assert.equal(parseInlineFormatting("<span>clause</span>"), "<span>clause</span>");
});

test("large and whitespace-only diffs preserve both original strings exactly", () => {
  for (const [original, revised] of [
    ["PRAYER\nRelief", "PRAYER\n\nRelief"],
    [Array.from({ length: 2000 }, (_, i) => `Original paragraph ${i}`).join("\n"), Array.from({ length: 2000 }, (_, i) => `Revised clause ${i}`).join("\n")],
  ]) {
    const diff = computeWordDiff(original, revised);
    assert.equal(diff.hasChanges, true);
    assert.equal(diff.tokens.filter((t) => t.type !== "add").map((t) => t.value).join(""), original);
    assert.equal(diff.tokens.filter((t) => t.type !== "del").map((t) => t.value).join(""), revised);
  }
});

test("citation chips survive plain-text extraction and HTML round trips", () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, Node: dom.window.Node, HTMLElement: dom.window.HTMLElement, DOMParser: dom.window.DOMParser, MutationObserver: dom.window.MutationObserver });
  const editor = new Editor({ extensions: [StarterKit, CitationNode], content: '<p>Authority: <span data-type="citation" citation="PLD 2023 SC 145" judgmentId="17"></span></p>' });
  assert.equal(editor.getText(), "Authority: PLD 2023 SC 145");
  editor.commands.setContent(editor.getHTML());
  assert.equal(editor.getText(), "Authority: PLD 2023 SC 145");
  editor.destroy();
  dom.window.close();
});

test("print preview contains only the pleading, escapes titles, and uses selected paper", () => {
  const dom = new JSDOM("<!doctype html>");
  Object.assign(globalThis, { DOMParser: dom.window.DOMParser });
  const html = buildLegalPrintDocument('<h1>Petition</h1><p onclick="alert(1)">Facts</p><div data-page-break="true"></div><script>alert(1)</script><img src="https://example.com/tracker">', '</title><script>alert(2)</script>', "a4");
  assert.match(html, /size: A4/);
  assert.match(html, /<h1>Petition<\/h1>/);
  assert.match(html, /data-page-break="true"/);
  assert.doesNotMatch(html, /<script|<img|onclick=/);
  assert.match(html, /&lt;\/title&gt;/);
  dom.window.close();
});
