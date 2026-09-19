/**
 * Knowledge Pipeline
 *
 * Responsibility: Orchestrate the full retrieval flow.
 *                 This is the ONLY entry point called from routes.ts.
 *                 It replaces gatherKnowledgeContext completely.
 *
 * Pipeline stages:
 *   1.   Normalize + classify intent        (intent-classifier)
 *   1.5  Build focused retrieval queries     (this file — for long narratives)
 *   2.   Retrieve relevant sources           (retrieval-engine)
 *   3.   Build structured context string     (context-builder)
 *
 * Input  : raw query + optional userId
 * Output : formatted context string ready to append to system prompt
 *
 * Observability:
 *   Every stage logs its output. Trace a failure by reading:
 *     [Pipeline:1:Classify] ...
 *     [Pipeline:2:Retrieve] ...
 *     [Pipeline:3:Build]    ...
 */

import { createHash } from "crypto";
import { classifyQueryIntent, analyzeQueryExplicitness, normalizePipelineModule } from "./intent-classifier";
import { runRetrieval } from "./retrieval-engine";
import { buildContext } from "./context-builder";
import { rewriteFollowUpQuery, type ConversationTurn } from "./query-rewriter";
import { generateSemanticRetrievalQueries, extractDeterministicFacts } from "./llm-query-extractor";
import { recordRetrievalMiss } from "./retrieval-miss-log";
import type { QueryIntent } from "./intent-classifier";

// ---------------------------------------------------------------------------
// Cache (mirrors old knowledgeContextCache behaviour)
// ---------------------------------------------------------------------------

interface CachedPipelineResult {
  contextString: string;
  caseLawHits: CaseLawHit[];
  maxRelevanceScore: number;
}
type TimedEntry<T> = { value: T; expiresAt: number };
const contextCache = new Map<string, TimedEntry<CachedPipelineResult>>();
const CACHE_TTL_MS = Number(process.env.KNOWLEDGE_CONTEXT_CACHE_TTL_MS || 120_000);
const MAX_CACHE_ENTRIES = 400;

function cacheGet(key: string): CachedPipelineResult | undefined {
  const entry = contextCache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) { contextCache.delete(key); return undefined; }
  return entry.value;
}

function cacheSet(key: string, value: CachedPipelineResult): void {
  contextCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  if (contextCache.size <= MAX_CACHE_ENTRIES) return;
  const now = Date.now();
  for (const [k, v] of contextCache.entries()) {
    if (v.expiresAt <= now) contextCache.delete(k);
    if (contextCache.size <= MAX_CACHE_ENTRIES) return;
  }
  // Evict oldest
  const oldest = contextCache.keys().next().value;
  if (oldest) contextCache.delete(oldest as string);
}

// ---------------------------------------------------------------------------
// Focused Retrieval Query Builder (Stage 1.5)
// ---------------------------------------------------------------------------

function dedupeWords(query: string): string {
  const seen = new Set<string>();
  return query.split(/\s+/).filter(w => {
    const lower = w.toLowerCase();
    if (seen.has(lower)) return false;
    seen.add(lower);
    return true;
  }).join(" ");
}

function isFamilyContext(text: string): boolean {
  return /\b(?:husband|wife|biwi|shohar|marriage|married|nikah|mehr|dowry|jahez|matrimonial|talaq|khula|divorce|iddat|hizanat)\b/i.test(text);
}

function detectRemedy(text: string): string {
  if (/\b(?:custody|hizanat|guardian|visitation)\b/i.test(text) &&
      /\b(?:child|son|daughter|minor|bachch|bachon|beta|beti|mother|father|parent)\b/i.test(text))
    return "custody";

  if (/\b(?:habeas corpus|section 491 crpc|illegal detention)\b/i.test(text)) return "bail";
  if (/\b(?:bail|pre-arrest|post-arrest)\b/i.test(text)) return "bail";
  if (/\b(?:injunction|restrain|stop|prohibit|stay|stay order|anton piller)\b/i.test(text)) return "injunction";
  if (/\b(?:declaration|declare)\b/i.test(text)) return "declaration";

  const isTaxOrSecpReturn = /\b(?:tax return|annual return|form 29|voluntary return|return of income)\b/i.test(text);
  const isPoliceSeizure = /\b(?:police|fia|nab|anf|atd)\s+(?:has\s+)?(?:seized|recovered|found)\b/i.test(text);
  const hasTookProperty = /\b(?:took|taken)\s+(?:possession|gold|cash|money|property|dowry|jahez|articles|car|vehicle|belongings|flat|plot)\b/i.test(text);
  
  if (!isTaxOrSecpReturn && !isPoliceSeizure &&
      (/(?:recover|return|restor|get back|give back|stole|stolen)/i.test(text) || hasTookProperty)) {
    return "recovery";
  }

  if (/\b(?:possession|dispossess)\b/i.test(text) &&
      !/\b(?:narcotic|hashish|heroin|charas|drug|opium|gram|kilo)\b/i.test(text))
    return "possession";

  if (/\b(?:maintenance|nafaqa|nafqa)\b/i.test(text)) return "maintenance";
  if (/\b(?:dissolution|khula|divorce|talaq)\b/i.test(text)) return "dissolution";
  if (/\b(?:partition|share|inheritance|succession)\b/i.test(text)) return "partition";
  if (/\b(?:compensation|damages|refund)\b/i.test(text)) return "compensation";
  return "";
}

function extractPropertyTerms(text: string): string | null {
  const hasRecoveryIntent = /(?:recover|return|restor|get back|give back|took|taken|seiz|snatch|stole|stolen)/i.test(text);
  if (!hasRecoveryIntent) return null;
  if (!isFamilyContext(text)) return null;

  const terms: string[] = [];
  if (/\b(?:gold|jewel|ornament|tola)\b/i.test(text)) terms.push("gold ornaments jewelry");
  if (/\b(?:cash|money)\b/i.test(text) && /\b(?:took|taken|seiz|recover|return)\b/i.test(text)) terms.push("cash money");
  if (/\b(?:dowry|jahez|bridal)\b/i.test(text)) terms.push("dowry articles jahez");
  if (/\b(?:belonging|personal|valuable)\b/i.test(text)) terms.push("personal belongings");
  if (/\b(?:plot|land|flat|apartment)\b/i.test(text)) terms.push("property plot land");
  if (/\b(?:vehicle|car|motor)\b/i.test(text)) terms.push("vehicle");
  if (terms.length === 0) return null;
  const remedy = detectRemedy(text);
  return `${remedy} wife ${terms.join(" ")} matrimonial`.trim();
}

function detectCriminalAngle(text: string): string | null {
  const family = isFamilyContext(text);
  const isFormalAppeal = /\b(?:appeal|division bench|appellate)\b/i.test(text) && /\b(?:convict|sentence|imprisonment)\b/i.test(text);
  const isCivilDefamation = /\b(?:defamation ordinance|civil suit|district court)\b/i.test(text) && /\b(?:damages|compensation)\b/i.test(text);

  if (/\b(?:breach.*trust|misappropriat|dishonest|entrustment)\b/i.test(text) ||
      /\b(?:406|405)\b/.test(text))
    return family
      ? "criminal breach trust wife property husband section 406 PPC"
      : "criminal breach trust misappropriation section 406 PPC";

  if (/(?:domestic.*violence|beaten|beating|tortur|cruelty|hurt|assault|abusi|violen)/i.test(text))
    return "domestic violence cruelty husband wife";

  if (/(?:threaten|threat|extortion|blackmail|ransom)/i.test(text))
    return "criminal intimidation extortion threat";

  if (!isCivilDefamation && /(?:peca|cyber|piracy|stole.*code|hacked|defamat)/i.test(text))
    return "cyber crime electronic offense PECA FIA";

  if (!isFormalAppeal && /(?:explosive|arms act|unlicensed weapon|atd|terrorism|ata 1997)/i.test(text))
    return "anti terrorism explosive arms act prosecution";

  if (!isFormalAppeal && !isCivilDefamation && /\b(?:fir|police|thana|fia)\b/i.test(text))
    return family
      ? "criminal complaint wife property FIR"
      : "FIR criminal complaint quash";

  if (/(?:forcibl|expell|thrown out|threw.*out|kick|drove.*out)/i.test(text) &&
      /\b(?:gold|cash|dowry|jewel|property|belonging|valuable)\b/i.test(text))
    return "criminal breach trust wife property husband section 406 PPC";

  return null;
}

function condenseLegalQuery(query: string): string {
  if (query.length <= 150) return query;
  const patterns = [
    /\b(?:dowry|jahez|mehr|dower|nikah|khula|talaq|iddat|hizanat|custody|maintenance|dissolution|marriage|matrimonial|restitution)\b/gi,
    /\b(?:recovery|return|possession|injunction|declaration|restoration|dispossession|eviction|partition)\b/gi,
    /\b(?:gold|jewelry|jewellery|ornaments|cash|belongings|articles|property|valuables|tola)\b/gi,
    /\b(?:family court|civil court|sessions court|high court|district court)\b/gi,
    /\b(?:breach of trust|misappropriation|criminal|section \d+|article \d+)\b/gi,
    /\b(?:family courts act|muslim family laws|penal code|ppc|crpc|cpc|cnsa|ata)\b/gi,
    /\b(?:suit|petition|application|appeal|decree|relief|remedy|claim|complaint|damages)\b/gi,
    /(?:nuisance|trespass|harass|defam|negligen|fraud|cheat|forg)/gi,
    /(?:tenant|landlord|rent|lease|evict|vacate)/gi,
    /(?:employ|salary|terminat|gratuity|provident|labour)/gi,
    /(?:murder|kidnap|robbery|theft|assault|bail|arrest)/gi,
    /(?:damag|boundar|neighbou?r|noise|parking|disput)/gi,
  ];
  const extracted = new Set<string>();
  for (const p of patterns) {
    const matches = query.match(p);
    if (matches) matches.forEach(m => extracted.add(m.toLowerCase().trim()));
  }
  return extracted.size > 0 ? [...extracted].slice(0, 12).join(" ") : query;
}

function buildFocusedRetrievalQueries(rawQuery: string, intent: QueryIntent): string[] {
  if (rawQuery.length <= 150) return [];
  const queries: string[] = [];
  const lower = rawQuery.toLowerCase();
  const remedy = detectRemedy(lower);

  if (intent.topics.length > 0) {
    const topicTerms = intent.topics[0].primary.slice(0, 4).join(" ");
    const q1 = remedy ? `${remedy} ${topicTerms}` : topicTerms;
    const deduped = dedupeWords(q1.trim());
    if (deduped.length > 5) queries.push(deduped);
  }

  const propertyQuery = extractPropertyTerms(lower);
  if (propertyQuery && !queries.some(q => q === propertyQuery)) {
    queries.push(propertyQuery);
  }

  const criminalQuery = detectCriminalAngle(lower);
  if (criminalQuery && !queries.some(q => q === criminalQuery)) {
    queries.push(criminalQuery);
  }

  if (queries.length === 0) {
    const condensed = condenseLegalQuery(rawQuery);
    const fallbackText = condensed !== rawQuery ? condensed : rawQuery.slice(0, 100);
    const deduped = dedupeWords(fallbackText);
    if (deduped.length > 5) {
      queries.push(deduped);
    }
  }

  return queries.slice(0, 3);
}

// ---------------------------------------------------------------------------
// Pipeline Main
// ---------------------------------------------------------------------------

const OUTER_DEADLINE_MS = Number(process.env.KNOWLEDGE_OUTER_DEADLINE_MS || 30000);

/**
 * Truncating at 280 characters was enough for chat, where the question is the
 * whole query. A drafting query spends its first ~190 characters on the
 * instruction, the filing label, the jurisdiction and the court heading, so two
 * unrelated matters of the same type produced the same key and the second one was
 * served the first one's case law. The digest keeps keys readable and short while
 * a hash of the whole query keeps them distinct.
 */
function normKey(q: string): string {
  const normalized = q.toLowerCase().replace(/\s+/g, " ").trim();
  const digest = createHash("sha1").update(normalized).digest("hex").slice(0, 16);
  return `${normalized.slice(0, 200)}#${digest}`;
}

export interface CaseLawHit {
  id?: string | number;
  citation: string;
  title: string;
  court: string;
  summary: string;
}

export interface PipelineRunResult {
  contextString: string;
  hasCaseLaw: boolean;
  hasStatutes: boolean;
  topics: string[];
  durationMs: number;
  caseLawHits: CaseLawHit[];
  /** Highest relevance score among retrieved case law (0-100). Used by routes.ts
   *  to decide whether to run multi-angle tool search as a quality gate. */
  maxRelevanceScore: number;
}

export async function runKnowledgePipeline(
  rawQuery: string,
  userId?: string,
  conversationHistory?: ConversationTurn[],
  context?: { module?: string },
): Promise<PipelineRunResult> {
  const t0 = Date.now();
  // Key on the normalized module, so "draft" and "legal-drafting" share one entry
  // instead of caching the same answer twice under two spellings.
  const key = `${userId || "anon"}::${normalizePipelineModule(context?.module)}::${normKey(rawQuery)}`;
  const cached = cacheGet(key);
  if (cached !== undefined && cached.contextString.length > 0) {
    return {
      contextString: cached.contextString,
      hasCaseLaw: cached.contextString.includes("VERIFIED JUDGMENTS"),
      hasStatutes: cached.contextString.includes("VERIFIED STATUTES"),
      topics: [],
      durationMs: 0,
      caseLawHits: cached.caseLawHits,
      // Carry the score the hits actually scored. Reporting a flat 100 made every
      // cache hit clear any downstream relevance gate, however weak the hits were.
      maxRelevanceScore: cached.maxRelevanceScore,
    };
  }

  const inner = (async (): Promise<PipelineRunResult> => {
    // ---- Step 1: Rewrite follow-up query (FIRST) ----
    const history = conversationHistory || [];
    const queryForRetrieval = await rewriteFollowUpQuery(rawQuery, history);

    // ---- Step 2: Intent Classification & Cheap Query Analyzer ----
    const intent = classifyQueryIntent(queryForRetrieval, context);
    const tier = analyzeQueryExplicitness(queryForRetrieval, intent);
    intent.tier = tier;

    console.log(
      `[Pipeline:1:Analyze] query="${queryForRetrieval.slice(0, 60)}" ` +
      `tier=${tier} type=${intent.type} topScore=${intent.topTopicScore || 0} ` +
      `topics=[${intent.topics.map((t) => t.id).join(",")}]`,
    );

    // ---- Step 3: Multi-Stream Retrieval Assembly ----
    const USE_LLM_QUERY_EXTRACTOR = process.env.USE_LLM_QUERY_EXTRACTOR !== "false";
    let focusedQueries: string[] = [];

    // Vector Stream 1: ALWAYS include original rewritten query as grounding anchor (prevents HyDE drift)
    focusedQueries.push(queryForRetrieval);

    // Runs for long narratives, and for queries the topic dictionary did not
    // recognise — those get no synonym expansion at all otherwise.
    //
    // Measured on tests/eval/rag-eval.ts, after the fan-out fix:
    //   threshold 12 (default)  49/50, median 8.6s   — fires on 0 of the 50 cases
    //   forced on every query   47/50, median 13.2s  — 37 extra LLM calls
    //
    // So it is a safety net, not a speed-up. At the default it costs nothing on
    // ordinary queries; forced on it adds ~54% latency and wins nothing. Do not
    // raise PIPELINE_LLM_EXPAND_MIN_SCORE without re-running the eval.
    // Set it to 0 to disable the low-score trigger entirely.
    //
    // Note for anyone reading git history: an earlier comment here blamed this
    // trigger for a 44/50 run. That was wrong — the run logged 0 dictionary-miss
    // fires, so this path never executed. The real cause was connection-pool
    // contention, since fixed in vector-store.ts and db.ts.
    const LOW_TOPIC_SCORE = Number(process.env.PIPELINE_LLM_EXPAND_MIN_SCORE ?? 12);
    const dictionaryMissed =
      LOW_TOPIC_SCORE > 0 &&
      ((intent.topics?.length || 0) === 0 || (intent.topTopicScore || 0) < LOW_TOPIC_SCORE);
    // A named section is already a precise anchor; no need to pay for a rewrite.
    const needsLlmExpansion =
      (tier === "tier2_narrative" || dictionaryMissed) && !intent.statuteRef;

    if (needsLlmExpansion && USE_LLM_QUERY_EXTRACTOR) {
      console.log(
        `[Pipeline:2:LLM-Agent] Invoking Structured Legal Research Agent ` +
        `(reason=${tier === "tier2_narrative" ? "narrative" : "dictionary-miss"} ` +
        `topScore=${intent.topTopicScore || 0})`,
      );
      const research = await generateSemanticRetrievalQueries(queryForRetrieval);
      const deterministic = extractDeterministicFacts(queryForRetrieval);

      // Multi-Angle HyDE & Query Vector Streams
      const maq = research.multiAngleQueries;
      if (maq.hydeHeadnote && maq.hydeHeadnote.length > 20) {
        focusedQueries.push(maq.hydeHeadnote); // Stream 2: HyDE Headnote
      }
      if (maq.issueQuery) focusedQueries.push(maq.issueQuery); // Stream 3: Issue Query
      if (maq.statutoryQuery) focusedQueries.push(maq.statutoryQuery); // Stream 4: Statutory Query

      // Add hard facts (sections/citations)
      for (const fact of deterministic) {
        if (!focusedQueries.includes(fact)) focusedQueries.push(fact);
      }
      for (const statCand of research.statuteCandidates) {
        if (!focusedQueries.includes(statCand)) focusedQueries.push(statCand);
      }

      // Enrich intent object with LLM domain + issues + statute candidates
      if (research.domains.length > 0) {
        const lowerDomains = research.domains.map(d => d.toLowerCase());
        if (lowerDomains.includes("criminal") && !lowerDomains.includes("civil")) {
          intent.type = "case-law";
        } else if (lowerDomains.includes("statute") || lowerDomains.includes("constitutional")) {
          intent.type = "statute";
        } else {
          intent.type = "general-legal";
        }
      }

      if (research.issues.length > 0) {
        const issueTerms = research.issues.slice(0, 3).join(" ");
        intent.expandedQuery = `${intent.expandedQuery} ${issueTerms}`.trim();
        intent.expandedTerms = intent.expandedQuery.split(/\s+/);
      }

      console.log(
        `[Pipeline:2:LLM-Agent] domains=[${research.domains.join(",")}] ` +
        `statutes=[${research.statuteCandidates.join(",")}] confidence=${research.confidence}`,
      );
    } else if (queryForRetrieval.length > 150) {
      // Fallback: Regex query condensation for long Tier 1.5 queries
      const regexQueries = buildFocusedRetrievalQueries(queryForRetrieval, intent);
      for (const q of regexQueries) {
        if (!focusedQueries.includes(q)) focusedQueries.push(q);
      }
    }

    // ---- Step 4: Run Retrieval Engine (RRF Fusion & Voyage Law-2 Reranking) ----
    const retrieval = await runRetrieval(
      intent,
      userId || "",
      { caseLaw: 10, statutes: 8, adminDocs: 6 },
      focusedQueries.length > 0 ? focusedQueries : undefined,
    );

    console.log(
      `[Pipeline:3:Retrieve] ` +
      `caseLaw=${retrieval.diagnostics.caseLawFetched} ` +
      `statutes=${retrieval.diagnostics.statutesFetched} ` +
      `durationMs=${retrieval.diagnostics.durationMs}`,
    );

    // ---- Step 5: Build Context ----
    const ctx = buildContext(intent, retrieval);
    const caseLawHits = retrieval.caseLaw.map(hit => ({
      id: (hit.row as any).judgmentId || (hit.row as any).sourceDocId || undefined,
      citation: hit.row.citation,
      title: hit.row.title,
      court: hit.row.court,
      summary: hit.row.summary
    }));

    const maxRelevanceScore = retrieval.caseLaw.length > 0
      ? Math.max(...retrieval.caseLaw.map(h => h.relevanceScore))
      : 0;

    if (ctx.contextString.length > 0) {
      cacheSet(key, { contextString: ctx.contextString, caseLawHits, maxRelevanceScore });
    }

    // Record the runs where the topic dictionary or retrieval came up short, so
    // the dictionary can be grown from real queries instead of guesses.
    recordRetrievalMiss({
      intent,
      module: normalizePipelineModule(context?.module),
      caseLawFetched: retrieval.diagnostics.caseLawFetched,
      statutesFetched: retrieval.diagnostics.statutesFetched,
      adminDocsFetched: retrieval.diagnostics.adminDocsFetched,
      contextChars: ctx.contextString.length,
      durationMs: Date.now() - t0,
    });

    return {
      contextString: ctx.contextString,
      hasCaseLaw: ctx.hasCaseLawCitations,
      hasStatutes: ctx.hasStatutes,
      topics: intent.topics.map((t) => t.id),
      durationMs: Date.now() - t0,
      caseLawHits,
      maxRelevanceScore,
    };
  })();

  return Promise.race([
    inner,
    new Promise<PipelineRunResult>((resolve) =>
      setTimeout(
        () =>
          resolve({
            contextString: "",
            hasCaseLaw: false,
            hasStatutes: false,
            topics: [],
            durationMs: OUTER_DEADLINE_MS,
            caseLawHits: [],
            maxRelevanceScore: 0,
          }),
        OUTER_DEADLINE_MS,
      ),
    ),
  ]);
}

/**
 * Drop-in replacement for gatherKnowledgeContext(query, userId).
 * Returns only the context string — same signature as the old function.
 */
export async function gatherKnowledgeContextV2(
  query: string,
  userId?: string,
  conversationHistory?: ConversationTurn[],
  context?: { module?: string },
): Promise<string> {
  try {
    const result = await runKnowledgePipeline(query, userId, conversationHistory, context);
    return result.contextString;
  } catch (err) {
    console.error("[Pipeline:Error]", err instanceof Error ? err.message : String(err));
    return "\n\n[SYSTEM SAFETY GATE — KNOWLEDGE PIPELINE ERROR]\n" +
      "CRITICAL: Do NOT cite ANY specific section numbers, article numbers, or case citations from memory. " +
      "Provide general legal guidance only.";
  }
}

/**
 * Same as gatherKnowledgeContextV2 but returns the full pipeline result
 * including caseLawHits for the Case Law Card.
 */
export async function gatherKnowledgeWithHits(
  query: string,
  userId?: string,
  conversationHistory?: ConversationTurn[],
  context?: { module?: string },
): Promise<PipelineRunResult> {
  try {
    return await runKnowledgePipeline(query, userId, conversationHistory, context);
  } catch (err) {
    console.error("[Pipeline:Error]", err instanceof Error ? err.message : String(err));
    return {
      contextString: "\n\n[SYSTEM SAFETY GATE — KNOWLEDGE PIPELINE ERROR]\n" +
        "CRITICAL: Do NOT cite ANY specific section numbers, article numbers, or case citations from memory. " +
        "Provide general legal guidance only.",
      hasCaseLaw: false,
      hasStatutes: false,
      topics: [],
      durationMs: 0,
      caseLawHits: [],
      maxRelevanceScore: 0,
    };
  }
}

export type { ConversationTurn };

