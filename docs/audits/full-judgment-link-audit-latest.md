# AlWakeelo Full Judgment Link and Identity Audit Report

- **Audit Run Mode**: FULL
- **Status**: RUNNING
- **Commit SHA**: `01b36657bff2dd5367e24dcec9fa07c2dbc62d3e`
- **Database Host**: `ep-purple-pond-aipaany5-pooler.c-4.us-east-1.aws.neon.tech`
- **Audit Started**: 2026-11-08T23:08:54.154Z
- **Last Updated**: 2026-11-08T23:12:50.205Z

---

## 1. Measured Throughput and Capacity

- **Audited Sample**: 60 / 235,392 records (0.03% coverage)
- **Measured Throughput**: **0.33 records/second**
- **Duration Elapsed**: 30.4 seconds
- **Projected Time for Full 235k Database**: **198.8 hours**

---

## 2. Exact Coverage Denominators

| Coverage Category | Count | Percentage of Total |
|---|:---:|:---:|
| **Total Inventoried Judgments** | 235,392 | 100.00% |
| **Database & Provenance Checked** | 60 | 0.03% |
| **Original Cached Sources Checked** | 11 | 0.00% |
| **Live Public Pages Checked** | 60 | 0.03% |
| **Live Public APIs Checked** | 60 | 0.03% |
| **PDF Endpoints Checked** | 37 | 0.02% |
| **Search / Case-Law Rows Checked** | 32 | — |
| **Pending Unprocessed Records** | 235,332 | 99.97% |

---

## 3. Disjoint Result Classification

Every audited record is mapped to exactly one mutually exclusive category with documented precedence:

| Disjoint Category | Count | Description |
|---|:---:|---|
| **`confirmed_active_canonical`** | **37** | Active canonical judgments with verified identity and matching source text |
| **`confirmed_alias_redirect`** | **8** | Proven duplicates whose old UUID correctly resolves to canonical owner |
| **`correctly_withheld_mislabeled`** | **0** | Mislabeled records correctly withheld from public presentation |
| **`correctly_withheld_unknown`** | **15** | Unconfirmed header records correctly quarantined with warnings |
| **`intentional_archived_no_alias`** | **0** | Inactive records intentionally retired without an alias (returning 404) |
| **`broken_canonical_pointer`** | **0** | Defective aliases (pointing to missing, inactive, or chained targets) |
| **`identity_mismatch_active`** | **0** | Active records with conflicting title, court, or citation namespace |
| **`live_link_broken`** | **0** | Unexpected 404, 5xx, or network failure on public judgment routes |
| **`content_mismatch_live`** | **0** | Public API returned title, ID, or text inconsistent with database source |
| **`search_index_stale`** | **0** | `case_law` keyword rows with stale metadata or unsupported excerpts |
| **`insufficient_evidence`** | **0** | Records where court identity cannot be established from header/source |
| **`transient_failed`** | **0** | Network error / retry exhaustion during live checks |

---

## 4. Failure Samples & Defects

_Zero genuine link or identity defects detected in this audited cohort._

---

## 5. Certification & Guardrails

- **Zero Database Mutations**: Audit executed strictly inside `BEGIN READ ONLY` transactions.
- **Zero Paid AI Calls**: No embedding, reranking, OCR-services, or LLM tokens invoked.
- **Resumable Artifacts**: Detailed results streaming to `scratch/full-judgment-link-audit/audit-results.jsonl` with state in `checkpoint.json`.
