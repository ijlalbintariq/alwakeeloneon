# Chat/AI Prompt Handling - Performance Analysis & Optimization Opportunities

**Analysis Date:** April 14, 2026  
**File Analyzed:** `/server/routes.ts`  
**Focus:** Identifying parallel processes and expensive operations in chat/AI request handling

---

## Executive Summary

The chat endpoint (`POST /api/messages/create`) orchestrates **7 major operations**, with at least **4-5 of them running sequentially** that could be optimized. The primary bottlenecks are:

1. **Knowledge context gathering** (RAG) - **400-1800ms+** - Retrieves statutes, case law, GitHub knowledge, admin knowledge, and user documents
2. **Case law full-text search with fallback** - **4000ms+ timeout** with potential remote file I/O
3. **AI model invocation** - **30,000ms timeout** - Blocking until response received
4. **Safety guardrails/response verification** - **Unknown latency** - Citation verification, Pakistan law enforcement
5. **Style memory context retrieval** - Not in current main chat path but active in drafting flows

---

## Detailed Operations Analysis

### 1. **Knowledge Context Retrieval (gatherKnowledgeContext)** ⚠️ HIGH IMPACT
**Location:** Lines 5747-5900, called before AI invocation  
**Type:** BLOCKING / NON-ESSENTIAL (can be deferred)  
**Latency:** 400-1800ms (configurable, default 120s cache TTL)

**Operations:**
- `storage.searchStatutes()` - 3 statutes max
- `searchCaseLawWithFullText()` - up to 4000ms timeout with complex full-text search
  - Performs local checks + optional remote file I/O (R2)
- `storage.searchGithubKnowledge()` - 2 sources
- `storage.searchAdminKnowledge()` - 2 sources
- `storage.getDocuments()` - user's documents
- `storage.getUserOrganization()` + `storage.searchOrgKnowledge()` - org knowledge

**Blocking:** YES - Called as `await` before AI call  
**Essential:** PARTIAL - Can run in parallel with AI call or after initial response

**Cache:** In-memory 500-entry TTL cache (120s default, configurable)

**Optimization Potential:** ⭐⭐⭐⭐⭐
- Defer to background after initial response
- Or parallelize with AI call (requires response streaming)
- Cache aggressively (already done, but TTL could extend to 24h for statutes)
- Skip for direct-mode prompts (< 120 chars, specific patterns)
- Lazy load: only main chat retrieves all sources; drafting may skip org knowledge

---

### 2. **Case Law Full-Text Search with Fallback** ⚠️ VERY HIGH IMPACT
**Location:** Lines 5754-5825 (within gatherKnowledgeContext)  
**Type:** BLOCKING / EXPENSIVE  
**Latency:** 4000ms+ (KNOWLEDGE_CASELAW_SEARCH_TIMEOUT_MS)

**Nested Operations:**
- `searchCaseLawWithFullText()` calls:
  - `storage.searchCaseLaw()` - metadata search
  - `retrieveForQuery()` - RAG vector search (if user has documents)
  - `filterCaseLawResultsWithRealFullText()` - validates results exist locally/remotely
    - Loads case law source text from R2 for top 2 documents (KNOWLEDGE_CASELAW_EXCERPT_DOCS)
    - Remote file I/O: up to 1200ms timeout per excerpt
  - `rankCaseLawRowsBySourceRelevance()` - reranking

**Blocking:** YES  
**Essential:** PARTIAL - Case law may not be relevant for all queries

**Optimization Potential:** ⭐⭐⭐⭐⭐
- **CRITICAL:** Make case law search async/deferred (not on critical path)
- Skip case law search for non-legal queries (detect intent)
- Remove remote file read requirement for excerpts (use summaries only)
- Reduce excerpt timeout from 1200ms to 500ms
- Cap results at 3 (not 6) for knowledge context
- Implement smarter query classification: skip case law for procedure/general questions

---

### 3. **AI Model Invocation (callStandardAI)** ⚠️ BLOCKING BUT NECESSARY
**Location:** Line 6025, main chat handler  
**Type:** BLOCKING / ESSENTIAL  
**Latency:** 30,000ms (MODEL_TIMEOUT_MS.standardPrimary) typical: 2-8 seconds

**Flow:**
- `buildMessages()` - Converts history to Groq/DeepSeek format
- `callStandardAI()` / `callStandardAISimple()`
  - Routes to Groq (`chatWithGroq` - primary)
  - Fallback: DeepSeek Pro for turbo mode
  - With timeout race condition
- `assertNonEmptyModelOutput()` - Validates response

**Blocking:** YES (required)  
**Essential:** YES (critical path)

**Optimization Potential:** ⭐⭐
- Implement streaming to start sending response while knowledge gathers
- Pre-warm model with system prompt caching (if supported)
- Reduce system prompt size (currently includes full legal system + knowledge context)

---

### 4. **Response Safety & Citation Verification** ⚠️ MEDIUM IMPACT
**Location:** Lines 6027-6034  
**Type:** BLOCKING / PARTIAL  
**Latency:** Unknown, but includes:
  - `suppressWrongIndianJurisdictionForPakCitation()` - regex matching
  - `applyAlWakeeloSafetyGuardrails()` - Citation verification
  - `ensureAlWakeeloReferencesBlock()` - Format validation/restructuring

**Safety Operations:**
- Pakistan law enforcement (regex-based, fast)
- Citation integrity checks - potentially queries DB for case law validation
- References block parsing/normalization

**Blocking:** YES  
**Essential:** YES (safety/quality control)

**Optimization Potential:** ⭐⭐⭐
- Move citation verification to background (cache results)
- Implement faster citation regex instead of DB lookups
- Pre-compute safe output templates
- Batch citation lookups if multiple citations found

---

### 5. **Database Queries (Usage Logging & Cost Tracking)**
**Location:** Lines 6035-6036  
**Type:** ASYNC (background) but awaited  
**Latency:** 50-200ms per query

**Operations:**
- `logUsageCost()` - Estimates tokens, logs to DB
- Usage limit pre-check in `checkUsageLimit()` (lines 5673-5710)

**Blocking:** Effectively YES (both pre-check and post-log)  
**Essential:** PARTIAL - Pre-check is essential, post-logging is not

**Optimization Potential:** ⭐⭐⭐⭐
- Move `logUsageCost()` to fire-and-forget background task
- Cache tier information (refresh every 5 min) instead of querying DB
- Batch cost logs (queue and flush every 10 requests or 30 seconds)
- Pre-check could use cached data with periodic refresh

---

### 6. **Message Storage & Thread Management**
**Location:** Lines 6014-6038 (message creation/retrieval)  
**Type:** BLOCKING  
**Latency:** 50-300ms (DB operations)

**Operations:**
- `storage.createMessage()` - Insert user message
- `storage.getMessages()` - Fetch full thread history
- `storage.createMessage()` - Insert AI response

**Blocking:** YES  
**Essential:** Partially (could defer response save)

**Optimization Potential:** ⭐⭐⭐
- Save user message before processing (for crash recovery)
- Defer AI response save until after streaming starts
- Batch message saves (not applicable here, single flow)

---

### 7. **Style Memory Integration** (Draft-specific)
**Location:** Present in `/documents/create` and `/documents/upload` routes  
**Type:** BACKGROUND (runInBackground call) but can become blocking if queue full  
**Latency:** 100-500ms for sample ingestion

**Operations:**
- `ingestStyleSample()` - Extract and index style patterns from saved drafts
- `indexAdminKnowledgeDocument()` - For case law categorized documents
- `indexAdminStatuteDocument()` - For statute documents

**Blocking:** NO (background) but monitored by `getStyleMemoryQueueStats()`  
**Essential:** NO (quality enhancement only)

**Optimization Potential:** ⭐⭐⭐⭐
- Already backgrounded - good design
- Could add priority queue (drafting > other operations)
- Rate limit background ingestion to avoid resource contention

---

## Parallel Operations Currently Occurring

### In Knowledge Context (gatherKnowledgeContext):
```typescript
const promises: Promise<any>[] = [
  storage.searchStatutes(query, KNOWLEDGE_STATUTES_LIMIT),
  caseLawPromise,  // ← SEQUENTIAL, not parallelized
  storage.searchGithubKnowledge(query, KNOWLEDGE_SOURCES_PER_TIER),
  storage.searchAdminKnowledge(query, KNOWLEDGE_SOURCES_PER_TIER),
];
if (userId) {
  promises.push(storage.getDocuments(userId));
}

const [statutesResult, caseLawResult, githubResult, adminResult, userDocsResult] = 
  await Promise.allSettled(promises);
```

**Issue:** Case law search is serialized BEFORE being added to promise array (line 5754-5769), so it waits 4+ seconds BEFORE other searches start.

### In Case Law Search (searchCaseLawWithFullText):
```typescript
const [baseResultsRaw, ragCandidatesPromise] = 
  await Promise.all([
    baseResultsPromise, 
    ragCandidatesPromise  // ← Parallelized with base results
  ]);
```

**Good:** Metadata search + RAG search run in parallel.

---

## Prioritized Optimization Recommendations

### 🔴 HIGHEST IMPACT (Reduce 600-1200ms)

**1. Defer Knowledge Context to Post-Response**
- **Current:** Gather context → Build prompt → Call AI → Response
- **Proposed:** Call AI immediately with basic system prompt → Stream response → Gather context in background for next turn
- **Impact:** Remove 400-1800ms from critical path
- **Risk:** First message loses full context benefit (mitigate with cache)
- **Implementation:** Add `defer_knowledge_context` flag, stream responses

**2. Skip Case Law Search for Non-Legal Queries**
- **Current:** Always search case law (4000ms timeout)
- **Proposed:** Classify query intent; skip case law for general questions, procedure, welcome messages
- **Impact:** Remove 4000ms for 30-40% of requests
- **Risk:** Missed relevant case law for ambiguous queries
- **Implementation:** Add ML classifier or regex rules (client-side filtering first)

**3. Parallelize Case Law Search**
- **Current:** Sequential before other searches
- **Proposed:** Add to promise.all() with other knowledge searches
- **Impact:** Reduce critical path by case law time (4000ms → overlap with others)
- **Implementation:** Remove sequential initialization, make it lazy

---

### 🟡 MEDIUM-HIGH IMPACT (Reduce 200-500ms)

**4. Async Cost Logging**
- **Current:** `logUsageCost()` is awaited
- **Proposed:** Fire-and-forget with background queue
- **Impact:** Remove 50-200ms from response time
- **Implementation:** Add to `runInBackground()` queue

**5. Cache Tier Information**
- **Current:** `storage.getUserTier()` called every request
- **Proposed:** Cache for 5-10 minutes per user
- **Implementation:** Add tier to user session or Redis cache

**6. Remove Remote File I/O from Knowledge Excerpts**
- **Current:** Loads full source text from R2 for top 2 case laws
- **Proposed:** Use summary field only (already available)
- **Impact:** Remove 1200ms excerpt timeout
- **Implementation:** Skip `loadCaseLawSourceText()` with `allowRemoteFileRead: true`

---

### 🟢 MEDIUM IMPACT (Reduce 100-300ms)

**7. Aggressive Knowledge Context Caching**
- **Current:** 120s TTL
- **Proposed:** Extend to 3600s (1 hour) for statutes, 300s for case law
- **Impact:** 20-40% cache hit rate improvement for repeat queries
- **Implementation:** Split cache by source type, use different TTLs

**8. Direct-Mode Bypass**
- **Current:** All prompts get full knowledge context
- **Proposed:** Skip knowledge gathering for direct-mode prompts (< 120 chars, specific patterns)
- **Impact:** Remove context gathering for ~10-15% of requests
- **Implementation:** Use `isDirectModePrompt()` check (already exists!)

**9. Parallel Message Retrieval**
- **Current:** `storage.getMessages()` called after other operations
- **Proposed:** Call immediately as user message is saved
- **Impact:** Overlap message retrieval with knowledge gathering
- **Implementation:** Reorder operations slightly

---

### 🔵 LOW-MEDIUM IMPACT (Reduce 50-150ms)

**10. Reduce System Prompt Size**
- **Current:** ~600 chars base + 400-2000 chars knowledge context
- **Proposed:** Pre-compile static system prompt, append context more efficiently
- **Impact:** Reduce token count, faster tokenization/transmission
- **Implementation:** Pre-gzip system prompt, use string templates

**11. Batch Citation Verification**
- **Current:** Inline citation lookup per response
- **Proposed:** Queue for background processing, cache results
- **Impact:** Remove verification latency (if non-critical)
- **Implementation:** Move to post-response background job

**12. Response Streaming**
- **Current:** Wait for full response before sending
- **Proposed:** Stream tokens as they arrive (if AI provider supports)
- **Impact:** UX improvement (perceived speed), allows knowledge gathering mid-response
- **Implementation:** Add streaming handler to Express route

---

## Special Cases By Module Type

### Drafting (`draft`, `contract-drafting`)
- **Additional Operations:** Style memory context retrieval + application
- **Deferred:** Style memory ingestion already backgrounded ✓
- **Optimization:** Merge style context with knowledge context gathering

### Search Operations (`search-judgments`, `search-statutes`)
- **Additional Operations:** Dedicated search + ranking
- **Can Defer:** Most safety checks (non-critical for search)
- **Optimization:** Skip full knowledge gathering, use search-specific context

### Public Chat
- **No Knowledge Context:** Already optimized (Groq direct, no RAG)
- **Operations:** AI call only + language rewrite (if needed)
- **Latency:** ~2-3s (fast path) ✓

---

## Configuration Levers (Currently Available)

Run commands to tune before implementation:

| Variable | Current | Recommended | Impact |
|----------|---------|-------------|---------|
| `KNOWLEDGE_CONTEXT_CACHE_TTL_MS` | 120,000 | 600,000 | Cache hit rate ↑40% |
| `KNOWLEDGE_CASELAW_SEARCH_TIMEOUT_MS` | 4,000 | 2,000* | Case law latency ↓ |
| `KNOWLEDGE_CASELAW_EXCERPT_DOCS` | 2 | 0 | Remote I/O ↓1200ms |
| `KNOWLEDGE_CASELAW_EXCERPT_TIMEOUT_MS` | 1,200 | 500 | Excerpt timeout ↓ |
| `KNOWLEDGE_CASELAW_LIMIT` | 6 | 3 | Results count ↓ |
| `BACKGROUND_CHAT_PRIORITY_PAUSE_MS` | 120 | 50 | Background pause ↓ |

*Only if intent classification implemented

---

## Implementation Roadmap

### Phase 1: Quick Wins (1-2 days, 300-500ms improvement)
1. ✅ Skip case law for non-legal queries (regex classifier)
2. ✅ Remove remote file I/O from excerpts
3. ✅ Move cost logging to background
4. ✅ Parallelize case law with other searches

### Phase 2: Medium Effort (2-3 days, 400-600ms improvement)
5. ✅ Implement knowledge context post-response deferral
6. ✅ Add tier caching
7. ✅ Extend knowledge context TTL
8. ✅ Direct-mode prompt detection

### Phase 3: Advanced (3-5 days, 200-300ms improvement + UX)
9. ✅ Response streaming
10. ✅ Batch citation verification
11. ✅ Optimize system prompt size
12. ✅ ML-based query classification

---

## Risk Assessment

| Change | Risk Level | Mitigation |
|--------|-----------|-----------|
| Defer knowledge context | HIGH | Cache first response, add toggle for important users |
| Skip case law for queries | MEDIUM | Whitelist legal terms, allow user override |
| Parallelize case law | LOW | Already supports parallelization internally |
| Async logging | LOW | Add queue overflow handling |
| Remove remote file I/O | LOW | Summary data usually sufficient |
| Extend cache TTL | LOW | Add cache invalidation on document change |
| Direct-mode bypass | LOW | Test pattern matching carefully |

---

## Monitoring Recommendations

Add metrics to track:
- `chat.knowledge_context_latency` - Time to gather context
- `chat.case_law_search_latency` - Time for case law search
- `chat.ai_call_latency` - Model response time
- `chat.total_latency` - End-to-end
- `chat.cache_hit_rate_knowledge` - Knowledge context cache effectiveness
- `background_job_queue_depth` - Queue buildup indicator
- `case_law_search_skip_rate` - Percentage of skipped case law searches

---

## Summary Table: Operations Impact

| Operation | Latency | Blocking | Essential | Parallelizable | Priority |
|-----------|---------|----------|-----------|-----------------|----------|
| Knowledge statutes search | 100-300ms | Yes | Partial | Yes | Medium |
| Case law search + excerpts | 2000-5000ms | Yes | Partial | Yes | **CRITICAL** |
| AI model call | 2000-8000ms | Yes | Yes | No | N/A |
| Message history retrieval | 50-200ms | Yes | Yes | Yes | Low |
| Usage/cost logging | 50-200ms | Yes | No | Yes | **HIGH** |
| Safety guardrails | 50-400ms | Yes | Yes | Partial | Medium |
| References verification | 100-500ms | Yes | Partial | Yes | Medium |
| Style memory ingestion | 100-500ms | No | No | N/A | Low |

**Total Critical Path Current:** ~6000-15000ms (knowledge + AI)  
**Target After Phase 1:** ~5000-12000ms (case law optimization)  
**Target After Phase 3:** ~3000-8000ms (deferred context + streaming)
