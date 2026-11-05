import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Router } from "wouter";
import { FormattedJudgmentText } from "../../client/src/components/formatted-judgment-text";
import { buildJudgmentCitationMap, judgmentCitationHref, type JudgmentCitations } from "../../shared/judgment-links";

const citedId = "00000000-0000-4000-8000-000000000001";
const citingId = "00000000-0000-4000-8000-000000000002";
const citation = "2024 SCMR 1085";
const citingCitation = "2025 SCMR 999";

function render(text: string, citations: JudgmentCitations) {
  return renderToStaticMarkup(React.createElement(Router, { ssrPath: `/judgment/${citedId}` },
    React.createElement(FormattedJudgmentText, { text, citations })));
}

test("received citations cannot redirect the current case's citation to its citing case", () => {
  const html = render(citation, { made: [], received: [{ citationText: citation, linkedCitation: citingCitation, linkedJudgmentId: citingId }] });
  assert.match(html, /href="\/citation-search\?q=2024%20SCMR%201085"/);
  assert.doesNotMatch(html, new RegExp(`/judgment/${citingId}`));
});

test("outgoing and incoming links use only the linked judgment's own citation", () => {
  const references = {
    made: [{ citationText: citation, linkedCitation: citation, linkedJudgmentId: citedId }],
    received: [{ citationText: citation, linkedCitation: citingCitation, linkedJudgmentId: citingId }],
  };
  const html = render(`${citation}; ${citingCitation}`, references);
  assert.match(html, new RegExp(`href="/judgment/${citedId}"[^>]*>${citation}</a>`));
  assert.match(html, new RegExp(`href="/judgment/${citingId}"[^>]*>${citingCitation}</a>`));
});

test("a stale or incorrect graph edge cannot attach its raw citation to another record", () => {
  const html = render(citation, [{ citationText: citation, linkedCitation: citingCitation, linkedJudgmentId: citingId }]);
  assert.doesNotMatch(html, new RegExp(`/judgment/${citingId}`));
  assert.match(html, /href="\/citation-search/);
  assert.equal(buildJudgmentCitationMap([{ citationText: citation, linkedJudgmentId: citingId }]).size, 0);
});

test("ambiguous citations use search regardless of edge order or repeated candidates", () => {
  const one = { linkedCitation: citation, linkedJudgmentId: citedId };
  const two = { linkedCitation: citation, linkedJudgmentId: citingId };
  for (const entries of [[one, two, one], [two, one, two]]) {
    assert.equal(judgmentCitationHref(citation, buildJudgmentCitationMap(entries)), "/citation-search?q=2024%20SCMR%201085");
  }
  assert.equal(judgmentCitationHref(citation, buildJudgmentCitationMap([one, one])), `/judgment/${citedId}`);
});

test("missing, numeric and malformed target IDs never become direct judgment links", () => {
  for (const id of [null, 123, "extracted-2024-SCMR-1085", "../../wrong-case", 'id" onclick="bad']) {
    const map = buildJudgmentCitationMap([{ linkedCitation: citation, linkedJudgmentId: id }]);
    assert.equal(map.size, 0);
  }
  assert.equal(judgmentCitationHref(citation, new Map([["2024SCMR1085", "../../wrong-case"]])), "/citation-search?q=2024%20SCMR%201085");
});

test("citation links preserve explicit court qualifiers and distinct reporter pages", () => {
  const map = buildJudgmentCitationMap([
    { linkedCitation: "PLD 2022 Sindh 565", linkedJudgmentId: citedId },
    { linkedCitation: "2001 SCMR 1986", linkedJudgmentId: citingId },
  ]);
  assert.equal(judgmentCitationHref("PLD 2022 SC 565", map), "/citation-search?q=PLD%202022%20SC%20565");
  assert.equal(judgmentCitationHref("2001 SCMR 198", map), "/citation-search?q=2001%20SCMR%20198");
  assert.equal(judgmentCitationHref("2001 SCMR 1986", map), `/judgment/${citingId}`);
});
