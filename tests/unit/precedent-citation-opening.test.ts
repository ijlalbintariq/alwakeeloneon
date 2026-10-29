import assert from "node:assert/strict";
import test from "node:test";
import { hydrateCitationGraph } from "../../client/src/experimental/lib/judgmentApiClient";

function normalizeCitationKey(str?: string | null): string {
  if (!str) return "";
  let s = str;
  try {
    s = decodeURIComponent(s);
    if (s.includes("%")) s = decodeURIComponent(s);
  } catch {}
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function doesJudgmentMatchRoute(
  judgment: { id: string; citation: string } | null,
  routeId?: string | null
): boolean {
  if (!judgment || !routeId) return false;
  let decodedRoute = routeId;
  try {
    decodedRoute = decodeURIComponent(routeId);
    if (decodedRoute.includes("%")) decodedRoute = decodeURIComponent(decodedRoute);
  } catch {}

  if (judgment.id === routeId || judgment.id === decodedRoute) return true;

  const normRoute = normalizeCitationKey(decodedRoute);
  const normCitation = normalizeCitationKey(judgment.citation);
  if (normRoute && normCitation && normRoute === normCitation) return true;

  return false;
}

const getTargetJudgmentId = (item: {
  id?: string | number;
  linkedJudgmentId?: string | null;
  linkedCitation?: string | null;
  citationText?: string;
}): string => {
  if (item.linkedJudgmentId && !item.linkedJudgmentId.startsWith("extracted-")) {
    return item.linkedJudgmentId;
  }
  if (item.linkedCitation) return item.linkedCitation;
  if (item.citationText) return item.citationText;
  return String(item.id || "").replace(/^extracted-/i, "");
};

test("Precedent citation key normalization resolves encoded, hyphenated and spaced citations", () => {
  const normBase = normalizeCitationKey("2020 SCMR 414");
  assert.equal(normBase, "2020scmr414");

  const normHyphen = normalizeCitationKey("2020-SCMR-414");
  assert.equal(normHyphen, normBase);

  const normEncoded = normalizeCitationKey("2020%20SCMR%20414");
  assert.equal(normEncoded, normBase);

  const normDoubleEncoded = normalizeCitationKey("2020%2520SCMR%2520414");
  assert.equal(normDoubleEncoded, normBase);
});

test("doesJudgmentMatchRoute prevents infinite re-render loop when URL has citation slug and judgment has UUID", () => {
  const judgment = {
    id: "5f3675dc-7cc9-4780-a48e-b4efa284ceb9",
    citation: "2020 SCMR 414",
  };

  // 1. Direct UUID match
  assert.equal(doesJudgmentMatchRoute(judgment, "5f3675dc-7cc9-4780-a48e-b4efa284ceb9"), true);

  // 2. Hyphenated citation slug from URL route
  assert.equal(doesJudgmentMatchRoute(judgment, "2020-SCMR-414"), true);

  // 3. Spaced URL encoded route
  assert.equal(doesJudgmentMatchRoute(judgment, "2020%20SCMR%20414"), true);

  // 4. Double encoded URL route
  assert.equal(doesJudgmentMatchRoute(judgment, "2020%2520SCMR%2520414"), true);

  // 5. Unrelated case should return false
  assert.equal(doesJudgmentMatchRoute(judgment, "2026-MLD-563"), false);
});

test("getTargetJudgmentId prefers real UUID or clean citation over extracted pseudo-id", () => {
  // Database record with real UUID
  const dbItem = {
    id: 620694,
    citationText: "2020 SCMR 414",
    linkedJudgmentId: "051428b6-9da8-49db-aeda-944c2afce15d",
    linkedCitation: "2026 MLD 563",
  };
  assert.equal(getTargetJudgmentId(dbItem), "051428b6-9da8-49db-aeda-944c2afce15d");

  // Extracted regex citation item
  const extractedItem = {
    id: "extracted-2020SCMR293-1",
    citationText: "2020 SCMR 293",
    linkedJudgmentId: "extracted-2020SCMR293-1",
    linkedCitation: "2020 SCMR 293",
  };
  assert.equal(getTargetJudgmentId(extractedItem), "2020 SCMR 293");

  // Item with only citationText
  const textOnlyItem = {
    id: "extracted-2019SCMR542-2",
    citationText: "2019 SCMR 542",
  };
  assert.equal(getTargetJudgmentId(textOnlyItem), "2019 SCMR 542");
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
