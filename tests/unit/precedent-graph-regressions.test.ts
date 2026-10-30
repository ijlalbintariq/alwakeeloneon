import test from "node:test";
import assert from "node:assert/strict";
import { getCitationTreatment, getPrecedentTarget, hydrateCitationGraph, normalizePrecedentCitation } from "../../client/src/experimental/lib/judgmentApiClient";
import type { PrecedentCitationItem } from "../../client/src/experimental/components/judgments/OverruledAlertBanner";

const edge = (citation: string, extra: Partial<PrecedentCitationItem> = {}): PrecedentCitationItem => ({ id: 1, citationText: citation, linkedCitation: citation, citationType: "referred_to", linkedJudgmentId: null, linkedTitle: null, contextExcerpt: null, ...extra });

test("graph hydration extracts journal-first PLD, dotted reporters and year-first citations", () => {
  const graph = hydrateCitationGraph("2026 SCMR 99", [], [], "The judgment refers to PLD 2024 SC 17, P.L.D. 2020 Lahore 41, 2023 SCMR 58 and 2022 P.Cr.L.J. 66.");
  assert.deepEqual(graph.made.map((item) => item.citationText), ["PLD 2024 SC 17", "PLD 2020 Lahore 41", "2023 SCMR 58", "2022 PCRLJ 66"]);
  assert.match(graph.made[0].contextExcerpt!, /judgment refers to/);
  assert.equal(graph.received.length, 0);
});

test("equivalent citation forms remove self-links and repeated hydration remains idempotent", () => {
  assert.equal(normalizePrecedentCitation("PLD 2020 Lahore 41"), normalizePrecedentCitation("2020 PLD LHC 41"));
  assert.equal(normalizePrecedentCitation("2023-SCMR-58"), normalizePrecedentCitation("2023%2520SCMR%252058"));
  assert.equal(normalizePrecedentCitation("2023-SCMR-58"), normalizePrecedentCitation("2023 SCMR 58"));
  const made = [edge("PLD 2020 LHC 41"), edge("2023 SCMR 58", { citationType: "relied_upon", linkedJudgmentId: "real-id" }), edge(" 2023  SCMR 58 ", { id: 2, citationType: "relied upon" })];
  const text = "PLD 2020 Lahore 41 refers to 2023 SCMR 58 and PLD 2024 SC 17. PLD 2024 SC 17 is also discussed.";
  const graph = hydrateCitationGraph("PLD 2020 Lahore 41", made, [edge("PLD 2020 LHC 41")], text);
  assert.equal(graph.made.length, 2);
  assert.equal(graph.received.length, 0);
  assert.equal(graph.made[0].citationType, "relied_upon");
  assert.equal(graph.made[0].linkedJudgmentId, "real-id");
  assert.deepEqual(hydrateCitationGraph("PLD 2020 Lahore 41", graph.made, graph.received, text), graph);
});

test("duplicate graph links retain resolved IDs and different recorded treatments", () => {
  const graph = hydrateCitationGraph("2026 SCMR 99", [edge("2023 SCMR 58"), edge("2023 SCMR 58", { linkedJudgmentId: "resolved", linkedTitle: "Resolved title" }), edge("2023 SCMR 58", { id: 3, citationType: "distinguished" })], [edge("2023 SCMR 58")]);
  assert.equal(graph.made.length, 2);
  assert.equal(graph.received.length, 1);
  assert.equal(graph.made[0].linkedJudgmentId, "resolved");
  assert.equal(graph.made[0].linkedTitle, "Resolved title");
});

test("graph hydration ignores malformed inputs and never invents placeholder nodes", () => {
  assert.deepEqual(hydrateCitationGraph("2026 SCMR 99", null as any, {} as any, "No reported authorities."), { made: [], received: [] });
  assert.deepEqual(hydrateCitationGraph("2026 SCMR 99", [null as any, edge("")]), { made: [], received: [] });
});

test("precedent navigation accepts numeric IDs, cleans whitespace and rejects edge pseudo-IDs", () => {
  assert.equal(getPrecedentTarget(edge("2023 SCMR 58", { linkedJudgmentId: 27 as any })), "27");
  assert.equal(getPrecedentTarget(edge("2023 SCMR 58", { linkedJudgmentId: " EXTRACTED-anything " })), "2023 SCMR 58");
  assert.equal(getPrecedentTarget(edge("2023 SCMR 58", { linkedCitation: "  " })), "2023 SCMR 58");
  assert.equal(getPrecedentTarget(edge("", { id: "extracted-unresolved-1" })), "");
});

test("treatment filters use the same groups as badges and negative-treatment warnings", () => {
  for (const type of ["followed", "Approved", "RELIED UPON"]) assert.equal(getCitationTreatment(type), "relied_upon");
  for (const type of ["disapproved", "REVERSED", "Overruled By"]) assert.equal(getCitationTreatment(type), "overruled");
  for (const type of ["Explained", "DISTINGUISHED"]) assert.equal(getCitationTreatment(type), "distinguished");
  assert.equal(getCitationTreatment(undefined), "referred_to");
});
