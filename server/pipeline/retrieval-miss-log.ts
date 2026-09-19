/**
 * Retrieval Miss Log
 *
 * The topic dictionary in intent-classifier.ts is hand written. When a query
 * uses wording the dictionary does not contain, the topic score is zero, the
 * synonym expansion adds nothing, and retrieval quietly comes back thin. The
 * user sees a weaker answer; nobody sees why.
 *
 * This records those cases so the dictionary can be grown from real queries
 * instead of guesses. It is append-only JSONL, best effort, and never throws
 * into the request path.
 *
 * Read it with:  npx tsx scripts/retrieval-misses.ts
 */

import fs from "fs";
import path from "path";
import type { QueryIntent } from "./intent-classifier";

const ENABLED = process.env.RETRIEVAL_MISS_LOG !== "false";
const LOG_DIR = process.env.RETRIEVAL_MISS_LOG_DIR || path.resolve(process.cwd(), "logs");
const LOG_FILE = path.join(LOG_DIR, "retrieval-misses.jsonl");
const MAX_BYTES = Number(process.env.RETRIEVAL_MISS_LOG_MAX_BYTES || 20 * 1024 * 1024);

export type MissReason =
  | "no-topics"          // dictionary matched nothing
  | "low-topic-score"    // matched, but weakly
  | "no-case-law"        // topics found, judgments did not
  | "no-statutes"
  | "empty-context";     // nothing at all reached the model

export interface RetrievalMiss {
  ts: string;
  reasons: MissReason[];
  query: string;
  module: string;
  intentType: string;
  tier: string | null;
  topics: string[];
  topTopicScore: number;
  statuteRef: string | null;
  caseLawFetched: number;
  statutesFetched: number;
  adminDocsFetched: number;
  contextChars: number;
  durationMs: number;
}

const LOW_TOPIC_SCORE = Number(process.env.RETRIEVAL_MISS_LOW_SCORE || 12);

/** Decide whether this run is worth recording. Empty array means it was fine. */
export function classifyMiss(args: {
  intent: QueryIntent;
  caseLawFetched: number;
  statutesFetched: number;
  adminDocsFetched: number;
  contextChars: number;
}): MissReason[] {
  const reasons: MissReason[] = [];
  const topicCount = args.intent.topics?.length || 0;
  const topScore = args.intent.topTopicScore || 0;

  if (topicCount === 0) reasons.push("no-topics");
  else if (topScore < LOW_TOPIC_SCORE) reasons.push("low-topic-score");

  if (args.intent.needsCaseLaw && args.caseLawFetched === 0) reasons.push("no-case-law");
  if (args.intent.needsStatutes && args.statutesFetched === 0) reasons.push("no-statutes");
  if (args.contextChars === 0) reasons.push("empty-context");

  return reasons;
}

export function recordRetrievalMiss(args: {
  intent: QueryIntent;
  module?: string;
  caseLawFetched: number;
  statutesFetched: number;
  adminDocsFetched: number;
  contextChars: number;
  durationMs: number;
}): void {
  if (!ENABLED) return;

  try {
    const reasons = classifyMiss(args);
    if (reasons.length === 0) return;

    const entry: RetrievalMiss = {
      ts: new Date().toISOString(),
      reasons,
      // Queries can carry client facts. Cap length; this file stays on your server.
      query: String(args.intent.raw || "").slice(0, 400),
      module: String(args.module || "chat"),
      intentType: args.intent.type,
      tier: args.intent.tier ?? null,
      topics: (args.intent.topics || []).map((t) => t.id),
      topTopicScore: args.intent.topTopicScore || 0,
      statuteRef: args.intent.statuteRef
        ? `${args.intent.statuteRef.abbr} ${args.intent.statuteRef.sectionOrArticle}`
        : null,
      caseLawFetched: args.caseLawFetched,
      statutesFetched: args.statutesFetched,
      adminDocsFetched: args.adminDocsFetched,
      contextChars: args.contextChars,
      durationMs: args.durationMs,
    };

    // Fire and forget. This runs inside the request path, so it must not block
    // the event loop on disk I/O — appendFileSync on every miss would stall
    // every other request on the process while it wrote.
    queueWrite(JSON.stringify(entry) + "\n");
  } catch (err: any) {
    // Never break a user request because logging failed.
    console.warn(`[RetrievalMiss] could not record: ${err?.message || err}`);
  }
}

// Serialise the async appends so concurrent misses cannot interleave and
// produce a half-written line that breaks JSONL parsing.
let writeChain: Promise<void> = Promise.resolve();
let dirReady = false;

function queueWrite(line: string): void {
  writeChain = writeChain
    .then(async () => {
      if (!dirReady) {
        await fs.promises.mkdir(LOG_DIR, { recursive: true });
        dirReady = true;
      }

      // Stop the file growing without bound on a long-running server.
      try {
        const stat = await fs.promises.stat(LOG_FILE);
        if (stat.size > MAX_BYTES) {
          await fs.promises.rename(LOG_FILE, `${LOG_FILE}.1`);
        }
      } catch {
        // File does not exist yet — nothing to rotate.
      }

      await fs.promises.appendFile(LOG_FILE, line);
    })
    .catch((err: any) => {
      console.warn(`[RetrievalMiss] write failed: ${err?.message || err}`);
    });
}

export function getMissLogPath(): string {
  return LOG_FILE;
}

// ── Reading side ─────────────────────────────────────────────────────────────
// Shared by scripts/retrieval-misses.ts and the admin panel endpoint, so the
// terminal and the UI always report the same numbers.

/** Words that carry no legal signal — never worth adding to the dictionary. */
const NOISE_WORDS = new Set([
  "the","a","an","and","or","of","to","in","on","for","is","are","was","were","be","been",
  "my","our","his","her","their","this","that","it","he","she","they","we","you","i",
  "what","which","who","whom","how","when","where","why","can","could","should","would",
  "will","shall","do","does","did","have","has","had","not","with","from","by","at","as",
  "client","case","please","tell","me","about","any","some","there","if","then","so","also",
  "under","section","law","legal","court","pakistan","sir","kindly","want","need","know",
]);

export interface MissLogAnalysis {
  available: boolean;
  path: string;
  total: number;
  firstSeen: string | null;
  lastSeen: string | null;
  byReason: Array<{ reason: string; count: number }>;
  /** Queries the dictionary did not recognise at all. */
  unrecognised: number;
  /** Words showing up repeatedly in unrecognised queries — dictionary candidates. */
  candidateTerms: Array<{ term: string; count: number }>;
  /** Most frequently repeated unrecognised queries. */
  topQueries: Array<{ query: string; count: number }>;
  recent: RetrievalMiss[];
}

export function analyzeMissLog(opts: { recentLimit?: number } = {}): MissLogAnalysis {
  const empty: MissLogAnalysis = {
    available: false, path: LOG_FILE, total: 0, firstSeen: null, lastSeen: null,
    byReason: [], unrecognised: 0, candidateTerms: [], topQueries: [], recent: [],
  };

  let raw: string;
  try {
    raw = fs.readFileSync(LOG_FILE, "utf8");
  } catch {
    return empty;
  }

  const rows = raw
    .split("\n")
    .filter(Boolean)
    .map((line) => { try { return JSON.parse(line) as RetrievalMiss; } catch { return null; } })
    .filter(Boolean) as RetrievalMiss[];

  if (rows.length === 0) return { ...empty, available: true };

  const reasonCounts: Record<string, number> = {};
  for (const r of rows) for (const reason of r.reasons || []) {
    reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
  }

  const unrecognised = rows.filter((r) => (r.reasons || []).includes("no-topics"));

  const termFreq: Record<string, number> = {};
  for (const r of unrecognised) {
    const seen = new Set<string>();
    for (const w of String(r.query || "").toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/)) {
      if (w.length < 4 || NOISE_WORDS.has(w) || seen.has(w)) continue;
      seen.add(w);
      termFreq[w] = (termFreq[w] || 0) + 1;
    }
  }

  const queryFreq: Record<string, number> = {};
  for (const r of unrecognised) {
    const k = String(r.query || "").toLowerCase().slice(0, 120);
    queryFreq[k] = (queryFreq[k] || 0) + 1;
  }

  return {
    available: true,
    path: LOG_FILE,
    total: rows.length,
    firstSeen: rows[0]?.ts ?? null,
    lastSeen: rows[rows.length - 1]?.ts ?? null,
    byReason: Object.entries(reasonCounts)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count),
    unrecognised: unrecognised.length,
    candidateTerms: Object.entries(termFreq)
      .filter(([, n]) => n >= 2)
      .map(([term, count]) => ({ term, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 40),
    topQueries: Object.entries(queryFreq)
      .map(([query, count]) => ({ query, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15),
    recent: rows.slice(-(opts.recentLimit ?? 25)).reverse(),
  };
}
