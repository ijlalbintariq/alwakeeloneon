import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { LegalPageBreak } from "../../client/src/lib/legal-page-break";
import {
  buildLegalPageCssVariables,
  DEFAULT_LEGAL_PAGE_PROFILE_ID,
  LEGAL_PAGE_PROFILES,
  resolveLegalPageProfile,
} from "../../client/src/lib/legal-page-layout";
import { plainTextToTiptapHTML } from "../../client/src/lib/plain-to-tiptap";

test("legal page profiles keep positive court content areas", () => {
  assert.equal(DEFAULT_LEGAL_PAGE_PROFILE_ID, "court-legal");
  assert.equal(resolveLegalPageProfile("unknown").id, "court-legal");

  for (const profile of Object.values(LEGAL_PAGE_PROFILES)) {
    assert.ok(profile.widthMm > profile.marginLeftMm + profile.marginRightMm);
    assert.ok(profile.heightMm > profile.marginTopMm + profile.marginBottomMm);
    const variables = buildLegalPageCssVariables(profile.id);
    assert.match(variables["--legal-page-width"], /px$/);
    assert.match(variables["--legal-content-height"], /px$/);
  }
});

test("manual legal page breaks survive Tiptap serialization", () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  const globals = globalThis as Record<string, unknown>;
  globals.window = dom.window;
  globals.document = dom.window.document;
  globals.Node = dom.window.Node;
  globals.HTMLElement = dom.window.HTMLElement;
  globals.DOMParser = dom.window.DOMParser;
  globals.MutationObserver = dom.window.MutationObserver;

  const editor = new Editor({
    extensions: [StarterKit, LegalPageBreak],
    content: '<p>Opening</p><div data-type="legal-page-break" data-page-break="true"></div><h2>Affidavit</h2>',
  });

  assert.match(editor.getHTML(), /data-type="legal-page-break"/);
  assert.equal(editor.getText().includes("PAGE BREAK"), false);
  assert.equal(editor.commands.insertLegalPageBreak(), true);
  assert.equal((editor.getHTML().match(/data-type="legal-page-break"/g) || []).length, 2);

  editor.destroy();
  dom.window.close();
});

test("court section conversion uses only intentional manual page breaks", () => {
  const html = plainTextToTiptapHTML([
    "IN THE COURT OF THE CIVIL JUDGE",
    "RESPECTFULLY SHEWETH:",
    "1. That the applicant seeks relief.",
    "AFFIDAVIT",
    "Verified on oath.",
  ].join("\n\n"));

  assert.doesNotMatch(html, /data-page-break[^>]*><\/div><h2>RESPECTFULLY SHEWETH/);
  assert.match(html, /data-type="legal-page-break"[^>]*><\/div><h2>AFFIDAVIT<\/h2>/);
});

test("print CSS uses named Legal and A4 page profiles", () => {
  const css = readFileSync(new URL("../../client/src/index.css", import.meta.url), "utf8");
  assert.match(css, /@page legal-court\s*{/);
  assert.match(css, /size:\s*8\.5in 14in/);
  assert.match(css, /@page legal-a4\s*{/);
  assert.doesNotMatch(css, /@page\s*{[^}]*size:\s*A4/s);
});
