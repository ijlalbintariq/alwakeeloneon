import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { prepareLegalDraftInput } from "../../server/legal-drafting-context";

test("legal drafting input preserves content beyond the old client cutoff", () => {
  const tailSentinel = "TAIL_SECTION_MUST_REACH_THE_MODEL";
  const input = `<p>${"That the petitioner states a material fact. ".repeat(500)}</p><h2>${tailSentinel}</h2>`;
  const prepared = prepareLegalDraftInput(input);

  assert.ok(prepared.cleanedText.length > 12_000);
  assert.match(prepared.cleanedText, new RegExp(tailSentinel));
});

test("cheque notice uses Pakistan Section 489-F instead of an Indian statutory template", () => {
  const source = readFileSync(new URL("../../client/src/pages/legal-drafting.tsx", import.meta.url), "utf8");

  assert.match(source, /Cheque Dishonour Notice \(Section 489-F PPC\)/);
  assert.doesNotMatch(source, /LEGAL NOTICE UNDER SECTION 138 OF THE NEGOTIABLE INSTRUMENTS ACT/);
  assert.doesNotMatch(source, /Statutory 15-day demand notice/);
});
