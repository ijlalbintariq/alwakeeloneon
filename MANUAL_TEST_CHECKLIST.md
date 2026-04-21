# Manual Test Checklist - Citation Policy Fix

**Before Testing:** Ensure your deployment includes commit `e1de078` or later.

## Test Setup

1. Login to Al Wakeelo with test account
2. Navigate to Chat module
3. Open browser DevTools (F12) → Network tab (to inspect responses)
4. Keep browser console open for any errors

---

## Test Case 1: Multi-Statute Query ✅

**Module:** Al Wakeelo  
**Importance:** Critical - Tests statute citation visibility

### Query
```
What are the elements and punishment under Section 302 and Section 34 of the Pakistan Penal Code?
```

### Expected Results

- [ ] **Prose contains statute references:** Response body includes "Section 302" and "Section 34"
- [ ] **No `[]` artifacts:** Scan response for empty brackets `[]` - should find ZERO
- [ ] **No `****` artifacts:** Scan response for `****` - should find ZERO  
- [ ] **References block populated:** "Relevant Statutes" sidebar shows statute list
- [ ] **Response complete:** Message ends with proper conclusion (not truncated)
- [ ] **No toast errors:** No "communication disrupted" or timeout messages

### Pass/Fail
- ✅ PASS if all items checked
- ❌ FAIL if any item unchecked

---

## Test Case 2: Case Law + Statute Query ✅

**Module:** Al Wakeelo  
**Importance:** Critical - Tests case citation + artifact cleanup

### Query
```
What did PLD 2020 SC 456 say about Section 302 PPC? Cite the judgment and explain the legal principle.
```

### Expected Results

- [ ] **Case citation visible:** "PLD 2020 SC 456" appears in response prose
- [ ] **Statute visible:** "Section 302 PPC" appears in response prose
- [ ] **NO orphan brackets:** Scan for `[]` followed by nothing - should be ZERO
- [ ] **NO orphan asterisks:** Scan for `****` or `*** ` - should be ZERO
- [ ] **Legal Citations panel populated:** Right sidebar shows case with citation + court
- [ ] **Response flows naturally:** Prose reads smoothly without missing words
- [ ] **Full response:** Not cut off (should be 1500+ tokens)

### Pass/Fail
- ✅ PASS if all items checked
- ❌ FAIL if any item unchecked

---

## Test Case 3: Multi-Citation Reference Query ✅

**Module:** Al Wakeelo  
**Importance:** High - Tests references block stability

### Query
```
Compare SCMR 2022 123 and PLD 2018 SC 789 regarding Section 25 of the Islamic Shaheeh. 
What was the court's holding in each case?
```

### Expected Results

- [ ] **Both cases in references:** "Legal Citations" panel lists both SCMR and PLD cases
- [ ] **Both cases in prose:** Response mentions both case citations
- [ ] **References block JSON valid:** Network tab shows response has valid JSON references
- [ ] **No citation stripping:** All citations that appear in references block also in prose
- [ ] **Panel count matches:** If 2 cases shown in sidebar, verify same 2 in references block

### Pass/Fail
- ✅ PASS if all items checked
- ❌ FAIL if any item unchecked

---

## Test Case 4: Statute-Heavy Query ✅

**Module:** Al Wakeelo  
**Importance:** Medium - Tests statute collection + cleanup

### Query
```
What are the differences between punishment under Section 302, Section 300, and Section 304 of PPC?
```

### Expected Results

- [ ] **All 3 sections visible:** Prose includes all three section numbers
- [ ] **Statute sidebar populated:** "Relevant Statutes" shows all three with descriptions
- [ ] **No formatting artifacts:** No extra `()` or `—` symbols scattered in text
- [ ] **Prose readable:** Text flows without missing punctuation or spacing issues

### Pass/Fail
- ✅ PASS if all items checked
- ❌ FAIL if any item unchecked

---

## Test Case 5: Long Response (Token Cap Test) ✅

**Module:** Al Wakeelo  
**Importance:** High - Tests 3200 token output cap

### Query
```
Provide a detailed legal analysis of criminal conspiracy under Section 120A and 120B PPC, 
including essential ingredients, judicial interpretation from landmark cases, 
and procedural aspects.
```

### Expected Results

- [ ] **Response length:** Message is substantial (>2000 tokens, scroll to see full response)
- [ ] **No mid-sentence cut-off:** Response ends with complete sentence/conclusion
- [ ] **Full citation list:** References include all cited cases and statutes
- [ ] **No truncation marker:** No "..." or "[truncated]" at end
- [ ] **Network response**: Check Network tab - response includes all generated tokens

### Pass/Fail
- ✅ PASS if all items checked
- ❌ FAIL if any item unchecked

---

## Test Case 6: Invalid Citation Handling (Non-Strict) ✅

**Module:** Al Wakeelo  
**Importance:** Medium - Tests graceful handling of non-DB citations

### Query
```
Is there any case law on forgery under Section 463 IPC?
(Note: IPC is Indian code, not Pakistani - should handle gracefully)
```

### Expected Results

- [ ] **Response completes:** Doesn't error or hang
- [ ] **Prose preserved:** Text doesn't have empty brackets or asterisks where citations were removed
- [ ] **Guidance provided:** Response explains statute differences or notes database limitations
- [ ] **No silent failure:** User gets useful answer even if citation DB doesn't have specific case

### Pass/Fail
- ✅ PASS if all items checked
- ❌ FAIL if any item unchecked

---

## Test Case 7: Draft Mode (Strict Citations) ✅

**Module:** Legal Drafting  
**Importance:** Medium - Ensures strict mode still works

### Query
```
Draft a petition for bail under Section 497 CrPC.
```

### Expected Results

- [ ] **Drafted text generated:** Petition structure appears
- [ ] **Only DB citations:** Any citations in draft are real cases (not AI-invented)
- [ ] **Clean prose:** No `[]` or `****` artifacts in drafted document
- [ ] **References accurate:** References block matches citations in draft

### Pass/Fail
- ✅ PASS if all items checked
- ❌ FAIL if any item unchecked

---

## Automated Checks

### Browser Console
```javascript
// Check for common error patterns
[
  'null',
  'undefined',
  'is not a function',
  'Cannot read property',
  'ERR_',
  'SyntaxError'
].forEach(pattern => {
  console.log(`Errors with "${pattern}":`, 
    performance.getEntriesByType('measure')
      .filter(m => m.name.includes(pattern)).length
  );
});
```

### Network Tab
1. Filter requests: `ai/chat`
2. Check response format: Should include `{ "text": "...", "done": true, ...}`
3. Verify no 400/500 errors
4. Check streaming: Multiple `data:` events with content

### Local Storage Check
```javascript
// Verify citation policy is being applied
const lastResponse = localStorage.getItem('lastAiResponse');
const hasCitations = lastResponse?.includes('citation') || 
                      lastResponse?.includes('Section') ||
                      lastResponse?.includes('PLD');
console.log('Last response has citations:', hasCitations);
```

---

## Summary Form

### Test Date: ________________

### Tester Name: ________________

### Environment
- [ ] Local Dev (localhost)
- [ ] Staging
- [ ] Production

### Results

| Test Case | Result | Notes |
|-----------|--------|-------|
| 1. Multi-Statute | ✅ PASS / ❌ FAIL | __________ |
| 2. Case Law + Statute | ✅ PASS / ❌ FAIL | __________ |
| 3. Multi-Citation | ✅ PASS / ❌ FAIL | __________ |
| 4. Statute-Heavy | ✅ PASS / ❌ FAIL | __________ |
| 5. Long Response | ✅ PASS / ❌ FAIL | __________ |
| 6. Invalid Citation | ✅ PASS / ❌ FAIL | __________ |
| 7. Draft Mode | ✅ PASS / ❌ FAIL | __________ |

### Overall Result
- [ ] ✅ ALL TESTS PASSED - Ready for release
- [ ] ⚠️ SOME TESTS FAILED - File bug report
- [ ] ❌ CRITICAL FAILURE - Rollback deployment

### Bug Reports (if any)
```
[Paste any failures here with screenshot references]
```

---

## Regression Check

Test that previous fixes still work:

### Case Law Retrieval Depth
- [ ] Multiple case laws injected (verify with "Judgments Retrieved:" in logs)
- [ ] Statute excerpts included (verify with context)

### Output Token Cap
- [ ] Chamber tier responses reach ~3200 tokens
- [ ] Enterprise tier responses reach ~3600 tokens

### Artifact Cleanup (Prior Fix)
- [ ] No `[CASE CITATION REQUIRED]` visible
- [ ] No orphan punctuation in output

---

## Sign-Off

**All tests passed:** _____ (Tester initials)  
**Date:** ________________  
**Ready for production:** ✅ YES / ❌ NO

**Comments:**
```
[Additional observations or notes]
```
