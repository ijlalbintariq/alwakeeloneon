import test from "node:test";
import assert from "node:assert/strict";
import { TOOL_SEARCH_QUALITY_THRESHOLD } from "../../server/routes";

/**
 * The drafting endpoint gated the tool search on `hits.length === 0` alone while
 * the chat engine also checked relevance. A single score-3 pipeline hit therefore
 * suppressed the tool search, became the whole pool, and — with the prompt
 * demanding three citations from that pool — pushed the draft onto a barely
 * related authority.
 */
function toolSearchEnabled(hits: number, maxScore: number): boolean {
  return hits === 0 || maxScore < TOOL_SEARCH_QUALITY_THRESHOLD;
}

test("a weak pipeline hit no longer suppresses the tool search", () => {
  assert.equal(toolSearchEnabled(1, 3), true);
  assert.equal(toolSearchEnabled(5, 39), true);
});

test("strong pipeline hits still skip the tool search", () => {
  assert.equal(toolSearchEnabled(1, 40), false);
  assert.equal(toolSearchEnabled(8, 95), false);
});

test("no hits always runs the tool search", () => {
  assert.equal(toolSearchEnabled(0, 100), true);
});

/**
 * Mirrors normKey in server/pipeline/knowledge-pipeline.ts. Truncating at 280
 * characters was fine for chat, where the question is the whole query. A drafting
 * query spends its opening on the instruction, the filing label, the jurisdiction
 * and the court heading, so two unrelated matters of the same type collided and
 * the second was served the first one's case law.
 */
import { createHash } from "crypto";
function normKey(q: string): string {
  const normalized = q.toLowerCase().replace(/\s+/g, " ").trim();
  const digest = createHash("sha1").update(normalized).digest("hex").slice(0, 16);
  return `${normalized.slice(0, 200)}#${digest}`;
}

const BOILERPLATE =
  "add case law according to the facts of this plaint\nCivil Suit (Plaint)\nPakistan\n" +
  "IN THE COURT OF THE LEARNED CIVIL JUDGE, LAHORE\n\nCivil Suit No. ________ of 2026\n\n";

test("two matters sharing 280 characters of boilerplate get different keys", () => {
  const a = normKey(BOILERPLATE + "SUIT FOR SPECIFIC PERFORMANCE OF AGREEMENT TO SELL. Section 12");
  const b = normKey(BOILERPLATE + "SUIT FOR RECOVERY OF DOWER AND DOWRY ARTICLES. Section 5 Family Courts Act");
  assert.notEqual(a, b, "unrelated matters still collide in the pipeline cache");
});

test("the same query still hits the same cache entry", () => {
  const q = BOILERPLATE + "SUIT FOR SPECIFIC PERFORMANCE OF AGREEMENT TO SELL. Section 12";
  assert.equal(normKey(q), normKey(`  ${q.toUpperCase()}  `.replace(/\s+/g, " ")));
});
