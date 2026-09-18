import test from "node:test";
import assert from "node:assert/strict";
import { normalizeCourtReadyDraftingText, collectDraftAdvisories } from "../../server/routes";

/**
 * Guards two output defects seen in a real generated bail application:
 *  1. "That there is no apprehension" became "That the there is no apprehension".
 *  2. The INDEX OF DOCUMENTS table landed on the memo page instead of the cover page.
 */

test("leading-phrase pass does not insert an article before words that reject one", () => {
  const draft = [
    "GROUNDS",
    "",
    "A. That there is no apprehension of the accused absconding.",
    "B. That they have deep roots in society.",
    "C. That all the prosecution witnesses are police officials.",
    "D. That the recovery is disputed.",
    "E. Applicant is a first-time offender.",
  ].join("\n");

  const out = normalizeCourtReadyDraftingText(draft);

  assert.doesNotMatch(out, /That the there\b/i, 'produced "That the there"');
  assert.doesNotMatch(out, /That the they\b/i, 'produced "That the they"');
  assert.doesNotMatch(out, /That the all\b/i, 'produced "That the all"');
  assert.match(out, /A\. That there is no apprehension/);
  assert.match(out, /B\. That they have deep roots/);
  assert.match(out, /C\. That all the prosecution witnesses/);
  // A genuine noun phrase still keeps its article, and a bare sentence still gains one.
  assert.match(out, /D\. That the recovery is disputed/);
  assert.match(out, /E\. That the [Aa]pplicant is a first-time offender/);
});

test("a ground caption on the same line as its text is left as a heading", () => {
  const draft = [
    "GROUNDS",
    "",
    "A. FALSE IMPLICATION AND LACK OF EVIDENCE: The applicant has been falsely implicated.",
    "B. CASE OF FURTHER INQUIRY: That the case falls within Section 497(2) Cr.P.C.",
    "C. NO PRIOR CONVICTION: That there is no previous criminal history.",
  ].join("\n");

  const out = normalizeCourtReadyDraftingText(draft);

  assert.doesNotMatch(out, /That the FALSE IMPLICATION/, "caption was rewritten as body text");
  assert.doesNotMatch(out, /That the CASE OF FURTHER INQUIRY/, "caption was rewritten as body text");
  assert.doesNotMatch(out, /That the NO PRIOR CONVICTION/, "caption was rewritten as body text");
  // Caption preserved, and the sentence after the colon still gets the leading phrase.
  assert.match(out, /A\. FALSE IMPLICATION AND LACK OF EVIDENCE: That the applicant has been falsely implicated/);
  assert.match(out, /B\. CASE OF FURTHER INQUIRY: That the case falls within/);
  assert.match(out, /C\. NO PRIOR CONVICTION: That there is no previous criminal history/);
});

test("advisories report shortfalls against the drafting standard", () => {
  const thin = "IN THE COURT OF THE SESSIONS JUDGE, LAHORE\nRESPECTFULLY SHEWETH:\n" + "word ".repeat(200);
  const thinOut = collectDraftAdvisories(thin, "sessions-bail-application");
  assert.equal(thinOut.length, 2, `expected length + citation advisories, got ${JSON.stringify(thinOut)}`);
  assert.match(thinOut.join(" "), /at least 1000/);
  assert.match(thinOut.join(" "), /0 case law authority/);

  // Meets both bars: over the floor and three distinct authorities.
  const full =
    "word ".repeat(1600) +
    " 2014 SCMR 1365 and 2011 SCMR 1606 and PLD 2022 Lahore 684 are relied upon.";
  assert.deepEqual(collectDraftAdvisories(full, "sessions-bail-application"), []);

  // Non-court filings carry no citation expectation and no word floor.
  assert.deepEqual(collectDraftAdvisories("Short affidavit text.", "affidavit"), []);
});

test("advisory citation count trusts the verified list over prose scanning", () => {
  // Corpus citations are not uniformly spaced; a prose regex misses "2024SHC826".
  const draft = "word ".repeat(1600) + " Relying on 2024SHC826, 2024SHC804 and 2023 SCMR 1773.";
  assert.deepEqual(collectDraftAdvisories(draft, "sessions-bail-application", 3), []);
  assert.deepEqual(
    collectDraftAdvisories(draft, "sessions-bail-application", 1),
    ["Only 1 case law authority(ies) cited; the drafting standard expects 3."],
  );
});
