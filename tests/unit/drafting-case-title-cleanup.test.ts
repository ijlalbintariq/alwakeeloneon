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
