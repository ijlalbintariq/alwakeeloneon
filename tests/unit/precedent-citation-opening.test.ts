import assert from "node:assert/strict";
import test from "node:test";
import { getJudgmentDetail, getPrecedentTarget, hydrateCitationGraph, normalizePrecedentCitation } from "../../client/src/experimental/lib/judgmentApiClient";

test("Precedent citation key normalization resolves encoded, hyphenated and spaced citations", () => {
  const normBase = normalizePrecedentCitation("2020 SCMR 414");

  const normHyphen = normalizePrecedentCitation("2020-SCMR-414");
  assert.equal(normHyphen, normBase);

  const normEncoded = normalizePrecedentCitation("2020%20SCMR%20414");
  assert.equal(normEncoded, normBase);

  const normDoubleEncoded = normalizePrecedentCitation("2020%2520SCMR%2520414");
  assert.equal(normDoubleEncoded, normBase);
});

test("judgment detail resolves an encoded citation route to its canonical UUID", async (t) => {
  const judgment = {
    id: "5f3675dc-7cc9-4780-a48e-b4efa284ceb9",
    citation: "2020 SCMR 414",
  };

  const requests: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: string) => {
    requests.push(url);
    return Response.json(judgment);
  });
  assert.equal((await getJudgmentDetail("2020%2520SCMR%2520414"))?.id, judgment.id);
  assert.deepEqual(requests, ["/api/judgments/2020%20SCMR%20414"]);
});

test("getPrecedentTarget prefers real UUID or clean citation over extracted pseudo-id", () => {
  // Database record with real UUID
  const dbItem = {
    id: 620694,
    citationText: "2020 SCMR 414",
    linkedJudgmentId: "051428b6-9da8-49db-aeda-944c2afce15d",
    linkedCitation: "2026 MLD 563",
  };
  assert.equal(getPrecedentTarget(dbItem), "051428b6-9da8-49db-aeda-944c2afce15d");

  // Extracted regex citation item
  const extractedItem = {
    id: "extracted-2020SCMR293-1",
    citationText: "2020 SCMR 293",
    linkedJudgmentId: "extracted-2020SCMR293-1",
    linkedCitation: "2020 SCMR 293",
  };
  assert.equal(getPrecedentTarget(extractedItem), "2020 SCMR 293");

  // Item with only citationText
  const textOnlyItem = {
    id: "extracted-2019SCMR542-2",
    citationText: "2019 SCMR 542",
  };
  assert.equal(getPrecedentTarget(textOnlyItem), "2019 SCMR 542");
});

test("hydrateCitationGraph extracts citations from judgment text and filters self-citations", () => {
  const currentCitation = "2020 SCMR 414";
  const fullText = `
    guidance has been sought from 2020 SCMR 414 (Nadar Wali v. Sumaya Gul),
    2020 SCMR 293 (Naseer Khan v. Said Qadeem), and 2019 SCMR 542 (Talal Ahmed).
  `;

  const graph = hydrateCitationGraph(currentCitation, [], [], fullText);

  // Self reference "2020 SCMR 414" must be filtered out
  const selfRef = graph.made.find(
    (c) => c.linkedCitation === "2020 SCMR 414" || c.citationText === "2020 SCMR 414"
  );
  assert.equal(selfRef, undefined, "Must filter out self citation");

  // Outbound citations extracted
  const naseerKhan = graph.made.find((c) => c.linkedCitation === "2020 SCMR 293");
  assert.ok(naseerKhan, "Must extract 2020 SCMR 293");

  const talalAhmed = graph.made.find((c) => c.linkedCitation === "2019 SCMR 542");
  assert.ok(talalAhmed, "Must extract 2019 SCMR 542");
});
