# Production RAG Specification (Legal App)

## 1) Objectives
- Implement full Retrieval-Augmented Generation (RAG) for uploaded legal documents.
- Keep external API cost flat (no increase) by using local embeddings.
- Use LLM only for answer synthesis with:
  - Primary: Groq
  - Fallback: OpenRouter
- Enforce context-grounded answers with citations to reduce hallucinations.

## 2) Cost Constraint (No API Cost Increase)
### Decision
- Embeddings run locally (CPU/GPU) in app worker, not via paid embedding API.
- Recommended embedding model: `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` (384-dim, multilingual, lightweight).

### Why this model
- Handles English + Urdu better than English-only small models.
- Low runtime cost and sufficient quality for legal chunk retrieval.

### New env
- `RAG_EMBEDDING_PROVIDER=local`
- `RAG_EMBEDDING_MODEL=sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`
- `RAG_EMBEDDING_DIM=384`
- `RAG_TOP_K=5`
- `RAG_MIN_SCORE=0.62`
- `RAG_MAX_CONTEXT_CHUNKS=5`
- `RAG_FORCE_CONTEXT=true`

## 3) Scope
### In scope
1. Parse and clean uploaded PDFs.
2. Chunk at 700 tokens with 120 overlap.
3. Generate local embeddings.
4. Store vectors in Supabase Postgres with pgvector.
5. Top-5 similarity retrieval.
6. LLM generation using retrieved context.
7. Hallucination control.
8. Citation metadata in response.
9. Admin delete vectors per document.
10. Token usage logging.

### Out of scope
- Cross-document legal web search.
- Fine-tuning LLMs.
- OCR on images not containing selectable text (phase-2 optional).

## 4) Security and Multi-Tenant Rules
1. All vector rows must include `user_id` and optional `org_id`.
2. Retrieval query must filter by same `user_id` (and `org_id` when organization mode enabled).
3. Supabase RLS must deny cross-tenant reads/deletes.
4. Admin delete must be audited (`admin.rag.deleteVectors`).

## 5) Database Design (Supabase + pgvector)

```sql
create extension if not exists vector;

create table if not exists rag_documents (
  id bigserial primary key,
  user_id text not null,
  org_id bigint null,
  source_document_id bigint not null,
  title text not null,
  file_name text,
  mime_type text,
  content_hash text not null,
  status text not null default 'pending', -- pending|indexed|failed
  chunk_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_rag_documents_user_source
  on rag_documents (user_id, source_document_id);

create table if not exists rag_chunks (
  id bigserial primary key,
  rag_document_id bigint not null references rag_documents(id) on delete cascade,
  user_id text not null,
  org_id bigint null,
  chunk_index int not null,
  page_start int,
  page_end int,
  token_count int not null,
  chunk_text text not null,
  metadata jsonb not null default '{}'::jsonb,
  embedding vector(384) not null,
  created_at timestamptz not null default now()
);

create unique index if not exists uq_rag_chunks_doc_chunk
  on rag_chunks (rag_document_id, chunk_index);

-- cosine distance index
create index if not exists idx_rag_chunks_embedding_cosine
  on rag_chunks using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create index if not exists idx_rag_chunks_user
  on rag_chunks (user_id, rag_document_id);
```

### RLS policy baseline
- `select/delete` allowed only when `user_id = auth.uid()::text` (or authorized org member in org mode).

## 6) Document Pipeline

## 6.1 Parse + Clean (PDF)
1. Extract text page-by-page.
2. Normalize whitespace.
3. Remove repeated headers/footers (frequency-based line stripping).
4. Keep page markers in metadata.
5. Preserve section symbols, numbering, and citations.

## 6.2 Chunking
- Tokenizer: `cl100k_base` via `@dqbd/tiktoken`.
- Chunk size: 700 tokens.
- Overlap: 120 tokens.
- Max chunk chars safeguard: 4500 chars.
- Skip chunks under 80 tokens unless final trailing chunk.

## 6.3 Embedding
- Embed each chunk locally.
- L2 normalize vector before insert.
- Batch size: 32 (configurable).

## 6.4 Re-index behavior
- On document re-upload/content hash change:
  1. Delete existing `rag_chunks` for that `source_document_id`.
  2. Rebuild chunks/embeddings.
  3. Update `rag_documents.status` and `chunk_count`.

## 7) Retrieval
1. Embed user query locally.
2. Retrieve top-5 by cosine similarity with tenant filter.
3. Apply min-score threshold (`RAG_MIN_SCORE`).
4. If fewer than 2 chunks above threshold, mark retrieval confidence low.

### Retrieval confidence
- `high`: top1 >= 0.72 and top5 avg >= 0.66
- `medium`: top1 >= 0.66
- `low`: otherwise

## 8) Generation Layer (Groq default, OpenRouter fallback)

## 8.1 Prompt policy (strict)
System instruction must enforce:
1. Use only retrieved context for factual claims.
2. If context insufficient: say exactly what is missing.
3. Never fabricate case law/statutory text.
4. Return citations for each material point.

## 8.2 Fallback rule
- If Groq fails/timeout, call OpenRouter with same prompt + same context.
- If retrieval confidence is low and `RAG_FORCE_CONTEXT=true`, do not answer substantively; return clarification request.

## 8.3 Response schema
```json
{
  "answer": "string",
  "confidence": "high|medium|low",
  "citations": [
    {
      "documentId": 123,
      "sourceDocumentId": 456,
      "title": "Lease Agreement",
      "chunkIndex": 7,
      "pageStart": 3,
      "pageEnd": 3,
      "score": 0.78,
      "quote": "short supporting excerpt"
    }
  ],
  "retrieval": {
    "topK": 5,
    "matched": 4,
    "threshold": 0.62
  },
  "model": {
    "provider": "groq|openrouter",
    "name": "model-id"
  }
}
```

## 9) API Contracts

## 9.1 Index document
`POST /api/rag/index-document`

Request:
```json
{ "documentId": 456 }
```
Response:
```json
{ "ok": true, "ragDocumentId": 123, "chunks": 41, "status": "indexed" }
```

## 9.2 Ask RAG
`POST /api/rag/ask`

Request:
```json
{
  "query": "What is the termination notice period?",
  "documentIds": [456],
  "mode": "strict"
}
```
Response: schema in section 8.3.

## 9.3 Admin delete vectors per document
`DELETE /api/rag/documents/:documentId/vectors`

Response:
```json
{ "ok": true, "deletedChunks": 41 }
```

## 9.4 Reindex all user docs (optional)
`POST /api/rag/reindex`
```json
{ "limit": 20 }
```

## 10) Token and Cost Logging

Use existing `usage_tracking` table with new features:
- `rag_retrieve` (input/output tokens = 0, estimatedCost = 0)
- `rag_answer`

For `rag_answer`:
1. Log prompt tokens and completion tokens from Groq/OpenRouter response usage.
2. Log model name/provider.
3. Keep monthly usage aggregation unchanged.

If schema enum is restrictive, extend allowed feature values in `shared/schema.ts`.

## 11) Folder Structure Changes

```
server/
  rag/
    pdf-parser.ts
    text-cleaner.ts
    tokenizer.ts
    chunker.ts
    embedding-local.ts
    vector-store.ts
    retrieval.ts
    prompt-policy.ts
    rag-service.ts
  routes-rag.ts
shared/
  rag-types.ts
tests/
  unit/
    rag-chunker.test.ts
    rag-retrieval.test.ts
    rag-prompt-guard.test.ts
  api/
    rag-api.test.ts
```

## 12) Implementation Order
1. DB migration (rag tables + indexes + RLS).
2. Local embedding module.
3. PDF parse/clean/chunk pipeline.
4. Index endpoint.
5. Retrieval endpoint.
6. Ask endpoint with Groq/OpenRouter fallback.
7. Admin vector delete endpoint.
8. Usage logging integration.
9. Test suite + load/perf checks.

## 13) Acceptance Criteria
1. Uploaded PDF becomes indexed with chunk count > 0.
2. RAG query returns top-5 matches with citations.
3. If no strong context, answer refuses speculation.
4. Admin delete removes all vectors for selected document.
5. Token usage logs appear in existing usage analytics.
6. External API cost does not increase from embeddings (local-only embedding path).

## 14) QA Checklist (20-minute run)
1. Upload one contract PDF and index it.
2. Ask clause-specific question; verify quoted citation chunk and page.
3. Ask unrelated question; verify refusal/clarification (no hallucinated facts).
4. Force Groq failure (invalid key) and verify OpenRouter fallback.
5. Delete vectors for document and verify retrieval returns zero matches.
6. Check usage dashboard for `rag_answer` token entry.

## 15) Known Risks and Mitigation
1. OCR-heavy scanned PDFs may fail extraction.
   - Mitigation: add OCR fallback queue in phase-2.
2. Urdu legal text quality may vary with small embedding model.
   - Mitigation: upgrade to multilingual larger local model if needed.
3. pgvector recall with ivfflat depends on tuning.
   - Mitigation: tune `lists` and run periodic `ANALYZE`.
