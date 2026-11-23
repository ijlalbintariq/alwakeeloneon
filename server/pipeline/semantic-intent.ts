import { LEGAL_TOPICS, classifyQueryIntent, analyzeQueryExplicitness, normalizePipelineModule, type QueryIntent } from "./intent-classifier";
import { generateSemanticRetrievalQueries, type StructuredLegalResearch } from "./llm-query-extractor";
import { extractCitations } from "../citation-verify";
import type { ConversationTurn } from "./query-rewriter";
import { reviewCaseRelevance, CASE_REVIEW_UNAVAILABLE } from "./case-relevance";

export const INTENT_UNAVAILABLE = "[SYSTEM SAFETY GATE — INTENT UNCONFIRMED]\nThe legal subject could not be established reliably. Ask a brief clarifying question. Do not supply case citations or substitute cases from another field.";

export function applySemanticIntent(intent: QueryIntent, research: StructuredLegalResearch, module?: string): boolean {
  const primary = research.primaryTopic === "other-legal"
    ? {id:"other-legal",label:"Other legal issue",primary:[],synonyms:[],minRelevanceScore:0}
    : LEGAL_TOPICS.find(t => t.id === research.primaryTopic);
  if (!primary || research.confidence < 0.7 || !research.requestType || !research.retrievalQuery) return false;
  const topics = [primary, ...LEGAL_TOPICS.filter(t => t.id !== primary.id && research.topics?.includes(t.id))];
  const mode = normalizePipelineModule(module);
  intent.semanticTask = research.task || "research";
  intent.semanticIssue = research.issues.join("; ") || research.retrievalQuery;
  intent.statuteRef = undefined;
  intent.type = research.requestType === "citation-lookup" ? "case-law" : research.requestType;
  intent.topics = topics.slice(0, 3);
  intent.normalized = research.retrievalQuery.toLowerCase().replace(/\s+/g, " ").trim();
  intent.expandedTerms = [...new Set([research.retrievalQuery, ...research.issues].join(" ").toLowerCase().split(/\s+/))];
  intent.expandedQuery = intent.expandedTerms.join(" ");
  intent.needsCaseLaw = mode !== "contract-drafting" && intent.type !== "statute";
  intent.needsStatutes = mode !== "case-search";
  intent.needsAdminDocs = mode !== "case-search";
  if (["summarize", "translate", "clarify"].includes(intent.semanticTask)) {
    intent.needsCaseLaw = false; intent.needsStatutes = false; intent.needsAdminDocs = false;
  }
  return true;
}

export interface QueryUnderstanding {
  intent?: QueryIntent;
  research?: StructuredLegalResearch;
  status: "ready" | "unavailable" | "clarify";
}

/** All semantic entry points share this resolver. Only precise lookups use local parsing. */
export async function understandLegalQuery(query: string, history: ConversationTurn[] = [], context?: {module?:string;sourceContext?:string}): Promise<QueryUnderstanding> {
  const intent = classifyQueryIntent(query, context);
  intent.tier = analyzeQueryExplicitness(query, intent);
  const compact = (value:string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
  const exactCitation = extractCitations(query).some(c=>compact(c) === compact(query));
  const ref = intent.statuteRef;
  const exactSection = !!ref && [
    `${ref.abbr} ${ref.sectionOrArticle}`, `${ref.sectionOrArticle} ${ref.abbr}`,
    `section ${ref.sectionOrArticle} ${ref.abbr}`, `${ref.abbr} section ${ref.sectionOrArticle}`,
    `article ${ref.sectionOrArticle} ${ref.abbr}`,
  ].some(value=>compact(value) === compact(query));
  if (exactCitation || exactSection) return {intent,status:"ready"};
  if (process.env.USE_LLM_QUERY_EXTRACTOR === "false") return {status:"unavailable"};
  const research = await generateSemanticRetrievalQueries(query,history,context?.sourceContext);
  if (!applySemanticIntent(intent,research,context?.module)) return {status:"unavailable"};
  return intent.semanticTask === "clarify" ? {status:"clarify"} : {intent,research,status:"ready"};
}

export async function filterToolResult<T extends { verifiedHits: Array<{citation:string;title:string;court:string;summary:string}>; verifiedCitations:string[]; verifiedTitles:Array<{title:string;citation:string}>; foundCount:number; contextString:string }>(result:T, intent?:QueryIntent, additional:T["verifiedHits"] = []):Promise<T> {
  const reviewed = intent?.needsCaseLaw ? await reviewCaseRelevance(intent,result.verifiedHits) : {rows:[],status:"not-required"};
  const seen = new Set<string>();
  const hits = intent?.needsCaseLaw ? [...reviewed.rows,...additional].filter(hit=>{
    const key=JSON.stringify([hit.citation,hit.court,hit.title]);
    if(seen.has(key)) return false; seen.add(key); return true;
  }) : [];
  return {...result,verifiedHits:hits,foundCount:hits.length,verifiedCitations:hits.map(h=>h.citation),
    verifiedTitles:hits.map(h=>({title:h.title,citation:h.citation})),
    contextString:hits.length ? "CASE LAW LEADS (identity and relevance still require source review):\n" + hits.map(h=>JSON.stringify(h)).join("\n") : reviewed.status === "unavailable" ? CASE_REVIEW_UNAVAILABLE : ""};
}
