import { LEGAL_TOPICS, classifyQueryIntent, normalizePipelineModule, type QueryIntent } from "./intent-classifier";
import type { StructuredLegalResearch } from "./llm-query-extractor";

export const INTENT_UNAVAILABLE = "[SYSTEM SAFETY GATE — INTENT UNCONFIRMED]\nThe legal subject could not be established reliably. Ask a brief clarifying question. Do not supply case citations or substitute cases from another field.";

export function applySemanticIntent(intent: QueryIntent, research: StructuredLegalResearch, module?: string): boolean {
  const primary = LEGAL_TOPICS.find(t => t.id === research.primaryTopic);
  if (!primary || research.confidence < 0.7 || !research.requestType || !research.retrievalQuery) return false;
  const topics = [primary, ...LEGAL_TOPICS.filter(t => t.id !== primary.id && research.topics?.includes(t.id))];
  const mode = normalizePipelineModule(module);
  intent.type = research.requestType === "citation-lookup" ? "case-law" : research.requestType;
  intent.topics = topics.slice(0, 3);
  intent.normalized = research.retrievalQuery.toLowerCase().replace(/\s+/g, " ").trim();
  intent.expandedTerms = [...new Set([research.retrievalQuery, ...research.issues].join(" ").toLowerCase().split(/\s+/))];
  intent.expandedQuery = intent.expandedTerms.join(" ");
  intent.needsCaseLaw = mode !== "contract-drafting" && intent.type !== "statute";
  intent.needsStatutes = mode !== "case-search";
  intent.needsAdminDocs = mode !== "case-search";
  return true;
}

/** Conservative evidence check; reporter names and a matching citation are not topical proof. */
export function caseSupportsIntent(row: {title?:string; summary?:string}, intent: QueryIntent): boolean {
  if (intent.type === "citation-lookup") return true;
  if (!intent.topics.length) return false;
  const body = `${row.title || ""}\n${row.summary || ""}`;
  if (intent.topics[0].id === "family") {
    return /family\s+(?:court|judge|law)|matrimonial|khula|dower|nafaqa|hizanat|talaq|nikah|divorce|guardianship|(?:child|wife|minor|spous\w*)\W+(?:\w+\W+){0,5}(?:maintenance|custody)|(?:maintenance|custody)\W+(?:\w+\W+){0,5}(?:child|wife|minor|spous\w*)/i.test(body);
  }
  const actual = classifyQueryIntent(body);
  return actual.topics[0]?.id === intent.topics[0].id;
}

export function filterToolResult<T extends { verifiedHits: Array<{citation:string;title:string;court:string;summary:string}>; verifiedCitations:string[]; verifiedTitles:Array<{title:string;citation:string}>; foundCount:number; contextString:string }>(result:T, intent?:QueryIntent, additional: T["verifiedHits"] = []):T {
  const hits = intent?.needsCaseLaw ? [...result.verifiedHits,...additional].filter(hit=>caseSupportsIntent(hit,intent)) : [];
  return {...result,verifiedHits:hits,foundCount:hits.length,verifiedCitations:hits.map(h=>h.citation),
    verifiedTitles:hits.map(h=>({title:h.title,citation:h.citation})),
    contextString:hits.length ? "CASE LAW LEADS (identity and relevance still require source review):\n" + hits.map(h=>JSON.stringify(h)).join("\n") : ""};
}
