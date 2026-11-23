# AI-led intent routing — 23 November 2026

Family-maintenance questions could retrieve revenue cases because keyword routing confused financial means with tax, AI-generated domains did not control retrieval topics, and fallback searches and citation verification could admit off-topic database records.

## Changes

- Natural-language requests now use the configured structured research model to identify the substantive topic, requested output and procedural context. One bounded call also resolves follow-ups using the initial request, recent user turns and supplied attachment text. Exact citation and section lookups retain a local path.
- Model output is validated against the existing topic IDs, an explicit other-legal category, request types and requested operations. Accepted classifications replace topics and search terms together and recalculate retrieval flags, preserving module restrictions. Malformed, unavailable or low-confidence classification produces a clarification instruction and no case-law results.
- The provider request has an abort signal with a four-second deadline and retries disabled. This is a deadline, not a measured latency promise. The old sequential follow-up rewrite is no longer invoked by this pipeline when semantic classification is enabled.
- Retrieved cases and fallback tool results undergo a bounded AI relevance review against the resolved issue and remedy. The reviewer can select only supplied indices, cannot invent a case identity, and must supply complete, unique decisions. Missing, malformed, low-confidence or failed decisions withhold candidates. Shared vocabulary, reporter labels and even the same broad family-law topic do not establish relevance. Keyword scores may rank candidates but cannot veto semantically classified candidates before review.
- Chat, MCP case search, MCP/REST statute search and Vault use the same async query resolver. Vault passes conversation history and reuses its prepared interpretation rather than paying for a duplicate classification. Translation and summarization do not trigger a new precedent search. Unfamiliar clear legal issues can use other-legal rather than being forced into an unrelated topic.
- Main chat, Apex and both drafting fallback searches apply the same relevance review. Prompt add-ons depend on resolved topics instead of relationship words in raw requests. These routes no longer demand a minimum of three citations. Temporary review failures are distinguished from an empty database result and are not cached.
- Main chat and Apex paths use the same resolved query and intent for fallback results. Current attachment context is passed into main chat classification. Cache identity includes the initial request and supplied source context; cached results retain their intent and resolved query.
- An explicitly supplied citation pool is authoritative even when empty or smaller than five entries. Off-pool citations cannot be restored merely because a matching citation exists elsewhere in the database. Protected reference blocks are filtered too. Honest no-results notices are preserved.
- Chat prompts no longer demand a minimum of three cases. A single relevant case is acceptable; missing coverage must not be filled with unrelated precedents.
- Earlier uncommitted family-writ/history fixes were preserved and extended. Existing graph export changes were not modified by this implementation.

## Verification

**138 focused tests pass.** TypeScript and the client/server build pass. Tests cover the family writ, wife/tax and husband/employment counterexamples; follow-ups and explicit topic changes; unknown subjects; translate/summarize operations; schema rejection; duplicate, incomplete and out-of-range relevance decisions; authoritative empty/small citation pools; reference-block filtering; actual pipeline/retrieval functions and MCP/Vault handlers with controlled dependencies; and existing source identity, repaired-index, citation and drafting regressions.

Tests use `script/no_paid_network.ts`, empty database configuration and a dummy provider key. Provider replies are mocked. They verify routing and enforcement, not actual model classification quality. No paid requests, re-embedding or production database changes were made. Logs: `/tmp/alwakeelo-intent-unification-regression.log`, `/tmp/alwakeelo-intent-unification-check.log`, `/tmp/alwakeelo-intent-unification-build.log`.

## Limits and operating behavior

The configured model still has ordinary inference costs when real users make semantic requests. Short natural-language requests that previously stayed local now require classification. `USE_LLM_QUERY_EXTRACTOR=false` now disables natural-language retrieval safely; it does not silently restore keyword-only classification. Exact citation and section parsing still works. Case candidates add one bounded relevance-model request, including fallback candidates when a fallback search runs. This adds inference cost and latency in real use. Existing provider/model configuration is reused; no new dependency or embedding migration is required.

The confidence threshold is an acceptance rule, not a calibrated accuracy percentage. Initial context, recent turns and document facts have explicit character limits. Missing facts or service failures should produce clarification rather than guessed precedents. The AI relevance check is conservative and may withhold valid cases with inadequate summaries. A positive model decision is not legal authentication or proof of every factual detail or requested remedy.

No live provider latency benchmark, authenticated production chat, independent case-source authentication or full-database quality measurement was performed. Generated text can still contain reasoning errors; regression tests do not establish a bug-free or hallucination-free system. Raw provisional streaming text is not a verified final answer. Deployment and representative live evaluation remain separate verification steps.
