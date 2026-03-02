# AI Module Strategy

## Current Approach (Implemented)

The app uses prompt+routing specialization (not external training jobs) across three modules:

- `al-wakeelo`
- `draft`
- `contract-drafting`

Routing and behavior are defined in `server/ai-module-profiles.ts` and enforced in `/api/ai/chat`.

## Request/Response Contract

### Request
`POST /api/ai/chat` supports:

- `type`: `al-wakeelo | draft | contract-drafting`
- `moduleIntent` (optional):
  - `chat.general`
  - `draft.generateClause`
  - `draft.riskScan`
  - `contract.generateDraft`
  - `contract.clauseSuggest`
  - `contract.redline`

### Response
`POST /api/ai/chat` returns:

- `content`
- `model`
- `moduleProfile`
- `routingPath`

## Output Contracts

- `al-wakeelo`: references block is enforced.
- `draft` + drafting intent: plain drafting text is normalized.
- `contract-drafting`:
  - `contract.clauseSuggest` enforces strict JSON `{ "suggestions": [...] }`.
  - `contract.redline` enforces strict JSON `{ "edits": [...] }`.
  - If invalid, one repair retry is executed.

## Future True Fine-Tuning Path

To switch to true finetuned models later, keep the same module profile interface and provide
`externalModelId` per module. This allows rollout without frontend changes.

### Dataset Requirements (Recommended)

1. At least 2k-10k high-quality legal examples per module.
2. Separate datasets per module and intent class.
3. Pair each prompt with target output in production format.
4. Include difficult edge-cases and adversarial prompts.
5. Run legal QA review before training.

### Evaluation Requirements

1. Module-specific acceptance suites.
2. Structural-format pass rate (JSON/reference block).
3. Hallucination and citation-quality checks.
4. Regression checks against existing app behavior.
