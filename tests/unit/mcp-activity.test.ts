import test from "node:test";
import assert from "node:assert/strict";
import {
  formatMcpActivityQuery,
  parseActivityQuery,
  getActivityHref,
  getActivitySubtitle,
} from "../../shared/mcp-activity";
import { buildMcpDisplayQuery, recordMcpActivity } from "../../server/mcp-activity";

test("shared MCP activity formatter and parser preserve clean display text and judgment UUID links", () => {
  const uuid = "191a4499-1ed9-43e2-91e7-bc813bb6e1f0";
  const encoded = formatMcpActivityQuery("judgment", "2021 SCMR 760 — Deputy Director Food vs Muhammad", uuid);
  assert.equal(encoded, `[MCP:judgment:${uuid}] 2021 SCMR 760 — Deputy Director Food vs Muhammad`);

  const parsed = parseActivityQuery(encoded);
  assert.equal(parsed.isMcp, true);
  assert.equal(parsed.mcpKind, "judgment");
  assert.equal(parsed.judgmentId, uuid);
  assert.equal(parsed.displayQuery, "2021 SCMR 760 — Deputy Director Food vs Muhammad");
  assert.equal(getActivitySubtitle(parsed, "judgment"), "MCP Case Law");
  assert.equal(getActivityHref(parsed, "judgment"), `/judgment/${uuid}`);

  const statuteParsed = parseActivityQuery(formatMcpActivityQuery("statute", "Section 302 PPC"));
  assert.equal(getActivitySubtitle(statuteParsed, "statute"), "MCP Statute");
  assert.equal(getActivityHref(statuteParsed, "statute"), "/preview/statutes?q=Section%20302%20PPC");

  const webParsed = parseActivityQuery("maintenance of child");
  assert.equal(webParsed.isMcp, false);
  assert.equal(webParsed.displayQuery, "maintenance of child");
  assert.equal(getActivitySubtitle(webParsed, "judgment"), "Judgment Search");
});

test("buildMcpDisplayQuery suppresses bare internal UUIDs and formats citation + title", () => {
  assert.equal(
    buildMcpDisplayQuery({ kind: "judgment", query: "191a4499-1ed9-43e2-91e7-bc813bb6e1f0" }),
    "",
  );
  assert.equal(
    buildMcpDisplayQuery({
      kind: "judgment",
      query: "191a4499-1ed9-43e2-91e7-bc813bb6e1f0",
      citation: "2021 SCMR 760",
      title: "Deputy Director Food vs Muhammad",
    }),
    "2021 SCMR 760 — Deputy Director Food vs Muhammad",
  );
});

test("recordMcpActivity deduplicates citation follow-ups and caps rapid bursts", async () => {
  const rows: Array<{ id: number; type: string; query: string; createdAt: Date | null }> = [];
  let seq = 1;
  const deps = {
    getRecent: async () => rows,
    insertEntry: async (entry: { userId: string; type: string; query: string }) => {
      rows.unshift({ id: seq++, type: entry.type, query: entry.query, createdAt: new Date() });
    },
  };

  // 1. Initial search_case_law logs cleanly
  const first = await recordMcpActivity(
    { userId: "u1", kind: "case-law", query: "2021 SCMR 760" },
    deps,
  );
  assert.equal(first.recorded, true);

  // 2. Immediate get_judgment for the same citation is deduplicated
  const dupCit = await recordMcpActivity(
    {
      userId: "u1",
      kind: "judgment",
      query: "2021 SCMR 760",
      judgmentId: "191a4499-1ed9-43e2-91e7-bc813bb6e1f0",
      citation: "2021 SCMR 760",
      title: "Deputy Director Food vs Muhammad",
    },
    deps,
  );
  assert.equal(dupCit.recorded, false);
  assert.equal(dupCit.reason, "citation-already-logged");

  // 3. Burst limit caps rapid-fire distinct searches at 3 within 2 minutes
  assert.equal((await recordMcpActivity({ userId: "u1", kind: "case-law", query: "bail after arrest 497" }, deps)).recorded, true);
  assert.equal((await recordMcpActivity({ userId: "u1", kind: "case-law", query: "khula dower recovery" }, deps)).recorded, true);
  const throttled = await recordMcpActivity({ userId: "u1", kind: "case-law", query: "fourth burst search" }, deps);
  assert.equal(throttled.recorded, false);
  assert.equal(throttled.reason, "burst-throttled");
  assert.equal(rows.length, 3);
});
