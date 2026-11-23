# AI-led intent routing — 23 November 2026

Family-maintenance questions could retrieve revenue cases because keyword routing confused financial means with tax, AI-generated domains did not control retrieval topics, and fallback searches and citation verification could admit off-topic database records.

## Changes

- Natural-language requests now use the configured structured research model to identify the substantive topic, requested output and procedural context. One bounded call also resolves follow-ups using the initial request, recent user turns and supplied attachment text. Exact citation and section lookups retain a local path.
- Model output is validated against the existing topic IDs and request types. Accepted classifications replace topics and search terms together and recalculate retrieval flags, preserving module restrictions. Malformed, unavailable or low-confidence classification produces a clarification instruction and no case-law results.
- The provider request has an abort signal with a four-second deadline and retries disabled. This is a deadline, not a measured latency promise. The old sequential follow-up rewrite is no longer invoked by this pipeline when semantic classification is enabled.
- Retrieval results and fallback tool results must support the selected topic. Family-law results require substantive family-law evidence; reporter identity or matching financial vocabulary alone does not establish relevance. The existing tax/employment counterexamples no longer receive unconditional family promotion in the local fallback.
- Main chat and Apex paths use the same resolved query and intent for fallback results. Current attachment context is passed into main chat classification. Cache identity includes the initial request and supplied source context; cached results retain their intent and resolved query.
- An explicitly supplied citation pool is authoritative even when empty or smaller than five entries. Off-pool citations cannot be restored merely because a matching citation exists elsewhere in the database. Protected reference blocks are filtered too. Honest no-results notices are preserved.
- Chat prompts no longer demand a minimum of three cases. A single relevant case is acceptable; missing coverage must not be filled with unrelated precedents.
- Earlier uncommitted family-writ/history fixes were preserved and extended. Existing graph export changes were not modified by this implementation.

## Verification

**111 focused tests pass:** 84 routing, retrieval and citation-pool checks, plus 27 citation-scrubbing, cross-module and judgment-integrity regressions. TypeScript and the client/server build pass. Tests include the reported family writ, wife/tax and husband/employment counterexamples, valid family sources, schema rejection, one mocked provider request, authoritative empty/small citation pools, reference-block filtering and the actual pipeline/retrieval flow with controlled dependencies.

Tests use `script/no_paid_network.ts`, empty database configuration and a dummy provider key. Provider replies are mocked. No paid model requests or production database repairs were made. Logs: `/tmp/alwakeelo-semantic-tests.log`, `/tmp/alwakeelo-semantic-extra-tests.log`, `/tmp/alwakeelo-semantic-typecheck.log`, `/tmp/alwakeelo-semantic-build.log`.

## Limits and operating behavior

The configured model still has ordinary inference costs when real users make semantic requests. Short natural-language requests that previously stayed local now require classification. `USE_LLM_QUERY_EXTRACTOR=false` remains an explicit local-mode opt-out; the AI-led behavior requires this not to be disabled.

The confidence threshold is an acceptance rule, not a calibrated accuracy percentage. Initial context, recent turns and document facts have explicit character limits. Missing facts or service failures should produce clarification rather than guessed precedents. The topic evidence filter is conservative and may withhold valid cases with inadequate summaries; it does not establish that every surviving case matches every factual detail or requested remedy.

No live provider latency benchmark, authenticated production chat, independent case-source authentication or full-database quality measurement was performed. Generated text can still contain reasoning errors; regression tests do not establish a bug-free or hallucination-free system. Raw provisional streaming text is not a verified final answer. Deployment and representative live evaluation remain separate verification steps.
