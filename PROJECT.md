# Project: Alwakeelo AI Legal Assistant Chat Engine Optimization

This project covers the optimization of the Alwakeelo chat engine to behave as a natural, conversational chat interface, avoiding overly verbose responses on simple or follow-up queries.

## Architecture
- **Knowledge Context Pipeline**: Fetches statutes, case law, and admin documents using `gatherKnowledgeContextV2` in `server/pipeline/knowledge-pipeline.ts`.
- **Query Complexity & Rewriting**: Handled in `server/pipeline/intent-classifier.ts` and `server/pipeline/query-rewriter.ts`.
- **API Endpoints**: non-streaming REST endpoints in `server/routes.ts` (`POST /api/threads` and `POST /api/threads/:threadId/messages`).
- **Core System Prompt**: `getLegalSystemPrompt` in `server/routes.ts` sets the identity and structural requirements for legal analysis.

## Milestones

| # | Name | Scope / Modules | Dependencies | Status | Conversation ID |
|---|------|-----------------|--------------|--------|-----------------|
| 1 | R1: Conversation History for RAG | Extract prior turns in REST endpoints and pass to knowledge pipeline | None | DONE | a9fba036-cb91-44ec-8cf1-af552fd9deb9 |
| 2 | R2: Complexity & Length Scaling | Query complexity detection and response length/word-count scaling | M1 | DONE | a9fba036-cb91-44ec-8cf1-af552fd9deb9 |
| 3 | R3: System Prompt Exceptions | Except simple/follow-up queries from mandatory issue mapping/legal tests | M2 | DONE | a9fba036-cb91-44ec-8cf1-af552fd9deb9 |
| 4 | Verification & Integration testing | Verify typescript compiles and all tests pass | M3 | DONE | a9fba036-cb91-44ec-8cf1-af552fd9deb9 |

## Interface Contracts
- **Thread Creation**: `/api/threads` (POST) requires `{ title?, firstMessage }`. Returns the created thread object.
- **Message Send**: `/api/threads/:threadId/messages` (POST) requires `{ message }`. Returns the saved assistant message.
- **Knowledge Context V2**: `gatherKnowledgeContextV2(query, userId, conversationHistory)` where `conversationHistory` is `ConversationTurn[]`.

## Code Layout
- `server/routes.ts`: Defines the API endpoints and the system prompt.
- `server/pipeline/knowledge-pipeline.ts`: Orchestrates the RAG retrieval pipeline.
- `server/pipeline/intent-classifier.ts`: Contains intent/complexity classification rules.
- `server/pipeline/query-rewriter.ts`: Rewrites follow-up queries using context history.
