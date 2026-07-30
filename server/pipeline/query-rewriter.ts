/**
 * Query Rewriter
 *
 * Responsibility: Resolve pronouns and vague references in follow-up queries
 *                 so the retrieval pipeline gets a self-contained search phrase.
 *
 * Enhancements:
 *   - 5-second timeout (up from 2s) to prevent premature AI API timeouts.
 *   - Retains Thread Turn 0 (Initial User Query) so the root topic is never lost.
 *   - Zero-latency local topic fallback extractor if external AI rewriter times out.
 */

import { chatWithDeepSeek, isDeepSeekAvailable } from "../deepseek-ai";

// Patterns that signal the current query refers to something from prior context.
const VAGUE_REFERENCE_RE = /\b(it|its|that|this|the case|the section|the same|the above|the punishment|the penalty|the offence|what about|and also|and what|how about|applicable here|apply here|related to that|regarding that|regarding this|my issue|my situation|my case|more judgments|more cases)\b/i;

// Starters that are obviously a follow-up even without a pronoun.
const FOLLOWUP_STARTER_RE = /^(what about|how about|and |but |so |then |also |why |what if|does it|is it|are they|can it|can they|give more|more case law|more cases|any more|give me more)\b/i;

const REWRITE_TIMEOUT_MS = 5000; // 5 seconds (allows DeepSeek network buffer)

const REWRITE_SYSTEM_PROMPT = `You are a legal search query normalizer for Pakistani law.

Given a short conversation history and the user's latest message, rewrite the query
into a self-contained search phrase of 4-10 words suitable for a legal database search.

Rules:
- Replace pronouns and vague references with the actual legal topic from history.
- Keep all legal terms, sections, journals, and abbreviations exact: PPC, CrPC, CPC, QSO, CNSA, PECA, SCMR, PLD, YLR, CLC, PCrLJ, Section, Article, hiba, diyat, qisas, FIR, nikkah, khula, khasra, patwari, mutation, custody, hizanat, guardian, minor, welfare.
- Remove filler words: "can you tell me", "what about", "I want to know", "give me more".
- Output ONLY the rewritten query — no explanation, no punctuation at the end.
- If the query is already self-contained, return it unchanged.
- Maximum 10 words.`;

export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
}

/**
 * Detect whether the current query needs rewriting based on context.
 */
export function needsRewrite(rawQuery: string, hasPriorTurns: boolean): boolean {
  if (!hasPriorTurns) return false;
  if (rawQuery.trim().length > 180) return false; // long query is likely self-contained
  return VAGUE_REFERENCE_RE.test(rawQuery) || FOLLOWUP_STARTER_RE.test(rawQuery.trim());
}

/**
 * Fast local fallback extractor (0ms, zero latency).
 * Extracts core legal topic keywords from the initial user prompt and recent turns
 * when the external AI rewriter fails or times out.
 */
export function extractLocalTopicKeywords(rawQuery: string, history: ConversationTurn[]): string {
  if (!history || history.length === 0) return rawQuery;

  // Combine initial user turn (Thread Anchor) and recent user turns
  const userTexts = history
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join(" ");

  // Common Pakistani legal domain topics & key terms regex
  const legalTopicMatches = userTexts.match(
    /\b(custody|hizanat|guardian|guardianship|minor|welfare|father|mother|visitation|maintenance|khula|dower|nikkah|talaq|family|bail|pre-arrest|post-arrest|narcotics|cnsa|section \d+|article \d+|ppc|crpc|cpc|qso|peca|murder|302|337|420|489-f|fraud|cheating|partition|inheritance|succession|mutation|patwari|khasra|possession|injunction|writ|mandamus|habeas corpus)\b/gi
  );

  if (!legalTopicMatches || legalTopicMatches.length === 0) {
    // Fallback to taking first 12 words of the root user prompt
    const rootUserTurn = history.find((m) => m.role === "user")?.content || "";
    const cleanRoot = rootUserTurn.replace(/[^\w\s]/gi, " ").slice(0, 100).trim();
    if (cleanRoot.length > 5) {
      return `${rawQuery} ${cleanRoot}`.trim();
    }
    return rawQuery;
  }

  // Deduplicate matched legal keywords
  const uniqueKeywords = Array.from(new Set(legalTopicMatches.map((k) => k.toLowerCase()))).slice(0, 5);
  return `${rawQuery} ${uniqueKeywords.join(" ")}`.trim();
}

/**
 * Rewrite a follow-up query into a self-contained retrieval phrase.
 * Retains Thread Turn 0 (Initial User Query) and uses fast local fallback on timeout.
 */
export async function rewriteFollowUpQuery(
  rawQuery: string,
  history: ConversationTurn[],
): Promise<string> {
  if (!history || history.length === 0) return rawQuery;
  if (!needsRewrite(rawQuery, history.length > 0)) return rawQuery;

  // Thread Turn 0 (Root User Question) + up to 3 recent turns
  const rootTurn = history[0];
  const recentTurns = history.slice(-3);
  const combinedTurns = rootTurn && !recentTurns.includes(rootTurn)
    ? [rootTurn, ...recentTurns]
    : recentTurns;

  const historyText = combinedTurns
    .map((m) => `${m.role === "user" ? "User" : "AI"}: ${m.content.slice(0, 300)}`)
    .join("\n");

  const userPrompt = `Conversation history:\n${historyText}\n\nUser's latest query: ${rawQuery}`;
  const timeoutSignal = AbortSignal.timeout(REWRITE_TIMEOUT_MS);

  if (isDeepSeekAvailable()) {
    try {
      const response = await chatWithDeepSeek({
        messages: [
          { role: "system", content: REWRITE_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        maxTokens: 60,
        temperature: 0,
        signal: timeoutSignal,
      });

      const rewritten = response?.content?.trim();
      const isInvalid = !rewritten || rewritten.length < 4 || rewritten.toLowerCase().includes("no response") || rewritten.toLowerCase().includes("error");
      if (!isInvalid) {
        console.log(`[QueryRewriter] "${rawQuery.slice(0, 60)}" → "${rewritten}"`);
        return rewritten;
      }
    } catch (err) {
      console.warn(`[QueryRewriter] AI rewrite timed out/failed (${err instanceof Error ? err.message : String(err)}), using local topic fallback.`);
    }
  }

  // Fallback on timeout or API unavailability: local topic extraction (0ms)
  const localFallback = extractLocalTopicKeywords(rawQuery, history);
  console.log(`[QueryRewriter:LocalFallback] "${rawQuery.slice(0, 60)}" → "${localFallback}"`);
  return localFallback;
}
