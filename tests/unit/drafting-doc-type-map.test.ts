import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * The drafting studio sends TEMPLATE_TO_DOC_TYPE values to
 * POST /api/retrieval/clauses/generate. The server checks each value against
 * LEGAL_DRAFTING_DOC_TYPES and silently ignores anything it does not recognise,
 * which drops the filing-type lock, the forum lock and structural validation.
 * Read both sides as text so this check needs no DOM and no server boot.
 */
test("every template doc type exists in the server doc type union", () => {
  const routes = readFileSync("server/routes.ts", "utf8");
  const unionStart = routes.indexOf("type LegalDraftingDocType =");
  assert.ok(unionStart > 0, "LegalDraftingDocType union not found in server/routes.ts");
  const union = routes.slice(unionStart, routes.indexOf(";", unionStart));
  const serverTypes = new Set([...union.matchAll(/"([a-z0-9-]+)"/g)].map((m) => m[1]));
  assert.ok(serverTypes.size > 20, `expected the full doc type union, parsed ${serverTypes.size}`);

  const page = readFileSync("client/src/experimental/pages/PreviewDrafting.tsx", "utf8");
  const mapStart = page.indexOf("const TEMPLATE_TO_DOC_TYPE");
  assert.ok(mapStart > 0, "TEMPLATE_TO_DOC_TYPE not found in PreviewDrafting.tsx");
  const map = page.slice(mapStart, page.indexOf("};", mapStart));
  const entries = [...map.matchAll(/(\w+):\s*"([a-z0-9-]+)"/g)].map((m) => [m[1], m[2]]);
  assert.ok(entries.length > 0, "TEMPLATE_TO_DOC_TYPE parsed as empty");

  const unknown = entries.filter(([, docType]) => !serverTypes.has(docType));
  assert.deepEqual(
    unknown,
    [],
    `template ids mapped to doc types the server does not accept: ${unknown
      .map(([id, docType]) => `${id} -> "${docType}"`)
      .join(", ")}`,
  );
});
