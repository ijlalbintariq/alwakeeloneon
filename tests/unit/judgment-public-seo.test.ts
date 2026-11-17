import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { publicJudgmentSeo, judgmentDecisionDate, JudgmentCitationSummary } from "../../shared/judgment-public-seo";

const record = { id: "example", title: "Example v. State", citation: "Example citation", court: "Example court", decisionDate: "2024-01-15", textIntegrity: "own" };

test("server-rendered citation summary matches structured identity and escapes case text", () => {
  const malicious = { ...record, title: '</script><script>alert(1)</script>' };
  const html = renderToStaticMarkup(createElement(JudgmentCitationSummary, { record: malicious }));
  assert.doesNotMatch(html, /<script/);
  assert.match(html, /&lt;script&gt;/);
  const seo = publicJudgmentSeo(record);
  assert.equal(seo.schema?.["@graph"][0].description, seo.description);
  assert.match(renderToStaticMarkup(createElement(JudgmentCitationSummary, { record })), /2024-01-15/);
  assert.equal(seo.schema?.["@graph"][1].identifier, record.citation);
  assert.equal(seo.schema?.["@graph"][1].dateCreated, "2024-01-15");
});

test("missing identity fields do not invent court, citation, dates or authors", () => {
  const seo = publicJudgmentSeo({ id: "example", textIntegrity: "own" });
  const judgment = seo.schema!["@graph"][1];
  for (const key of ["creator", "identifier", "dateCreated", "author", "issn", "datePublished"]) assert.equal(key in judgment, false);
  assert.equal(judgmentDecisionDate("invalid"), undefined);
  assert.equal(judgmentDecisionDate(null), undefined);
  assert.doesNotThrow(() => publicJudgmentSeo({ ...record, decisionDate: "invalid" }));
});

test("unconfirmed records cannot publish confirmed judgment schema or citation guidance", () => {
  for (const textIntegrity of ["unknown", "mislabeled", undefined]) {
    const input = { ...record, textIntegrity };
    const seo = publicJudgmentSeo(input);
    assert.equal(seo.schema, null);
    assert.doesNotMatch(seo.description, /Example v/);
    assert.equal(renderToStaticMarkup(createElement(JudgmentCitationSummary, { record: input })), "");
  }
});
