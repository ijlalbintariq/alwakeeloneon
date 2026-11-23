import test from "node:test";
import assert from "node:assert/strict";

import { classifyQueryIntent } from "../../server/pipeline/intent-classifier";
import { needsRewrite, extractLocalTopicKeywords, type ConversationTurn } from "../../server/pipeline/query-rewriter";
import { buildContext } from "../../server/pipeline/context-builder";

test("Ali Aun regression: Writ Petition on family maintenance prioritizes 'family' topic over 'constitutional'", () => {
  const query = "I need a Pakistani Judgment on similar facts, where the Writ Petition was allowed on the ground that the lower courts failed to appreciate that the Husband did not have enough means, where the actual source of income of the husband was not proven.";
  const intent = classifyQueryIntent(query);

  assert.equal(intent.type, "case-law");
  assert.ok(intent.topics.length > 0, "Expected at least 1 topic");
  assert.equal(intent.topics[0].id, "family", "Primary topic must be 'family' for maintenance writ");
  assert.ok(intent.topics.some((t) => t.id === "constitutional"), "Expected 'constitutional' in top topics");
  assert.ok(intent.expandedQuery.includes("family") || intent.expandedTerms.some((t) => t.includes("family") || t.includes("muslim family laws")), "Expanded query must include family law terms");
});

test("Query rewriter recognizes dissatisfaction and redirection follow-ups as requiring rewrite", () => {
  assert.ok(needsRewrite("These Judgments are completely irrelevant.", true), "Must recognize 'These Judgments are completely irrelevant.'");
  assert.ok(needsRewrite("I need you to focus on the Judgments rendered in the Family Matters.", true), "Must recognize 'focus on'");
  assert.ok(needsRewrite("Those judgments do not apply here.", true), "Must recognize 'those judgments'");
  assert.ok(needsRewrite("Wrong cases given, please fix.", true), "Must recognize 'wrong cases'");
});

test("extractLocalTopicKeywords pulls family anchor keywords from conversation history", () => {
  const history: ConversationTurn[] = [
    { role: "user", content: "Sufyan Ali vs Family Judge. Writ Petition challenging maintenance decree against husband." },
    { role: "assistant", content: "Reviewing petition..." },
    { role: "user", content: "I need judgments where husband income was not proven." },
    { role: "assistant", content: "Here are cases..." },
  ];

  const extracted = extractLocalTopicKeywords("These Judgments are completely irrelevant.", history);
  assert.ok(extracted.includes("family") || extracted.includes("husband") || extracted.includes("maintenance"), "Extracted string must contain family/husband/maintenance context");
});

test("Zero-RAG safety gate activates when 0 case law hits are returned for case-law intent", () => {
  const query = "I need a Pakistani Judgment on similar facts, where the Writ Petition was allowed on the ground that the lower courts failed to appreciate that the Husband did not have enough means, where the actual source of income of the husband was not proven.";
  const intent = classifyQueryIntent(query);

  const emptyRetrieval = {
    caseLaw: [],
    statutes: [],
    adminDocs: [],
    diagnostics: { caseLawFetched: 0, statutesFetched: 0, adminDocsFetched: 0, durationMs: 5 },
  };

  const output = buildContext(intent, emptyRetrieval as any);
  assert.equal(output.hasCaseLawCitations, false);
  assert.ok(output.contextString.includes("SYSTEM SAFETY GATE — ZERO VERIFIED CASE LAW FOUND"), "Context must include zero-case-law safety gate");
  assert.ok(output.contextString.includes("NEVER cite Income Tax (PTD)"), "Context must explicitly ban tax analogies");
  assert.ok(output.contextString.includes("No matching verified precedents on these specific facts were found"), "Context must instruct stating no verified precedents were found");
});

test("Normal IRAC structure is preserved when verified case law exists", () => {
  const query = "maintenance of child under family courts act";
  const intent = classifyQueryIntent(query);

  const retrievalWithHits = {
    caseLaw: [
      {
        row: {
          citation: "2023 CLC 1234",
          court: "Lahore High Court",
          title: "Sufyan vs Mst. Sana",
          summary: "Family court cannot fix maintenance without evidence of husband financial capacity.",
        },
        relevanceScore: 90,
      },
    ],
    statutes: [],
    adminDocs: [],
    diagnostics: { caseLawFetched: 1, statutesFetched: 0, adminDocsFetched: 0, durationMs: 5 },
  };

  const output = buildContext(intent, retrievalWithHits as any);
  assert.equal(output.hasCaseLawCitations, true);
  assert.ok(output.contextString.includes("CASE LAW RULE (MANDATORY): You must structure your response using the IRAC method"));
  assert.ok(output.contextString.includes("2023 CLC 1234"));
});
