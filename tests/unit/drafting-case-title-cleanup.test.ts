import test from "node:test";
import assert from "node:assert/strict";
import { cleanCaseTitle } from "../../server/tools/citation-search-tool";

/**
 * Real titles sampled from the live corpus. Scraped rows carry trailing
 * artifacts, and some lost their opening words entirely — a draft copying one of
 * those verbatim printed "2024 SCMR 168 (Ltd.".
 */
test("trailing scrape artifacts are trimmed", () => {
  assert.equal(
    cleanCaseTitle("MUHAMMAD ASHRAF ANJUM VS SABIR HUSSAINHonorable"),
    "MUHAMMAD ASHRAF ANJUM VS SABIR HUSSAIN",
  );
  assert.equal(
    cleanCaseTitle("MUHAMMAD ASGHAR vs HUSSAIN AHMAD and others Case No"),
    "MUHAMMAD ASGHAR vs HUSSAIN AHMAD and others",
  );
});

test("a clean title is left alone", () => {
  const good = "Muhammad Rafique and Others vs Manzoor Ahmad and Others";
  assert.equal(cleanCaseTitle(good), good);
});

test("a title that begins mid-name is dropped, not printed", () => {
  for (const broken of [
    "Ltd. and others v. Messrs Educational Excellence Ltd. and another",
    "and others vs The State",
    "vs Muhammad Younus",
    "through Chief Executive",
    "and another",
  ]) {
    assert.equal(cleanCaseTitle(broken), "", `kept a broken title: ${broken}`);
  }
});

test("empty and junk input yield an empty title", () => {
  for (const input of [undefined, null, "", "   ", "Case No", "Honorable"]) {
    assert.equal(cleanCaseTitle(input as string), "");
  }
});

/**
 * Rows with no real title carry a generated stand-in. Treating one as the record
 * made the drafter replace the party names it had written —
 * "MUHAMMAD HANIF S. KALIA and 2 others vs THE STATE" — with the stand-in itself.
 */
test("a generated stand-in is not a title", () => {
  for (const placeholder of [
    "Case reported at 2008 PCRLJ 1360",
    "Case cited as 2014 CLC 1229",
    "Judgment ORDER MANZOOR AHMAD MALIK, J.",
    "Result: Bail granted",
  ]) {
    assert.equal(cleanCaseTitle(placeholder), "", `kept a stand-in: ${placeholder}`);
  }
});

/**
 * 132,407 of 224,442 case_law rows carry no court at all. The citation usually
 * names the forum, so it is derived at read time rather than by migrating the
 * corpus — and left empty when the citation does not settle it, because a wrong
 * court is worse than none.
 */
import { inferCourtFromCitation } from "../../server/tools/citation-search-tool";

test("the reporter names the forum", () => {
  assert.equal(inferCourtFromCitation("2021 SCMR 822"), "Supreme Court of Pakistan");
  assert.equal(inferCourtFromCitation("PLD 2023 Supreme Court 617"), "Supreme Court of Pakistan");
  assert.equal(inferCourtFromCitation("2026 LHC 2882"), "Lahore High Court");
  assert.equal(inferCourtFromCitation("2020 PCRLJ Islamabad 392"), "Islamabad High Court");
  assert.equal(inferCourtFromCitation("PLJ 2018 Lahore 257"), "Lahore High Court");
});

test("a reporter that does not name a seat yields nothing", () => {
  for (const citation of ["2012 YLR 1880", "2014 CLC 1229", "2019 MLD 44", "", undefined]) {
    assert.equal(inferCourtFromCitation(citation as string), "", `guessed a court for ${citation}`);
  }
});
