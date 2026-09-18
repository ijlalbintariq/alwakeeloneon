import test from "node:test";
import assert from "node:assert/strict";
import { heading } from "../../server/legal-drafting-followup";
import { normalizeCourtReadyDraftingText } from "../../server/routes";
import * as TEMPLATES from "../../client/src/lib/pakistan-court-templates";

/**
 * Mirrors the heading checks in validateDraftForSelectedType (server/routes.ts).
 * Those regexes used to demand a bare "PRAYER" on its own line, which no shipped
 * template writes — all 27 use the letter-spaced "P R A Y E R:" — so complete,
 * correctly drafted pleadings were rejected with "Missing heading: PRAYER".
 */
const HEADING_SHEWETH = heading("MOST RESPECTFULLY SHEWETH", "RESPECTFULLY SHEWETH");
/**
 * Kept byte-identical to HEADING_PRAYER in server/routes.ts. Enumerating variants
 * does not hold — drafts write "MAIN PRAYER AND ANY OTHER RELIEF:" — so this
 * matches any all-capitals heading line naming the prayer. No `i` flag: with it,
 * `[^a-z]` would exclude capitals too and the lookahead could never pass.
 */
const HEADING_PRAYER =
  /^[ \t]*(?=[^a-z\n]*$)[^\n]{0,60}?\b(?:P[ \t]*R[ \t]*A[ \t]*Y[ \t]*E[ \t]*R|R[ \t]*E[ \t]*L[ \t]*I[ \t]*E[ \t]*F[ \t]+(?:S[ \t]*O[ \t]*U[ \t]*G[ \t]*H[ \t]*T|C[ \t]*L[ \t]*A[ \t]*I[ \t]*M[ \t]*E[ \t]*D))\b[^\n]{0,40}$/m;
const HEADING_VERIFICATION = heading("VERIFICATION", "AFFIDAVIT");
const HEADING_VERSUS = heading("VERSUS", "IN RE", "VS", "V/S");

/** Deeds, notices and instruments are skipped by NON_COURT_DOC_TYPES. */
const NOT_A_PLEADING = /NOTICE|POWER_OF_ATTORNEY|SALE_DEED|VAKALATNAMA|AFFIDAVIT|NIKAH|AUTHORITY_LETTER/;
/** An execution application opens with the Order XXI Rule 11(2) tabular statement. */
const NO_SHEWETH = /EXECUTION_ORDER21/;
/** Applications inside a pending suit reuse the suit's cause title. */
const NO_VERSUS = /STAY_ORDER39|CIVIL_MISC/;

function courtTemplates(): Array<[string, string]> {
  return Object.entries(TEMPLATES).filter(
    ([name, body]) =>
      typeof body === "string" && /COURT|BEFORE/i.test(body) && !NOT_A_PLEADING.test(name),
  ) as Array<[string, string]>;
}

test("every shipped court template satisfies the heading checks", () => {
  const templates = courtTemplates();
  assert.ok(templates.length >= 20, `only found ${templates.length} court templates`);

  const failures: string[] = [];
  for (const [name, body] of templates) {
    const text = normalizeCourtReadyDraftingText(body);
    if (!HEADING_PRAYER.test(text)) failures.push(`${name}: PRAYER`);
    if (!HEADING_VERIFICATION.test(text)) failures.push(`${name}: VERIFICATION/AFFIDAVIT`);
    if (!NO_SHEWETH.test(name) && !HEADING_SHEWETH.test(text)) failures.push(`${name}: SHEWETH`);
    if (!NO_VERSUS.test(name) && !HEADING_VERSUS.test(text)) failures.push(`${name}: VERSUS`);
  }
  assert.deepEqual(failures, [], `templates rejected by the validator:\n${failures.join("\n")}`);
});

test("real-world prayer headings are accepted", () => {
  for (const line of [
    "PRAYER",
    "PRAYER:",
    "P R A Y E R:",
    "MAIN PRAYER:",
    "INTERIM PRAYER",
    "PRAYER CLAUSE:",
    "RELIEF SOUGHT:",
    "RELIEF CLAIMED",
    "PRAYER AND RELIEF SOUGHT:",
    // What the model actually returned on a live writ-petition rewrite.
    "MAIN PRAYER AND ANY OTHER RELIEF:",
  ]) {
    assert.ok(HEADING_PRAYER.test(`TEXT ABOVE\n${line}\ntext below`), `rejected "${line}"`);
  }
});

test("prayer wording inside running text is not a heading", () => {
  for (const body of [
    "It is prayed that the PRAYER of the petitioner be granted in full.",
    "It is prayed that bail may be granted.",
    "1. That the prayer clause is vague and must be redrafted by counsel.",
    "GROUNDS:",
    "BRIEF FACTS:",
    "VERIFICATION:",
    // Interim relief on its own is not the prayer; a draft with only this
    // should still be flagged.
    "INTERIM RELIEF",
  ]) {
    assert.equal(HEADING_PRAYER.test(`TEXT ABOVE\n${body}\nTEXT BELOW`), false, `matched "${body}"`);
  }
});

test("MOST RESPECTFULLY SHEWETH is accepted with and without the prefix", () => {
  assert.ok(HEADING_SHEWETH.test("x\nMOST RESPECTFULLY SHEWETH:\ny"));
  assert.ok(HEADING_SHEWETH.test("x\nRESPECTFULLY SHEWETH:\ny"));
  assert.ok(HEADING_SHEWETH.test("x\nM O S T  R E S P E C T F U L L Y  S H E W E T H:\ny"));
});
