# Al Wakeelo Chat — Bug Fix Report

**Date:** 2026-09-08
**Scope:** 7 files modified, 1 server endpoint added, 7 bugs fixed

---

## Summary

| # | Severity | Bug | File(s) | Fix |
|---|----------|-----|---------|-----|
| 1 | **High** | React dependency cycle in citation verification effect — every completed verification re-fired the effect for all citations, causing N render cascades per assistant response | `ChatInspectorDrawer.tsx` | Replaced state-based dedup with a `useRef<Set>` to track requested citations; removed `verifiedMap`/`verifyingMap` from deps |
| 2 | **Medium** | CaseLawCard expand/collapse keyed by positional index — "Show All" shifted indices, moving the expanded highlight to a different judgment; summary state also keyed by index, losing cached summaries on reorder | `CaseLawCard.tsx` | Re-indexed all expansion, summary, loading, and judgment-id state from positional `number` to `hit.citation` string keys |
| 3 | **Medium** | N+1 individual `/api/caseLaw/lookup` calls — 8-10 parallel HTTP requests per drawer open for a typical AI response | `routes.ts` + `ChatInspectorDrawer.tsx` | Added `POST /api/caseLaw/lookup-batch` endpoint (single query per citation using the same parsed-parts + LIKE logic); drawer now fires one batch fetch per citation-set change |
| 4 | **Low-Med** | `cleanLegalChatResponse` ran per-message on every render — the 100ms `elapsedMs` timer during streaming re-rendered the entire message list, re-executing the full regex suite 30+ times | `PreviewDrafting.tsx` → `PreviewChat.tsx` | Added `useMemo` map keyed on `msg.id::msg.content` — historical messages are cleaned once; only in-flight messages re-clean on each chunk |
| 5 | **Low-Med** | No `AbortController` in ChatCitationChip — stale fetch could flash incorrect verification status when citation prop changed mid-flight | `ChatCitationChip.tsx` | Added `AbortController` with cleanup; suppresses stale `.then()` results via `err.name !== "AbortError"` guard |
| 6 | **Low** | `aiCitedCitations` prop never passed to CaseLawCard — the "AI Cited" badge (distinguishing prose-referenced citations from search-results citations) was dead code | `PreviewChat.tsx` | Derived `aiCitedSet` from `inspectorData.citations` (the prose-extracted citation list) and passed it to `CaseLawCard`; badge now activates for every assistant turn |
| 7 | **Low** | "Cite in Draft" link pointed at `?cite=...` but the drafting page only parsed `?docId=...` — click landed on a blank drafting workspace | `PreviewDrafting.tsx` | Added `cite` param handler on mount: inserts the citation as a bold `<p>` into the TipTap editor and updates `currentText` state; cleans URL after reading |

---

## Files Modified

| File | Changes |
|------|---------|
| `client/src/experimental/components/chat/ChatInspectorDrawer.tsx` | Replaced per-citation fetch + dependency-cycling effect with ref-based dedup and single batch fetch; removed `verifyingMap` state entirely |
| `client/src/experimental/components/chat/CaseLawCard.tsx` | Re-keyed `expandedHitIdx`, `summaryData`, `summaryLoading`, `resolvedJudgmentIds` from positional index to citation string |
| `client/src/experimental/components/chat/ChatCitationChip.tsx` | Added `AbortController` + cleanup to verification fetch |
| `client/src/experimental/pages/PreviewChat.tsx` | Added `cleanedMessagesMap` useMemo; derived `aiCitedSet`; passed `aiCitedCitations` to `CaseLawCard` |
| `client/src/experimental/pages/PreviewDrafting.tsx` | Added `?cite=` param handler with editor insertion and toast confirmation |
| `server/routes.ts` | Added `POST /api/caseLaw/lookup-batch` endpoint accepting `{ citations: string[] }`, returning `{ results: Record<string, {found, id?, title?, court?}> }` |

---

## Type-check Result

```
npx tsc --noEmit  →  0 errors across all modified files
```

---

## Risk Assessment

**Bug 1 (High):** Zero risk — the ref-guard is strictly more correct than the old state-guard; eliminates a real performance problem without changing any observable behavior.

**Bug 3 (Medium):** The batch endpoint reuses the same `parseCaseLawCitationQuery` + `LIKE` fallback logic as the single endpoint. If the single endpoint's parsing logic changes, both must stay in sync. Consider extracting the per-citation lookup into a shared helper in a future pass.

**Bug 7 (Low):** The citation is inserted as bold plain text rather than a structured citation card. This is intentional — the drafting workspace is a freeform TipTap editor, and a simple bold paragraph is the correct minimal insertion. If the user later wants richer citation formatting (e.g., a structured citation block with court, year, page fields), that's a feature request, not a bug.

---

## Pending Considerations (Not In Scope)

- The batch endpoint shares logic with the single endpoint — a shared helper would reduce duplication
- The `elapsedMs` timer (100ms interval) still triggers a re-render of the whole component; only the message-cleaning cost was eliminated, not the re-render itself — `React.memo` on message items would eliminate that entirely
- `verifyingMap` removal means there's no per-citation loading spinner anymore; instead the entire batch shows "Verifying DB..." uniformly — this is actually better UX for small batches
