import test, { after, afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import React, { act } from "react";
import { Router } from "wouter";

const dom = new JSDOM('<html><head><meta name="robots" content="index,follow"><link id="canonical-link" rel="canonical"></head><body><div id="root"></div></body></html>', { url: "https://example.test/" });
const originalFetch = globalThis.fetch;
Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true,
  // tsx uses classic JSX for components that Vite compiles with the automatic runtime.
  React });
const { createRoot } = await import("react-dom/client");
const { default: Reader } = await import("../../client/src/experimental/pages/PreviewPublicJudgment");
const { FormattedJudgmentText } = await import("../../client/src/components/formatted-judgment-text");
let root: ReturnType<typeof createRoot>;
type Pending = { signal?: AbortSignal | null; resolve: (value: any) => void; reject: (reason: Error) => void };
let pending: Map<string, Pending>;
const one = "00000000-0000-4000-8000-000000000001";
const two = "00000000-0000-4000-8000-000000000002";

function record(id: string, title: string, extra: Record<string, any> = {}) {
  return { id, title, citation: id === one ? "2024 SCMR 1085" : "2025 SCMR 999", court: "Supreme Court",
    petitioner: null, respondent: null, decisionDate: null, headnotes: null,
    previewText: `Judgment of ${title}`, previewWordCount: 5, totalWordCount: 5, isPreview: false, isTruncated: false,
    textIntegrity: "own", citations: { made: [], received: [] }, ...extra };
}
async function show(id: string) {
  await act(async () => root.render(React.createElement(Router, { hook: () => ["/", () => {}] }, React.createElement(Reader, { id }))));
}
async function respond(id: string, data: any) {
  await act(async () => pending.get(id)!.resolve({ ok: true, json: async () => data }));
}
beforeEach(() => {
  pending = new Map();
  // Deliberately allow aborted fetches to resolve, exercising the stale-response guard too.
  globalThis.fetch = ((url: string, options?: RequestInit) => new Promise((resolve, reject) => {
    pending.set(decodeURIComponent(url.split("/").at(-1)!), { signal: options?.signal, resolve, reject });
  })) as typeof fetch;
  root = createRoot(document.getElementById("root")!);
});
afterEach(async () => {
  await act(async () => root.unmount());
  globalThis.fetch = originalFetch;
});
after(() => dom.window.close());

test("late judgment responses cannot replace the case at the current URL", async () => {
  await show(one);
  await show(two);
  assert.equal(pending.get(one)!.signal?.aborted, true);
  await respond(two, record(two, "New Case vs State"));
  await respond(one, record(one, "Old Case vs State"));
  assert.equal(document.querySelector("h1")?.textContent?.trim(), "New Case vs State");
  assert.doesNotMatch(document.body.textContent || "", /Old Case/);
  assert.match(document.title, /New Case/);
  assert.equal(document.querySelector("#canonical-link")?.getAttribute("href"), `https://www.alwakeelo.com/judgment/${two}`);
});

test("navigation removes the previous judgment and its metadata while the next case loads", async () => {
  await show(one);
  await respond(one, record(one, "Old Case vs State"));
  await show(two);
  assert.doesNotMatch(document.body.textContent || "", /Old Case/);
  assert.doesNotMatch(document.title, /Old Case/);
  assert.equal(document.querySelector('script[type="application/ld+json"]'), null);
  assert.match(document.querySelector('meta[name="robots"]')?.getAttribute("content") || "", /noindex/);
  await respond(two, record(two, "New Case vs State"));
});

test("an obsolete request error cannot replace a successfully loaded judgment", async () => {
  await show(one);
  await show(two);
  await respond(two, record(two, "New Case vs State"));
  await act(async () => pending.get(one)!.reject(new Error("Old request failed")));
  assert.match(document.querySelector("h1")?.textContent || "", /New Case/);
  assert.doesNotMatch(document.body.textContent || "", /Old request failed/);
});

test("the public reader cannot link the current citation to an incoming citing judgment", async () => {
  await show(one);
  await respond(one, record(one, "Current Case vs State", {
    previewText: "2024 SCMR 1085\n\nReferences include 2025 SCMR 999.",
    citations: { made: [], received: [{ citationText: "2024 SCMR 1085", linkedCitation: "2025 SCMR 999", linkedJudgmentId: two }] },
  }));
  const links = [...document.querySelectorAll("a")];
  assert.equal(links.find(a => a.textContent === "2024 SCMR 1085")?.getAttribute("href"), "/citation-search?q=2024%20SCMR%201085");
  assert.equal(links.find(a => a.textContent === "2025 SCMR 999")?.getAttribute("href"), `/judgment/${two}`);
});

test("unconfirmed text and PDF remain accessible without publishing confirmed-case metadata", async () => {
  await show(one);
  await respond(one, record(one, "Unconfirmed Case", {
    textIntegrity: "unknown", textWarning: "Identity unconfirmed", contentFormat: "text_and_pdf", pdfUrl: "https://example.test/original.pdf",
  }));
  assert.match(document.body.textContent || "", /Judgment of Unconfirmed Case/);
  assert.match(document.body.textContent || "", /Identity unconfirmed/);
  assert.equal(document.querySelector('script[type="application/ld+json"]'), null);
  assert.match(document.querySelector('meta[name="robots"]')?.getAttribute("content") || "", /noindex/);
});

test("PDF-only records keep their original PDF and noindex warning", async () => {
  await show(one);
  await respond(one, record(one, "Unconfirmed Case", {
    previewText: "", textIntegrity: "missing", textWarning: "PDF identity unconfirmed", contentFormat: "pdf", pdfUrl: "https://example.test/original.pdf",
  }));
  assert.equal(document.querySelector("iframe")?.getAttribute("src"), "https://example.test/original.pdf");
  assert.match(document.body.textContent || "", /PDF identity unconfirmed/);
  assert.equal(document.querySelector('script[type="application/ld+json"]'), null);
});

test("citation lookups use the resolved judgment UUID in canonical metadata", async () => {
  await show("2024-SCMR-1085");
  await respond("2024-SCMR-1085", record(one, "Resolved Case vs State"));
  assert.equal(document.querySelector("#canonical-link")?.getAttribute("href"), `https://www.alwakeelo.com/judgment/${one}`);
  assert.match(document.title, /Resolved Case/);
});

test("formatted judgment text can change between empty and loaded without changing hook order", async () => {
  for (const text of ["", "2024 SCMR 1085", "", "Plain judgment text"]) {
    await act(async () => root.render(React.createElement(Router, { hook: () => ["/", () => {}] }, React.createElement(FormattedJudgmentText, { text }))));
    assert.match(document.body.textContent || "", new RegExp(text || "Text is not available"));
  }
});
