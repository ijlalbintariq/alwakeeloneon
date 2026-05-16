/**
 * Query Refiner — Rewrites casual user queries into structured legal prompts
 *
 * Runs BEFORE the main AI response generation. Takes the user's raw input
 * and produces a precise, legally-structured version that the main AI uses
 * to generate a higher-quality response.
 *
 * Design:
 *  - Uses deepseek-chat with low tokens (fast, cheap)
 *  - 3-second hard timeout — fails gracefully to original query
 *  - Runs in parallel with enrichment tasks (zero added latency)
 */

import { chatWithDeepSeek, isDeepSeekAvailable } from "./deepseek-ai";

const REFINE_SYSTEM_PROMPT = `You are a Pakistani legal query optimizer for the Al Wakeelo AI legal assistant. Your ONLY job is to rewrite the user's casual legal question into a precise, structured legal query.

RULES:
1. Identify the exact legal issue, relevant Pakistani statute(s), and jurisdiction
2. Use proper Pakistani legal terminology (CPC, PPC, CrPC, MFLO, Order VIII Rule 6A, etc.)
3. Expand vague references into specific legal concepts with statute names
4. Preserve the user's ORIGINAL INTENT — do NOT change their question or add new issues
5. Keep it under 120 words — this is a refined query, not an essay
6. If the query mentions a specific section/statute, expand it with full name and context
7. If the query is already well-formed legal language, improve it only slightly
8. For greetings or non-legal queries, return the query exactly as-is
9. Add relevant legal angles the user may not have considered (e.g., remedies, applicable orders)
10. Always frame it as a question or request, matching the user's original intent

OUTPUT: Return ONLY the refined query text. No preamble, no explanation, no quotes, no labels.

EXAMPLES:

Input: "my counter suit has been decreed but the court did not decide my case. Is it legally correct when there are counter suits?"
Output: Under the Code of Civil Procedure 1908, when a defendant files a counter-claim under Order VIII Rule 6A CPC alongside the plaintiff's original suit, is it legally permissible for the court to decree the counter-claim while leaving the original suit undecided? What are the procedural requirements for simultaneous adjudication of cross-suits under Order VIII Rules 6A-6G CPC, and what remedies (appeal under Section 96 CPC or review under Section 114 CPC) are available to the plaintiff whose suit was not adjudicated?

Input: "can police arrest without warrant"
Output: Under Section 54 of the Code of Criminal Procedure 1898 (CrPC), what are the circumstances under which a police officer may arrest a person without a warrant in Pakistan? What are the constitutional safeguards under Article 10 of the Constitution of Pakistan 1973 regarding arrest, and what remedies are available to a person unlawfully arrested without warrant?

Input: "what happens if tenant doesn't pay rent"
Output: Under the Punjab Rented Premises Act 2009 (or applicable provincial rent law), what legal remedies are available to a landlord when a tenant defaults on rent payment? What is the procedure for filing an eviction petition before the Rent Tribunal under Section 15, and can the landlord claim arrears of rent along with ejectment? What are the tenant's rights and defenses under the Act?`;

interface RefineResult {
  refined: string;
  wasRefined: boolean;
  elapsedMs: number;
}

/**
 * Refine a user query into a structured legal prompt.
 *
 * @param rawQuery - The user's original query text
 * @param priorTurns - Optional conversation history for context
 * @param timeoutMs - Hard timeout (default 3000ms)
 * @returns The refined query, or the original if refinement fails/times out
 */
export async function refineUserQuery(
  rawQuery: string,
  priorTurns?: Array<{ role: string; content: string }>,
  timeoutMs = 3000,
): Promise<RefineResult> {
  const startMs = Date.now();
  const fallback: RefineResult = { refined: rawQuery, wasRefined: false, elapsedMs: 0 };

  // Safety: skip empty/very short queries
  if (!rawQuery || rawQuery.trim().length < 3) {
    return { ...fallback, elapsedMs: Date.now() - startMs };
  }

  // Must have DeepSeek configured
  if (!isDeepSeekAvailable()) {
    console.warn("[QueryRefine] DeepSeek not available, skipping refinement");
    return { ...fallback, elapsedMs: Date.now() - startMs };
  }

  // Build messages — include prior conversation context if available
  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: REFINE_SYSTEM_PROMPT },
  ];

  // Add last 2 conversation turns for context (if any)
  if (priorTurns && priorTurns.length > 0) {
    const recentTurns = priorTurns.slice(-4); // last 2 exchanges
    for (const turn of recentTurns) {
      if (turn.role === "user" || turn.role === "assistant") {
        messages.push({
          role: turn.role as "user" | "assistant",
          content: turn.content.slice(0, 500), // truncate for token efficiency
        });
      }
    }
    messages.push({
      role: "user",
      content: `Refine this follow-up query (consider the conversation above):\n${rawQuery}`,
    });
  } else {
    messages.push({
      role: "user",
      content: rawQuery,
    });
  }

  // Race against timeout
  const abortController = new AbortController();
  const timer = setTimeout(() => abortController.abort(), timeoutMs);

  try {
    const result = await chatWithDeepSeek({
      messages,
      maxTokens: 250,
      temperature: 0.1,
      signal: abortController.signal,
    });

    clearTimeout(timer);

    const refined = (result.content || "").trim();
    const elapsedMs = Date.now() - startMs;

    // Sanity checks: reject if AI returned garbage
    if (!refined || refined.length < 5) {
      console.warn("[QueryRefine] Empty or too-short refinement, using original");
      return { refined: rawQuery, wasRefined: false, elapsedMs };
    }

    // If the refined version is essentially identical, mark as not refined
    if (normalizeForComparison(refined) === normalizeForComparison(rawQuery)) {
      return { refined: rawQuery, wasRefined: false, elapsedMs };
    }

    console.log(
      `[QueryRefine] Refined in ${elapsedMs}ms: "${rawQuery.slice(0, 60)}..." → "${refined.slice(0, 80)}..."`,
    );

    return { refined, wasRefined: true, elapsedMs };
  } catch (err: any) {
    clearTimeout(timer);
    const elapsedMs = Date.now() - startMs;

    if (err?.name === "AbortError" || err?.message?.includes("aborted")) {
      console.warn(`[QueryRefine] Timed out after ${elapsedMs}ms, using original query`);
    } else {
      console.warn(`[QueryRefine] Failed after ${elapsedMs}ms:`, err?.message || err);
    }

    return { refined: rawQuery, wasRefined: false, elapsedMs };
  }
}

function normalizeForComparison(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
}
