import { getClient, getOpenRouterToolModelName } from "../openrouter-ai";

export interface SemanticQueries {
  legal_domains: string[];
  issues: string[];
  queries: string[];
}

/**
 * Extracts structured semantic queries from a complex narrative using gpt-4o-mini.
 * The JSON schema enforces conceptual, terminology, and remedy queries.
 */
export async function generateSemanticRetrievalQueries(narrative: string): Promise<SemanticQueries> {
  const client = getClient();
  const model = getOpenRouterToolModelName(); // defaults to openai/gpt-4o-mini

  try {
    const response = await client.chat.completions.create({
      model,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are an expert Pakistani Legal Researcher.
Analyze the user's narrative (which may be in English, Urdu, or Roman Urdu like "shohar ne jahez rakh liya") and generate a JSON object with:
{
  "legal_domains": ["family", "criminal"], // e.g. tax, banking, corporate, family, constitutional
  "issues": ["retention of wife's property", "criminal breach of trust"], // Core legal disputes
  "queries": [
    // Exactly 3 short English search queries (max 5-6 words each) for a vector database:
    // Query 1: Conceptual (what happened?) e.g. "husband retained wife property"
    // Query 2: Terminology (what terms do judges use?) e.g. "dowry stridhan articles recovery"
    // Query 3: Remedy (what is the procedural remedy?) e.g. "suit for recovery dowry section 406"
  ]
}
Translate Roman Urdu concepts to official Pakistani legal terms. Output valid JSON only.`
        },
        {
          role: "user",
          content: narrative
        }
      ]
    });

    const content = response.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(content) as SemanticQueries;
    
    return {
      legal_domains: Array.isArray(parsed.legal_domains) ? parsed.legal_domains : [],
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      queries: Array.isArray(parsed.queries) ? parsed.queries : []
    };
  } catch (error) {
    console.error("[generateSemanticRetrievalQueries] LLM Extraction Failed:", error);
    return { legal_domains: [], issues: [], queries: [] };
  }
}

/**
 * Deterministic extraction of hard facts (sections, articles, citations)
 * that should ALWAYS be appended to vector searches to anchor the semantics.
 */
export function extractDeterministicFacts(narrative: string): string[] {
  const facts = new Set<string>();
  
  // Pattern 1: Section/Article references (e.g. "Section 489-F", "Article 199")
  const secMatch = narrative.match(/\b(?:section|sec\.|article|art\.)\s+\d+[A-Z\-]*\b(?:\s+(?:PPC|CrPC|CPC|Constitution))?/gi);
  if (secMatch) secMatch.forEach(m => facts.add(m.trim()));

  // Pattern 2: Specific law bodies or procedural terms (e.g. "FBR", "SECP", "PECA", "NAB", "FIR")
  const abbrMatch = narrative.match(/\b(?:PPC|CrPC|CPC|FBR|SECP|PECA|NAB|FIA|ATC|FST|ATA|FIR|Qanun-e-Shahadat|Khula|Iddat|Hizanat)\b/gi);
  if (abbrMatch) abbrMatch.forEach(m => facts.add(m.trim()));

  // Pattern 3: Case Citations (e.g. "PLD 2020 SC 123", "2024 SCMR 45")
  const citMatch = narrative.match(/\b(?:19|20)\d{2}\s+(?:SCMR|PLD|YLR|CLC|MLD|PCrLJ|PLC|PTD)\s+(?:SC|LHC|SHC|IHC|PHC|BHC)?\s*\d+\b/gi);
  if (citMatch) citMatch.forEach(m => facts.add(m.trim()));

  // Deduplicate: If an item (like "PPC") is a substring of a longer section reference (like "Section 406 PPC"), remove the redundant standalone item.
  const allFacts = Array.from(facts);
  const result: string[] = [];

  for (const item of allFacts) {
    const isRedundantSubstring = allFacts.some(
      other => other !== item && other.toLowerCase().includes(item.toLowerCase())
    );
    if (!isRedundantSubstring) {
      result.push(item);
    }
  }

  return result;
}
