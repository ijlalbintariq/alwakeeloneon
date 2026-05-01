/**
 * Query Rewriter
 *
 * Responsibility: Resolve pronouns and vague references in follow-up queries
 *                 so the retrieval pipeline gets a self-contained search phrase.
 *
 * Examples:
 *   Prior: "Tell me about bail in narcotics cases"
 *   Input: "What about the punishment?"
 *   Output: "punishment for narcotics offences under CNSA Section 9"
 *
 *   Prior: "Explain Section 302 PPC"
 *   Input: "Is it bailable?"
 *   Output: "bail Section 302 PPC murder"
 *
 * Design rules:
 *   - Only fires when a vague reference is detected (regex check, <1ms)
 *   - Uses deepseek-chat: fast (~300ms), cheap (~60 output tokens)
 *   - Failure mode: returns rawQuery unchanged — never blocks retrieval
 *   - 2-second timeout to avoid slowing the pipeline
 */

import { chatWithDeepSeek } from "../deepseek-ai";
import { isDeepSeekAvailable } from "../deepseek-ai";

// Patterns that signal the current query refers to something from prior context.
const VAGUE_REFERENCE_RE = /\b(it|its|that|this|the case|the section|the same|the above|the punishment|the penalty|the offence|what about|and also|and what|how about|applicable here|apply here|related to that|regarding that|regarding this)\b/i;

// Starters that are obviously a follow-up even without a pronoun.
const FOLLOWUP_STARTER_RE = /^(what about|how about|and |but |so |then |also |why |what if|does it|is it|are they|can it|can they|give more|more case law|more cases|any more)\b/i;

const REWRITE_TIMEOUT_MS = 2000;

const REWRITE_SYSTEM_PROMPT = `You are a legal search query normalizer for Pakistani law.

Given a short conversation history and the user's latest message, rewrite the query
into a self-contained search phrase of 4-10 words suitable for a legal database search.

Rules:
- Replace pronouns and vague references with the actual legal topic from history.
- Keep all legal terms exact: PPC, CNSA, Article 199, SCMR, bail, qatl, diyat, etc.
- Remove filler words: "can you tell me", "what about", "I want to know".
- Output ONLY the rewritten query — no explanation, no punctuation at the end.
- If the query is already self-contained, return it unchanged.
- Maximum 10 words.`;

export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
}

/**
 * Detect whether the current query needs rewriting based on context.
 * Pure function — no I/O.
 */
export function needsRewrite(rawQuery: string, hasPriorTurns: boolean): boolean {
  if (!hasPriorTurns) return false;
  if (rawQuery.trim().length > 180) return false; // long query is likely self-contained
  return VAGUE_REFERENCE_RE.test(rawQuery) || FOLLOWUP_STARTER_RE.test(rawQuery.trim());
}

/**
 * Rewrite a follow-up query into a self-contained retrieval phrase.
 * Returns rawQuery on any failure (timeout, API error, empty result).
 */
export async function rewriteFollowUpQuery(
  rawQuery: string,
  history: ConversationTurn[],
): Promise<string> {
  if (!isDeepSeekAvailable()) return rawQuery;
  if (!needsRewrite(rawQuery, history.length > 0)) return rawQuery;

  // Take last 3 turns (≈ 1.5 exchanges) — enough context, cheap on tokens.
  const recentTurns = history.slice(-3);
  const historyText = recentTurns
    .map((m) => `${m.role === "user" ? "User" : "AI"}: ${m.content.slice(0, 250)}`)
    .join("\n");

  const userPrompt = `Conversation history:\n${historyText}\n\nUser's latest query: ${rawQuery}`;

  const timeoutSignal = AbortSignal.timeout(REWRITE_TIMEOUT_MS);

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
    if (!rewritten || rewritten.length < 4) return rawQuery;

    console.log(`[QueryRewriter] "${rawQuery.slice(0, 60)}" → "${rewritten}"`);
    return rewritten;
  } catch (err) {
    // Timeout or API error — fail silently, use original
    return rawQuery;
  }
}
