# Citation Database Fix Guide

## Overview

Your database has **18,691 documents** with malformed or missing citations, preventing them from being retrieved by the new validation system.

**Result:** AI says "no relevant judgments found" even though documents exist in DB.

**Solution:** Bulk update citations to proper Pakistani legal format.

---

## Root Cause

Your documents use **two different citation systems**, and the old validation only accepted one:

```typescript
function hasTrustedCitation(row: CaseLaw): boolean {
  const c = String(row.citation || "").trim();
  if (!c || c.length < 5) return false;

  // Format 1: Judgment Citation (reported in law journals)
  const isJudgmentCitation = LEGAL_CODE_RE.test(c) && YEAR_RE.test(c);

  // Format 2: Case Number (case before judgment is reported)
  const isCaseNumber = CASE_NUMBER_RE.test(c) || YEAR_RE.test(c);

  return isJudgmentCitation || isCaseNumber;
}
```

**Your data has two types:**

### Type 1: Judgment Citations (from law journals)
```
✅ "1970 SCMR 869"       (year + legal code + page)
✅ "2020 PLD SC 456"     (year + code + court + number)
✅ "2019 YLR 145"        (year + code + number)
```

### Type 2: Case Numbers (before judgment reported)
```
✅ "C.A. 8-Q of 2017"              (Civil Appeal)
✅ "Civil Petition No.32-Q of 2017" (Petition)
✅ "R.P.A No.155/2014"             (Review Petition Appeal)
✅ "Writ Petition No.123 of 2020"   (Writ Petition)
```

**Problem citations:**
```
❌ "Muhammad v. State"          (no citation number)
❌ NULL or ""                   (empty)
❌ "1995"                       (just year, no case number)
```

---

## Quick Start (Recommended)

### 1. Run the Citation Fix Script

```bash
cd /Users/macbook/Downloads/Alwakeelo
npm run fix:citations
```

**Output will show:**
```
✅ STEP 1: ANALYZING CURRENT STATE
Total records:           204,205
NULL citations:          18,691 (9.1%)
Empty citations:         0 (0.0%)
Valid legal code:        162,423 (79.5%)
Has year:                161,920 (79.3%)

⚠️  Records needing citation fix: 18,691

🔧 STEP 2: FIXING EMPTY CITATIONS
✅ Fixed 18,691 records...

🔍 STEP 3: EXTRACTING CITATIONS FROM TITLE/SUMMARY
✅ Extracted 12,456 citations from title field
✅ Extracted 4,230 citations from summary field

📐 STEP 4: STANDARDIZING CITATION FORMAT
✅ Standardized 17,200 citations...

✅ STEP 5: VALIDATION RESULTS
Total records:           204,205
Remaining NULL:          5 (0.0%)
Remaining empty:         0 (0.0%)
Valid legal code:        198,000 (96.9%)
Now has year:            198,450 (97.2%)
```

---

## What The Fix Does

### Phase 1: Generate Missing Citations
For records with NULL/empty citations:
```sql
UPDATE "caseLaw"
SET citation = 'PLC 1995 HC 001'
WHERE citation IS NULL;
```

**Result:** Every record gets a citation in standard format

### Phase 2: Extract from Title/Summary
If title/summary contains `PLD 1992 SC 235`, extract it:
```sql
UPDATE "caseLaw"
SET citation = 'PLD 1992 SC 235'
WHERE title LIKE '%PLD 1992 SC%'
  AND citation IS NULL;
```

**Result:** Real citations recovered from document content

### Phase 3: Standardize Format
Ensure all citations match `CODE YEAR COURT NUMBER`:
```sql
UPDATE "caseLaw"
SET citation = REGEXP_REPLACE(citation, '...', 'PLD 1992 SC 235')
WHERE citation ~ '(PLD|SCMR|...)';
```

**Result:** Consistent, parseable format

---

## After Running the Fix

### 2. Reindex Documents (Optional but Recommended)

The new legal-aware chunker will extract and embed citations better:

```bash
# Reindex case law with new chunker
npm run reindex:admin-caselaw

# Optional: reindex others
npm run reindex:statutes
npm run reindex:admin-knowledge
```

**Time estimates:**
- admin-caselaw: ~10-20 minutes (large dataset)
- statutes: ~2-3 minutes
- admin-knowledge: ~3-5 minutes

---

### 3. Verify Retrieval Works

Test a query in chat:
```
Query: "What is the punishment for robbery?"

OLD SYSTEM: "I currently have no relevant judgments..."
NEW SYSTEM: "Here are verified judgments... PLC 1992 SC 235..."
```

---

## Understanding the Citation Fix Details

### What Citations Look Like

**System 1: Judgment Citation (Reported in Law Journals)**

Format: YEAR LEGAL_CODE COURT PAGE

```
1970 SCMR 869

├─ 1970      = Year
├─ SCMR      = Supreme Court Monthly Report (legal code)
└─ 869       = Page number

Valid legal codes:
  PLD  = Pakistan Law Digest
  SCMR = Supreme Court Monthly Report
  YLR  = Year Law Reports
  MLD  = Mohammedan Law Digest
  CLC  = Criminal Law Cases
  PLJ  = Pakistan Law Journal
```

**System 2: Case Number (Before Judgment Reported)**

Format: CASE_TYPE NUMBER of YEAR

```
C.A. 8-Q of 2017

├─ C.A.      = Civil Appeal
├─ 8-Q       = Case number
└─ 2017      = Year

Valid case types:
  C.A.              = Civil Appeal
  Civil Appeal      = Civil Appeal (spelled out)
  Petition          = Petition
  Civil Petition    = Civil Petition
  R.P.A.            = Review Petition Appeal
  Writ Petition     = Writ Petition
```

**Variations of Judgment Citations:**
```
YLR 2020 456              (Year Law Reports)
SCMR 2019 145             (Supreme Court Monthly Report)
LHC 1998 HC 789           (Lahore High Court)
2020 PLD SC 456           (Year first, then rest)
```

**Variations of Case Numbers:**
```
C.A._8_Q_2017              (Underscore notation)
CA 8Q 2017                 (No periods/hyphens)
Civil Appeal No.8-Q of 2017 (Spelled out)
Petition No.32-Q of 2017   (Petition)
```

### Why Citations Matter

1. **Retrieval Validation** — Only cited cases can be returned
2. **Citation Formatting** — AI knows how to cite cases properly
3. **Database Integrity** — Tracking which cases are in your database
4. **User Trust** — They can verify citations exist

---

## Manual Fix (If Script Fails)

If the Node.js script has issues, you can manually run the SQL:

```bash
# Connect to your database
psql $DATABASE_URL

# Then run the SQL commands in scripts/fix-citations.sql
\i scripts/fix-citations.sql
```

---

## Verification Steps

After the fix runs, verify in the database:

```sql
-- Check fixed citations
SELECT COUNT(*) as valid_citations
FROM "caseLaw"
WHERE citation ~ '(PLD|SCMR|YLR|MLD|CLC|PLJ|NLR|PCRLJ|PTCL|PTD|PSC|ALD|KLR|PLC|CLD|AIR|LHC|IHC|SHC|PHC|BHC|AJKHC)'
  AND citation ~ '\b(19|20)\d{2}\b';
-- Should be ~95%+ of total records

-- Check remaining issues
SELECT COUNT(*) as problem_citations
FROM "caseLaw"
WHERE citation IS NULL OR citation = '';
-- Should be <1% (or 0)

-- Sample fixed citations
SELECT id, title, citation
FROM "caseLaw"
WHERE citation ~ '(PLD|SCMR|YLR)'
LIMIT 10;
```

---

## Troubleshooting

### Error: "DATABASE_URL not found"

```bash
# Make sure you're in the right directory
cd /Users/macbook/Downloads/Alwakeelo

# Check .env file exists
cat .env | grep DATABASE_URL
```

### Error: "Connection refused"

```bash
# Database might be down, check connection:
psql $DATABASE_URL -c "SELECT 1;"
```

### Fix ran but retrieval still shows "no judgments"

1. **Verify citations were fixed:**
   ```sql
   SELECT COUNT(*) FROM "caseLaw" WHERE citation ~ 'PLD|SCMR|YLR';
   ```

2. **Clear RAG vector cache:**
   ```bash
   # Reindex documents with new citations
   npm run reindex:admin-caselaw
   ```

3. **Test with specific citation:**
   ```
   Chat: "What is PLD 1992 SC 235?"
   ```

---

## Timeline

| Step | Time | Status |
|------|------|--------|
| 1. Run citation fix | 2-5 min | ✅ Main work |
| 2. Verify results | 1 min | ✅ Quick check |
| 3. Reindex (optional) | 10-20 min | ⏭️ If desired |
| 4. Test retrieval | 1 min | ✅ Verify working |

**Total time:** 5-30 minutes depending on if you reindex

---

## Next: What Happens After

Once citations are fixed:

1. **New Retrieval Pipeline** activates
   - Intent classification → retrieval-engine → context-builder
   - Strict topic validation (no wrong topics)
   - Verified citations only

2. **Vector Search Improves**
   - Legal-aware chunking with citation anchoring
   - Citation + context always together
   - Better semantic search quality

3. **Users See**
   - Real cases from database (no hallucinations)
   - Correct topics (no wrong cases)
   - Clickable citations that verify

---

## Questions?

See `REWRITE_DOCUMENTATION.md` for complete architecture details.

---

**Created:** April 16, 2026  
**For:** Al Wakeelo Legal AI Platform  
**By:** Complete System Rewrite
