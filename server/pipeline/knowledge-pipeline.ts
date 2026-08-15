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

import { classifyQueryIntent } from "./intent-classifier";
import { runRetrieval } from "./retrieval-engine";
import { buildContext } from "./context-builder";
import { rewriteFollowUpQuery, type ConversationTurn } from "./query-rewriter";
import { generateSemanticRetrievalQueries, extractDeterministicFacts } from "./llm-query-extractor";
import type { QueryIntent } from "./intent-classifier";

// ---------------------------------------------------------------------------
// Cache (mirrors old knowledgeContextCache behaviour)
// ---------------------------------------------------------------------------

interface CachedPipelineResult {
  contextString: string;
  caseLawHits: CaseLawHit[];
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
// For long narrative queries (>150 chars), generates 2-3 focused sub-queries
// targeting the specific legal issue, property/object, and criminal angle.
// Each sub-query is retrieved separately, results are merged + deduped, then
// the existing reranker scores them. Short queries skip this entirely.
//
// Benchmark evidence (live HNSW index, Voyage Law 2):
//   Full narrative:      avg top-5 score = 0.5798
//   Single condensed:    avg top-5 score = 0.7318 (+26%)
//   3 focused queries:   avg top-5 scores = 0.6904 / 0.6170 / 0.6124
//                        (broader coverage: dowry + gold + criminal angles)

/**
 * Deduplicate words in a query string while preserving order.
 */
function dedupeWords(query: string): string {
  const seen = new Set<string>();
  return query.split(/\s+/).filter(w => {
    const lower = w.toLowerCase();
    if (seen.has(lower)) return false;
    seen.add(lower);
    return true;
  }).join(" ");
}

/**
 * Detect whether the narrative is about a family/matrimonial matter.
 */
function isFamilyContext(text: string): boolean {
  return /\b(?:husband|wife|biwi|shohar|marriage|married|nikah|mehr|dowry|jahez|matrimonial|talaq|khula|divorce|iddat|hizanat)\b/i.test(text);
}

/**
 * Detect the primary legal remedy the user is seeking.
 * Order matters: more specific remedies checked before broad ones.
 * Context-aware: "custody" only matches child custody, not police custody.
 */
function detectRemedy(text: string): string {
  // 1. "custody" only when it's about children, not police detention
  if (/\b(?:custody|hizanat|guardian|visitation)\b/i.test(text) &&
      /\b(?:child|son|daughter|minor|bachch|bachon|beta|beti|mother|father|parent)\b/i.test(text))
    return "custody";

  // 2. Habeas Corpus / illegal detention
  if (/\b(?:habeas corpus|section 491 crpc|illegal detention)\b/i.test(text)) return "bail";

  // 3. Urgent criminal liberty: check "bail" before general recovery
  if (/\b(?:bail|pre-arrest|post-arrest)\b/i.test(text)) return "bail";

  // 4. Injunction / stay orders (check BEFORE recovery so "stay against recovery" yields injunction)
  if (/\b(?:injunction|restrain|stop|prohibit|stay|stay order|anton piller)\b/i.test(text)) return "injunction";

  // 5. Declaration of rights
  if (/\b(?:declaration|declare)\b/i.test(text)) return "declaration";

  // 6. Recovery of property/money/items — filter out false matches:
  //    - Tax/SECP "tax return" / "annual return" / "voluntary return"
  //    - Police seizure "police recovered weapon/drugs"
  //    - Passive "decision was taken" (require 'took/taken' + property object)
  const isTaxOrSecpReturn = /\b(?:tax return|annual return|form 29|voluntary return|return of income)\b/i.test(text);
  const isPoliceSeizure = /\b(?:police|fia|nab|anf|atd)\s+(?:has\s+)?(?:seized|recovered|found)\b/i.test(text);
  const hasTookProperty = /\b(?:took|taken)\s+(?:possession|gold|cash|money|property|dowry|jahez|articles|car|vehicle|belongings|flat|plot)\b/i.test(text);
  
  if (!isTaxOrSecpReturn && !isPoliceSeizure &&
      (/(?:recover|return|restor|get back|give back|stole|stolen)/i.test(text) || hasTookProperty)) {
    return "recovery";
  }

  // 7. Possession for real estate / land disputes (not drug possession)
  if (/\b(?:possession|dispossess)\b/i.test(text) &&
      !/\b(?:narcotic|hashish|heroin|charas|drug|opium|gram|kilo)\b/i.test(text))
    return "possession";

  if (/\b(?:maintenance|nafaqa|nafqa)\b/i.test(text)) return "maintenance";
  if (/\b(?:dissolution|khula|divorce|talaq)\b/i.test(text)) return "dissolution";
  if (/\b(?:partition|share|inheritance|succession)\b/i.test(text)) return "partition";
  if (/\b(?:compensation|damages|refund)\b/i.test(text)) return "compensation";
  return "";
}

/**
 * Extract property/object terms from query for a property-focused sub-query.
 * Only triggers when:
 *  1. There's a clear property recovery intent (took/taken/recover)
 *  2. The context is matrimonial/family (not commercial disputes)
 */
function extractPropertyTerms(text: string): string | null {
  // Only generate a property sub-query when user is seeking recovery/return of items
  // Uses stem matching (no trailing \b) to catch recovered/returning/restoration etc.
  const hasRecoveryIntent = /(?:recover|return|restor|get back|give back|took|taken|seiz|snatch|stole|stolen)/i.test(text);
  if (!hasRecoveryIntent) return null;

  // Only in family/matrimonial context — not cheque bounces, commercial disputes etc.
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

/**
 * Detect if the narrative implies a criminal angle and build a criminal sub-query.
 * Returns a generic criminal query — NOT hardcoded to "wife property" since this
 * applies to non-family cases too (defamation FIRs, commercial fraud, etc.).
 */
function detectCriminalAngle(text: string): string | null {
  const family = isFamilyContext(text);

  // Skip generic FIR / prosecution quashing query if this is an official appeal against conviction or a civil defamation suit
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

  // Implied criminal angle: forcible expulsion + property seizure = potential S.406
  if (/(?:forcibl|expell|thrown out|threw.*out|kick|drove.*out)/i.test(text) &&
      /\b(?:gold|cash|dowry|jewel|property|belonging|valuable)\b/i.test(text))
    return "criminal breach trust wife property husband section 406 PPC";

  return null;
}

/**
 * Regex-based condensation fallback — extracts legal keywords from narrative.
 * Used only when buildFocusedRetrievalQueries cannot produce focused queries.
 * Broadened patterns to catch non-standard legal queries (neighbor disputes, etc.)
 */
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
    // Broader terms for non-standard legal queries (stem matching — no trailing \b)
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

/**
 * Build 2-3 focused retrieval queries from the classified intent and raw query.
 *
 * The intent classifier has already analyzed the full narrative for topic detection.
 * This function uses that output + direct regex extraction to build precise,
 * short retrieval queries that produce much higher vector search scores.
 *
 * Returns empty array for short queries (<150 chars) — they don't need condensation.
 */
function buildFocusedRetrievalQueries(rawQuery: string, intent: QueryIntent): string[] {
  // Short queries are already focused enough
  if (rawQuery.length <= 150) return [];

  const queries: string[] = [];
  const lower = rawQuery.toLowerCase();
  const remedy = detectRemedy(lower);

  // Query 1: Core legal issue from topic primary terms + remedy
  if (intent.topics.length > 0) {
    const topicTerms = intent.topics[0].primary.slice(0, 4).join(" ");
    const q1 = remedy ? `${remedy} ${topicTerms}` : topicTerms;
    const deduped = dedupeWords(q1.trim());
    if (deduped.length > 5) queries.push(deduped);
  }

  // Query 2: Property/object-specific query (only in family context)
  const propertyQuery = extractPropertyTerms(lower);
  if (propertyQuery && !queries.some(q => q === propertyQuery)) {
    queries.push(propertyQuery);
  }

  // Query 3: Criminal/alternate angle (only if detected in narrative)
  const criminalQuery = detectCriminalAngle(lower);
  if (criminalQuery && !queries.some(q => q === criminalQuery)) {
    queries.push(criminalQuery);
  }

  // Fallback: regex condensation if no focused queries could be built
  if (queries.length === 0) {
    const condensed = condenseLegalQuery(rawQuery);
    const fallbackText = condensed !== rawQuery ? condensed : rawQuery.slice(0, 100);
    const deduped = dedupeWords(fallbackText);
    if (deduped.length > 5) {
      queries.push(deduped);
    }
  }

  return queries.slice(0, 3); // Cap at 3 to limit latency
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

const OUTER_DEADLINE_MS = Number(process.env.KNOWLEDGE_OUTER_DEADLINE_MS || 30000);  // 30s — DB ILIKE + tool-search OR fallback can take 14-20s on broad queries; previous 20000ms cutoff dropped completed retrievals (totalMs=20013 race loss observed in prod)

function normKey(q: string): string {
  return q.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 280);
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
}

export async function runKnowledgePipeline(
  rawQuery: string,
  userId?: string,
  conversationHistory?: ConversationTurn[],
  context?: { module?: string },
): Promise<PipelineRunResult> {
  const t0 = Date.now();
  const key = `${userId || "anon"}::${context?.module || "none"}::${normKey(rawQuery)}`;
  const cached = cacheGet(key);
  // Never use a cached empty string — it means a previous request timed out or found nothing.
  // Retry the DB every time until we get real results, then cache them.
  if (cached !== undefined && cached.contextString.length > 0) {
    return {
      contextString: cached.contextString,
      hasCaseLaw: cached.contextString.includes("VERIFIED JUDGMENTS"),
      hasStatutes: cached.contextString.includes("VERIFIED STATUTES"),
      topics: [],
      durationMs: 0,
      caseLawHits: cached.caseLawHits,
    };
  }

  const outerTimer = new Promise<null>((resolve) =>
    setTimeout(() => resolve(null), OUTER_DEADLINE_MS),
  );

  const inner = (async (): Promise<PipelineRunResult> => {
    // ---- Stage 0: Rewrite follow-up query ----
    // Resolves pronouns/vague references so retrieval gets a self-contained phrase.
    // e.g. "what about the punishment?" → "punishment for narcotics CNSA Section 9"
    // Skipped when no prior context or query is already self-contained.
    const history = conversationHistory || [];
    const queryForRetrieval = await rewriteFollowUpQuery(rawQuery, history);

    // ---- Stage 1: Classify intent ----
    // Full narrative goes to intent classifier — it needs all context for topic/domain detection.
    const intent = classifyQueryIntent(queryForRetrieval, context);
    console.log(
      `[Pipeline:1:Classify] query="${queryForRetrieval.slice(0, 60)}"${queryForRetrieval !== rawQuery ? ` (rewritten from "${rawQuery.slice(0, 40)}")` : ""} ` +
      `type=${intent.type} ` +
      `topics=[${intent.topics.map((t) => t.id).join(",")}] ` +
      `expandedQuery="${intent.expandedQuery.slice(0, 80)}"`,
    );

    // ---- Stage 1.5: Build focused retrieval queries ----
    // For long narratives (>150 chars), generate 2-3 focused sub-queries that target
    // the specific legal issue, property/object, and criminal angle.
    // Short queries pass through unchanged. Each sub-query is retrieved separately,
    // then results are merged and deduped before the existing reranker.
    // Default to true unless explicitly disabled with "false"
    const USE_LLM_QUERY_EXTRACTOR = process.env.USE_LLM_QUERY_EXTRACTOR !== "false";
    let focusedQueries: string[] = [];

    if (queryForRetrieval.length > 150) {
      if (USE_LLM_QUERY_EXTRACTOR) {
        console.log(`[Pipeline:1.5:LLM] Generating semantic queries for complex narrative...`);
        const semantic = await generateSemanticRetrievalQueries(queryForRetrieval);
        const deterministic = extractDeterministicFacts(queryForRetrieval);
        
        focusedQueries = [...semantic.queries];
        if (deterministic.length > 0) {
          // Push each deterministic fact (e.g. "Section 406 PPC", "Article 199") individually 
          // so the retrieval engine queries each legal anchor cleanly
          for (const fact of deterministic) {
            focusedQueries.push(fact);
          }
        }

        // Resiliency Fallback: If LLM network request failed or returned 0 queries, fall back to Regex engine
        if (focusedQueries.length === 0) {
          console.warn(`[Pipeline:1.5:LLM] LLM returned 0 queries (network error or timeout). Falling back to Regex engine.`);
          focusedQueries = buildFocusedRetrievalQueries(queryForRetrieval, intent);
        }
      } else {
        focusedQueries = buildFocusedRetrievalQueries(queryForRetrieval, intent);
      }
    }

    if (focusedQueries.length > 0) {
      console.log(
        `[Pipeline:1.5:FocusedQueries] generated ${focusedQueries.length} queries: ${focusedQueries.map(q => `"${q.slice(0, 60)}"`).join(", ")}`,
      );
    }

    const retrieval = await runRetrieval(
      intent,
      userId || "",
      { caseLaw: 10, statutes: 8, adminDocs: 6 },
      focusedQueries.length > 0 ? focusedQueries : undefined,
    );
    console.log(
      `[Pipeline:2:Retrieve] ` +
      `caseLaw=${retrieval.diagnostics.caseLawFetched} ` +
      `caseLawFiltered=${retrieval.diagnostics.caseLawAfterFilter} ` +
      `statutes=${retrieval.diagnostics.statutesFetched} ` +
      `adminDocs=${retrieval.diagnostics.adminDocsFetched} ` +
      `retrievalMs=${retrieval.diagnostics.durationMs}`,
    );

    // ---- Stage 3: Build context ----
    const ctx = buildContext(intent, retrieval);
    console.log(
      `[Pipeline:3:Build] ` +
      `sections=[${ctx.sections.map((s) => s.id).join(",")}] ` +
      `hasCaseLaw=${ctx.hasCaseLawCitations} ` +
      `hasStatutes=${ctx.hasStatutes} ` +
      `contextLen=${ctx.contextString.length}`,
    );

    const durationMs = Date.now() - t0;
    console.log(`[Pipeline:Done] totalMs=${durationMs}`);

    // Only cache non-empty results. Empty means timeout or no data — don't poison the cache.
    const caseLawHits = retrieval.caseLaw.map(hit => ({
      id: (hit.row as any).judgmentId || (hit.row as any).sourceDocId || undefined,
      citation: hit.row.citation,
      title: hit.row.title,
      court: hit.row.court,
      summary: hit.row.summary
    }));
    if (ctx.contextString.length > 0) {
      cacheSet(key, { contextString: ctx.contextString, caseLawHits });
    }

    // R4: If context is empty (no results found), inject safety gate
    if (ctx.contextString.length === 0) {
      const safetyGateContext = "\n\n" +
        "[SYSTEM SAFETY GATE — NO MATCHING DATABASE RESULTS]\n" +
        "No relevant statutes or case law were found in the database for this query.\n" +
        "CRITICAL RULES:\n" +
        "1. Do NOT cite ANY specific section numbers, article numbers, or case citations from memory.\n" +
        "2. Do NOT output a 'Leading Case Law' section or say 'No relevant judgments found'.\n" +
        "3. Provide general statutory analysis and practical legal guidance.";
      return {
        contextString: safetyGateContext,
        hasCaseLaw: false,
        hasStatutes: false,
        topics: intent.topics.map((t) => t.label),
        durationMs: Date.now() - t0,
        caseLawHits: [],
      };
    }

    return {
      contextString: ctx.contextString,
      hasCaseLaw: ctx.hasCaseLawCitations,
      hasStatutes: ctx.hasStatutes,
      topics: intent.topics.map((t) => t.label),
      durationMs,
      caseLawHits,
    };
  })();

  const result = await Promise.race([inner, outerTimer]);
  if (result === null) {
    const durationMs = Date.now() - t0;
    console.warn(`[Pipeline:Timeout] exceeded ${OUTER_DEADLINE_MS}ms — returning empty context`);
    const safetyGateContext = "\n\n" +
      "[SYSTEM SAFETY GATE — NO DATABASE RESULTS AVAILABLE]\n" +
      "The knowledge pipeline returned no results (timeout or no matching data).\n" +
      "CRITICAL RULES:\n" +
      "1. Do NOT cite ANY specific section numbers, article numbers, or case citations from memory.\n" +
      "2. Do NOT cite ANY judgment citations from memory — no PLD, SCMR, YLR, etc.\n" +
      "3. Do NOT output a 'Leading Case Law' section or say 'No relevant judgments found'.\n" +
      "4. Provide general statutory analysis and practical legal strategy.";
    return { contextString: safetyGateContext, hasCaseLaw: false, hasStatutes: false, topics: [], durationMs, caseLawHits: [] };
  }
  return result;
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
    };
  }
}

export type { ConversationTurn };
