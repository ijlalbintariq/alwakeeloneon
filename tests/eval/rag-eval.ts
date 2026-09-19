/**
 * Retrieval evaluation harness.
 *
 * Runs every case in rag-eval-queries.json through the real pipeline against the
 * real database, and scores what came back. This is the scoreboard: without it,
 * every edit to the topic dictionary is a guess.
 *
 * It does NOT call the answering model. It measures retrieval only — the stage
 * that sets the ceiling on answer quality.
 *
 *   npx tsx tests/eval/rag-eval.ts                  # run all, print report
 *   npx tsx tests/eval/rag-eval.ts --area bail      # one area
 *   npx tsx tests/eval/rag-eval.ts --natural        # only natural phrasing
 *   npx tsx tests/eval/rag-eval.ts --save baseline  # write a snapshot
 *   npx tsx tests/eval/rag-eval.ts --compare baseline
 *
 * Exit code is 1 when the pass rate drops below EVAL_MIN_PASS_RATE (default 0).
 *
 * KNOW THE NOISE FLOOR BEFORE YOU TRUST A RESULT.
 * Two runs of identical code scored 48/50 and 49/50, with three cases flipping
 * between them (cpc-injunction, quashing-fir, fraud-420). Retrieval depends on
 * timeouts and connection-pool contention, so a swing of two or three cases
 * means nothing.
 *
 *   under ~3 cases (6%)  -> noise, ignore it
 *   over  ~5 cases (10%) -> real, and worth acting on
 *
 * It also has teeth the other way. A 44/50 run was first blamed on a change to
 * the LLM expansion trigger — until the logs showed that trigger fired zero
 * times in that run. The real cause was connection-pool contention. ALWAYS
 * check that the code path you are crediting or blaming actually ran.
 *
 * Useful counts to grep from a run:
 *   "dictionary-miss"     low-score LLM expansion actually fired
 *   "RAG search exceeded" a vector search was abandoned, connection destroyed
 *   "semantic fallback added"  the judgment vector index rescued a thin result
 */

import "../../server/load-env";
import fs from "fs";
import path from "path";

interface EvalCase {
  id: string;
  area: string;
  phrasing: "formal" | "natural";
  query: string;
  expectStatute?: string[];
  expectTopics?: string[];
  minCaseLaw?: number;
}

interface CaseResult {
  id: string;
  area: string;
  phrasing: string;
  pass: boolean;
  statuteOk: boolean;
  caseLawOk: boolean;
  topicsOk: boolean;
  caseLawCount: number;
  statuteCount: number;
  topTopics: string[];
  topStatutes: string[];
  ms: number;
  error?: string;
}

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const has = (name: string) => args.includes(`--${name}`);

const SNAP_DIR = path.resolve(process.cwd(), "tests/eval/snapshots");

function loadCases(): EvalCase[] {
  const file = path.resolve(process.cwd(), "tests/eval/rag-eval-queries.json");
  const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  let cases: EvalCase[] = parsed.cases;

  const area = flag("area");
  if (area) cases = cases.filter((c) => c.area === area);
  if (has("natural")) cases = cases.filter((c) => c.phrasing === "natural");
  if (has("formal")) cases = cases.filter((c) => c.phrasing === "formal");
  return cases;
}

function matchesAny(haystack: string, needles: string[]): boolean {
  const h = haystack.toLowerCase();
  return needles.some((n) => h.includes(String(n).toLowerCase()));
}

async function main(): Promise<void> {
  const { classifyQueryIntent } = await import("../../server/pipeline/intent-classifier");
  const { gatherKnowledgeWithHits } = await import("../../server/pipeline/knowledge-pipeline");

  const cases = loadCases();
  console.log(`Running ${cases.length} retrieval eval cases against the live database.\n`);

  const results: CaseResult[] = [];

  for (const c of cases) {
    const t0 = Date.now();
    try {
      // Go through the WHOLE pipeline, not just runRetrieval — that is the only
      // way stage 1.5 (LLM query expansion) is exercised, and it is the stage
      // that rescues queries the topic dictionary does not recognise.
      const r: any = await gatherKnowledgeWithHits(c.query, "rag-eval", undefined, {
        module: "al-wakeelo",
      });

      // Score against what actually reached the model, not an intermediate list.
      const context = String(r.contextString || "");
      const statuteOk = !c.expectStatute?.length || matchesAny(context, c.expectStatute);
      const caseLawOk = (r.caseLawHits?.length || 0) >= (c.minCaseLaw ?? 1);

      // Topics are re-derived for reporting; the pipeline does not return them.
      const intent = classifyQueryIntent(c.query, { module: "al-wakeelo" } as any);
      const topicIds = intent.topics.map((t: any) => t.id);
      const topicsOk =
        !c.expectTopics?.length || c.expectTopics.every((t) => topicIds.includes(t));

      const statuteLines = Array.from(
        new Set((context.match(/^##\s*[^\n]{3,60}$/gm) || []).map((s) => s.replace(/^##\s*/, "").trim())),
      ).slice(0, 2);

      results.push({
        id: c.id,
        area: c.area,
        phrasing: c.phrasing,
        pass: statuteOk && caseLawOk && topicsOk,
        statuteOk,
        caseLawOk,
        topicsOk,
        caseLawCount: r.caseLawHits?.length || 0,
        statuteCount: context.length,
        topTopics: topicIds.slice(0, 3),
        topStatutes: statuteLines,
        ms: Date.now() - t0,
      });
    } catch (err: any) {
      results.push({
        id: c.id, area: c.area, phrasing: c.phrasing,
        pass: false, statuteOk: false, caseLawOk: false, topicsOk: false,
        caseLawCount: 0, statuteCount: 0, topTopics: [], topStatutes: [],
        ms: Date.now() - t0, error: String(err?.message || err).slice(0, 120),
      });
    }

    const last = results[results.length - 1];
    process.stdout.write(
      `${last.pass ? "PASS" : "FAIL"}  ${last.id.padEnd(30)} ` +
      `law=${String(last.caseLawCount).padStart(2)} ctx=${String(last.statuteCount).padStart(6)} ` +
      `${String(last.ms).padStart(6)}ms` +
      `${last.error ? "  ERROR " + last.error : ""}\n`,
    );
  }

  // ── Report ────────────────────────────────────────────────────────────────
  const passed = results.filter((r) => r.pass).length;
  const rate = results.length ? passed / results.length : 0;

  console.log(`\n${"=".repeat(64)}`);
  console.log(`OVERALL  ${passed}/${results.length}  (${(rate * 100).toFixed(1)}%)`);

  const byPhrasing = (p: string) => {
    const set = results.filter((r) => r.phrasing === p);
    if (!set.length) return null;
    return `${set.filter((r) => r.pass).length}/${set.length}`;
  };
  console.log(`  formal   ${byPhrasing("formal") ?? "-"}`);
  console.log(`  natural  ${byPhrasing("natural") ?? "-"}   <- dictionary gaps show up here`);

  const areas = Array.from(new Set(results.map((r) => r.area))).sort();
  console.log(`\nBy area:`);
  for (const a of areas) {
    const set = results.filter((r) => r.area === a);
    const p = set.filter((r) => r.pass).length;
    console.log(`  ${a.padEnd(16)} ${p}/${set.length}`);
  }

  const failures = results.filter((r) => !r.pass);
  if (failures.length) {
    console.log(`\nFailures — what was missing:`);
    for (const f of failures) {
      const why = [
        !f.topicsOk ? "topics" : null,
        !f.statuteOk ? "statute" : null,
        !f.caseLawOk ? "case-law" : null,
      ].filter(Boolean).join(", ");
      console.log(`  ${f.id.padEnd(30)} missing: ${why.padEnd(22)} got topics=[${f.topTopics.join(",")}] statutes=[${f.topStatutes.join(" | ")}]`);
    }
  }

  const median = [...results].sort((a, b) => a.ms - b.ms)[Math.floor(results.length / 2)]?.ms ?? 0;
  console.log(`\nMedian retrieval time: ${median}ms`);

  // ── Snapshots ─────────────────────────────────────────────────────────────
  const saveName = flag("save");
  if (saveName) {
    fs.mkdirSync(SNAP_DIR, { recursive: true });
    const file = path.join(SNAP_DIR, `${saveName}.json`);
    fs.writeFileSync(file, JSON.stringify({ ts: new Date().toISOString(), rate, results }, null, 2));
    console.log(`\nSnapshot saved: ${file}`);
  }

  const compareName = flag("compare");
  if (compareName) {
    const file = path.join(SNAP_DIR, `${compareName}.json`);
    if (!fs.existsSync(file)) {
      console.log(`\nNo snapshot named "${compareName}" to compare against.`);
    } else {
      const prev = JSON.parse(fs.readFileSync(file, "utf8"));
      const prevById = new Map<string, CaseResult>(prev.results.map((r: CaseResult) => [r.id, r]));
      const fixed: string[] = [];
      const broken: string[] = [];
      for (const r of results) {
        const p = prevById.get(r.id);
        if (!p) continue;
        if (!p.pass && r.pass) fixed.push(r.id);
        if (p.pass && !r.pass) broken.push(r.id);
      }
      console.log(`\nVs snapshot "${compareName}" (${(prev.rate * 100).toFixed(1)}% -> ${(rate * 100).toFixed(1)}%)`);
      console.log(`  newly passing: ${fixed.length ? fixed.join(", ") : "none"}`);
      console.log(`  newly failing: ${broken.length ? broken.join(", ") : "none"}`);
      if (broken.length) process.exitCode = 1;
    }
  }

  const minRate = Number(process.env.EVAL_MIN_PASS_RATE || 0);
  if (rate < minRate) {
    console.log(`\nPass rate ${(rate * 100).toFixed(1)}% is below EVAL_MIN_PASS_RATE ${(minRate * 100).toFixed(1)}%`);
    process.exitCode = 1;
  }
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((err) => { console.error(err); process.exit(1); });
