/**
 * Reads logs/retrieval-misses.jsonl and tells you which words your topic
 * dictionary is missing.
 *
 *   npx tsx scripts/retrieval-misses.ts              # summary
 *   npx tsx scripts/retrieval-misses.ts --words      # candidate terms to add
 *   npx tsx scripts/retrieval-misses.ts --recent 20  # last 20 misses in full
 */

import fs from "fs";
import path from "path";

const LOG_FILE = path.resolve(
  process.env.RETRIEVAL_MISS_LOG_DIR || path.resolve(process.cwd(), "logs"),
  "retrieval-misses.jsonl",
);

const args = process.argv.slice(2);
const has = (n: string) => args.includes(`--${n}`);
const flagNum = (n: string, d: number) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? Number(args[i + 1]) || d : d;
};

// Words that carry no legal signal — never worth adding to the dictionary.
const NOISE = new Set([
  "the","a","an","and","or","of","to","in","on","for","is","are","was","were","be","been",
  "my","our","his","her","their","this","that","it","he","she","they","we","you","i",
  "what","which","who","whom","how","when","where","why","can","could","should","would",
  "will","shall","do","does","did","have","has","had","not","with","from","by","at","as",
  "client","case","please","tell","me","about","any","some","there","if","then","so","also",
  "under","section","law","legal","court","pakistan","sir","kindly","want","need","know",
]);

function main(): void {
  if (!fs.existsSync(LOG_FILE)) {
    console.log(`No miss log yet at ${LOG_FILE}`);
    console.log(`It fills up as real queries come through. Nothing to do.`);
    return;
  }

  const rows = fs.readFileSync(LOG_FILE, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean) as any[];

  if (rows.length === 0) {
    console.log("Miss log is empty — retrieval has not come up short yet.");
    return;
  }

  if (has("recent")) {
    const n = flagNum("recent", 20);
    for (const r of rows.slice(-n)) {
      console.log(`${r.ts}  [${r.reasons.join(",")}]  score=${r.topTopicScore} topics=[${r.topics.join(",")}]`);
      console.log(`    "${r.query}"`);
      console.log(`    law=${r.caseLawFetched} statutes=${r.statutesFetched} ctx=${r.contextChars} ${r.durationMs}ms\n`);
    }
    return;
  }

  const reasonCounts: Record<string, number> = {};
  for (const r of rows) for (const reason of r.reasons) reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;

  console.log(`${rows.length} recorded misses  (${rows[0].ts.slice(0,10)} → ${rows[rows.length-1].ts.slice(0,10)})\n`);
  console.log("By reason:");
  for (const [reason, n] of Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${reason.padEnd(18)} ${n}`);
  }

  const noTopics = rows.filter((r) => r.reasons.includes("no-topics"));
  console.log(`\nQueries the dictionary did not recognise at all: ${noTopics.length}`);

  if (has("words")) {
    // Words that keep showing up in unrecognised queries are the gap.
    const freq: Record<string, number> = {};
    for (const r of noTopics) {
      const seen = new Set<string>();
      for (const w of String(r.query).toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/)) {
        if (w.length < 4 || NOISE.has(w) || seen.has(w)) continue;
        seen.add(w);
        freq[w] = (freq[w] || 0) + 1;
      }
    }
    const ranked = Object.entries(freq).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 40);
    console.log(`\nCandidate terms to add to LEGAL_TOPICS (seen in 2+ unrecognised queries):\n`);
    if (ranked.length === 0) {
      console.log("  (not enough data yet — let the log build up)");
    } else {
      for (const [w, n] of ranked) console.log(`  ${String(n).padStart(4)}x  ${w}`);
    }
    return;
  }

  console.log(`\nMost common unrecognised queries:`);
  const byQuery: Record<string, number> = {};
  for (const r of noTopics) {
    const k = String(r.query).toLowerCase().slice(0, 90);
    byQuery[k] = (byQuery[k] || 0) + 1;
  }
  for (const [q, n] of Object.entries(byQuery).sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    console.log(`  ${String(n).padStart(3)}x  "${q}"`);
  }

  console.log(`\nRun with --words for candidate dictionary terms, --recent N for full entries.`);
}

main();
