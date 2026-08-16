import { getClient, getOpenRouterToolModelName } from "../openrouter-ai";

export interface MultiAngleQueries {
  hydeHeadnote: string;
  issueQuery: string;
  statutoryQuery: string;
  terminologyQuery: string;
}

export interface StructuredLegalResearch {
  jurisdiction: string;
  domains: string[];
  issues: string[];
  entities: string[];
  statuteCandidates: string[];
  proceduralContext: string;
  multiAngleQueries: MultiAngleQueries;
  confidence: number; // 0.0 to 1.0
  // Backward compatibility fields
  legal_domains: string[];
  queries: string[];
  syntheticHeadnote: string;
}

/**
 * Extracts structured legal research representation from a narrative query using gpt-4o-mini / OpenRouter tool model.
 */
export async function generateSemanticRetrievalQueries(narrative: string): Promise<StructuredLegalResearch> {
  const client = getClient();
  const model = getOpenRouterToolModelName(); // defaults to openai/gpt-4o-mini

  const emptyFallback: StructuredLegalResearch = {
    jurisdiction: "Pakistan",
    domains: [],
    issues: [],
    entities: [],
    statuteCandidates: [],
    proceduralContext: "",
    multiAngleQueries: {
      hydeHeadnote: "",
      issueQuery: "",
      statutoryQuery: "",
      terminologyQuery: "",
    },
    confidence: 0,
    legal_domains: [],
    queries: [],
    syntheticHeadnote: "",
  };

  try {
    const response = await client.chat.completions.create({
      model,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a senior Pakistani Legal Research Agent.
Analyze the user's query (which may be in English, Urdu, or Roman Urdu like "shohar ne jahez rakh liya") and output a JSON object:
{
  "jurisdiction": "Pakistan",
  "domains": ["family law", "criminal law"],
  "issues": ["retention of wife property", "criminal breach of trust"],
  "entities": ["wife", "husband", "dowry articles", "gold ornaments"],
  "statuteCandidates": ["PPC Section 406", "Muslim Family Laws Ordinance 1961 Section 9", "Family Courts Act 1964"],
  "proceduralContext": "suit for recovery / criminal complaint",
  "multiAngleQueries": {
    "hydeHeadnote": "A 2-sentence hypothetical Pakistani court headnote (starting with 'Held:' or 'The petitioner...') that would appear in a judgment resolving this issue. Use formal Pakistani legal language with specific section/act references. Example: 'Held: The petitioner wife is entitled to recovery of dowry articles under Section 406 PPC. The respondent husband failed to discharge the burden of proof regarding return of gold ornaments.'",
    "issueQuery": "husband retained wife property dowry recovery",
    "statutoryQuery": "Section 406 PPC Family Courts Act Section 9",
    "terminologyQuery": "dowry stridhan articles recovery"
  },
  "confidence": 0.95
}
Translate Roman Urdu concepts to official Pakistani legal terminology. Output valid JSON only.`,
        },
        {
          role: "user",
          content: narrative,
        },
      ],
    });

    const content = response.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);

    const domains: string[] = Array.isArray(parsed.domains)
      ? parsed.domains
      : Array.isArray(parsed.legal_domains)
      ? parsed.legal_domains
      : [];
    const issues: string[] = Array.isArray(parsed.issues) ? parsed.issues : [];
    const entities: string[] = Array.isArray(parsed.entities) ? parsed.entities : [];
    const statuteCandidates: string[] = Array.isArray(parsed.statuteCandidates) ? parsed.statuteCandidates : [];
    const proceduralContext: string = typeof parsed.proceduralContext === "string" ? parsed.proceduralContext : "";
    const confidence: number = typeof parsed.confidence === "number" ? parsed.confidence : 0.8;

    const maq = parsed.multiAngleQueries || {};
    const hydeHeadnote = typeof maq.hydeHeadnote === "string"
      ? maq.hydeHeadnote
      : typeof parsed.syntheticHeadnote === "string"
      ? parsed.syntheticHeadnote
      : "";
    const issueQuery = typeof maq.issueQuery === "string" ? maq.issueQuery : "";
    const statutoryQuery = typeof maq.statutoryQuery === "string" ? maq.statutoryQuery : "";
    const terminologyQuery = typeof maq.terminologyQuery === "string" ? maq.terminologyQuery : "";

    // Assemble queries list for backward compatibility
    const queries: string[] = [];
    if (issueQuery) queries.push(issueQuery);
    if (terminologyQuery) queries.push(terminologyQuery);
    if (statutoryQuery) queries.push(statutoryQuery);
    if (queries.length === 0 && Array.isArray(parsed.queries)) {
      parsed.queries.forEach((q: any) => { if (typeof q === "string") queries.push(q); });
    }

    return {
      jurisdiction: typeof parsed.jurisdiction === "string" ? parsed.jurisdiction : "Pakistan",
      domains,
      issues,
      entities,
      statuteCandidates,
      proceduralContext,
      multiAngleQueries: {
        hydeHeadnote,
        issueQuery,
        statutoryQuery,
        terminologyQuery,
      },
      confidence,
      legal_domains: domains,
      queries,
      syntheticHeadnote: hydeHeadnote,
    };
  } catch (error) {
    console.error("[generateSemanticRetrievalQueries] LLM Extraction Failed:", error);
    return emptyFallback;
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
  if (secMatch) secMatch.forEach((m) => facts.add(m.trim()));

  // Pattern 2: Specific law bodies or procedural terms (e.g. "FBR", "SECP", "PECA", "NAB", "FIR")
  const abbrMatch = narrative.match(/\b(?:PPC|CrPC|CPC|FBR|SECP|PECA|NAB|FIA|ATC|FST|ATA|FIR|Qanun-e-Shahadat|Khula|Iddat|Hizanat)\b/gi);
  if (abbrMatch) abbrMatch.forEach((m) => facts.add(m.trim()));

  // Pattern 3: Case Citations (e.g. "PLD 2020 SC 123", "2024 SCMR 45")
  const citMatch = narrative.match(/\b(?:19|20)\d{2}\s+(?:SCMR|PLD|YLR|CLC|MLD|PCrLJ|PLC|PTD)\s+(?:SC|LHC|SHC|IHC|PHC|BHC)?\s*\d+\b/gi);
  if (citMatch) citMatch.forEach((m) => facts.add(m.trim()));

  // Deduplicate: If an item (like "PPC") is a substring of a longer section reference (like "Section 406 PPC"), remove the redundant standalone item.
  const allFacts = Array.from(facts);
  const result: string[] = [];

  for (const item of allFacts) {
    const isRedundantSubstring = allFacts.some(
      (other) => other !== item && other.toLowerCase().includes(item.toLowerCase())
    );
    if (!isRedundantSubstring) {
      result.push(item);
    }
  }

  return result;
}
