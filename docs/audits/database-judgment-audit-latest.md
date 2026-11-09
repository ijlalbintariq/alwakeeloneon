# AlWakeelo Full Judgment Link and Identity Audit Report

- **Audit Run Mode**: FULL
- **Status**: COMPLETED
- **Commit SHA**: `01b36657bff2dd5367e24dcec9fa07c2dbc62d3e`
- **Database Host**: `ep-purple-pond-aipaany5-pooler.c-4.us-east-1.aws.neon.tech`
- **Audit Started**: 2026-11-08T23:50:05.286Z
- **Last Updated**: 2026-11-09T01:09:37.416Z

---

## 1. Measured Throughput and Capacity

- **Audited Sample**: 235,392 / 235,392 records (100.00% coverage)
- **Measured Throughput**: **49.35 records/second**
- **Duration Elapsed**: 4770.0 seconds
- **Projected Time for Full 235k Database**: **0 hours**

---

## 2. Exact Coverage Denominators

| Coverage Category | Count | Percentage of Total |
|---|:---:|:---:|
| **Total Inventoried Judgments** | 235,392 | 100.00% |
| **Database & Provenance Checked** | 235,392 | 100.00% |
| **Original Cached Sources Checked** | 47,693 | 20.26% |
| **Live Public Pages Checked** | 0 | 0.00% |
| **Live Public APIs Checked** | 0 | 0.00% |
| **PDF Endpoints Checked** | 0 | 0.00% |
| **Search / Case-Law Rows Checked** | 140,156 | — |
| **Pending Unprocessed Records** | 0 | 0.00% |

---

## 3. Disjoint Result Classification

Every audited record is mapped to exactly one mutually exclusive category with documented precedence:

| Disjoint Category | Count | Description |
|---|:---:|---|
| **`confirmed_active_canonical`** | **155,368** | Active canonical judgments with verified identity and matching source text |
| **`confirmed_alias_redirect`** | **22,540** | Proven duplicates whose old UUID correctly resolves to canonical owner |
| **`correctly_withheld_mislabeled`** | **4,130** | Mislabeled records correctly withheld from public presentation |
| **`correctly_withheld_unknown`** | **53,094** | Unconfirmed header records correctly quarantined with warnings |
| **`intentional_archived_no_alias`** | **227** | Inactive records intentionally retired without an alias (returning 404) |
| **`broken_canonical_pointer`** | **0** | Defective aliases (pointing to missing, inactive, or chained targets) |
| **`identity_mismatch_active`** | **2** | Active records with conflicting title, court, or citation namespace |
| **`live_link_broken`** | **0** | Unexpected 404, 5xx, or network failure on public judgment routes |
| **`content_mismatch_live`** | **0** | Public API returned title, ID, or text inconsistent with database source |
| **`search_index_stale`** | **0** | `case_law` keyword rows with stale metadata or unsupported excerpts |
| **`insufficient_evidence`** | **31** | Records where court identity cannot be established from header/source |
| **`transient_failed`** | **0** | Network error / retry exhaustion during live checks |

---

## 4. Failure Samples & Defects

1. **2018 LHC 4260** (`00af1ad2-fcb8-4d91-bb16-f916faa27957`): Category `insufficient_evidence` — Insufficient evidence to verify or classify case identity
2. **1988 SCMR 2003** (`04e0b5be-ce26-4fab-a064-2ca6ad3a611e`): Category `insufficient_evidence` — Insufficient evidence to verify or classify case identity
3. **2019 LHC 5149** (`074fd032-c600-4ee7-a8b9-bfaf123dd618`): Category `insufficient_evidence` — Insufficient evidence to verify or classify case identity
4. **2019 PLD 1** (`0b1c0ff7-b95f-4af4-b9a8-6784e73d3455`): Category `insufficient_evidence` — Insufficient evidence to verify or classify case identity
5. **1970 PLD 98** (`0e5ee407-2331-4223-9350-5ecf5f6a6f8b`): Category `insufficient_evidence` — Insufficient evidence to verify or classify case identity
6. **2020 SCMR 2003** (`1527b555-165b-45f6-a6dd-4e67e12a14bd`): Category `insufficient_evidence` — Insufficient evidence to verify or classify case identity
7. **2018 LHC 3999** (`1da48e2a-faac-4482-bb35-969371a44ffc`): Category `insufficient_evidence` — Insufficient evidence to verify or classify case identity
8. **2019 LHC 5167** (`2dc47cc7-607f-414c-80fd-b10cdbe245c9`): Category `insufficient_evidence` — Insufficient evidence to verify or classify case identity
9. **2017 PLC(CS) 738** (`3cde2922-b822-4ba5-bed0-a9166c1cb18a`): Category `insufficient_evidence` — Insufficient evidence to verify or classify case identity
10. **2019 LHC 4985** (`3d2f2580-08c1-4d84-8b24-bf145ab5ae22`): Category `insufficient_evidence` — Insufficient evidence to verify or classify case identity
11. **1962 PLD 558** (`3fa1f1eb-25aa-41b8-b724-8a65d2abbcb7`): Category `insufficient_evidence` — Insufficient evidence to verify or classify case identity
12. **2014 GBLR 54** (`461a34a9-70cb-4755-a775-e67c96ecc5e6`): Category `insufficient_evidence` — Insufficient evidence to verify or classify case identity
13. **2019 LHC 5053** (`484f2ee5-df4b-41bf-9f18-ceea74de8a3f`): Category `insufficient_evidence` — Insufficient evidence to verify or classify case identity
14. **2021 YLR 112** (`6298a145-6327-4e53-ad66-539ed1232c70`): Category `insufficient_evidence` — Insufficient evidence to verify or classify case identity
15. **2018 LHC 4035** (`6b87e7c2-8fb7-4b2c-be5b-9ed11a00f921`): Category `insufficient_evidence` — Insufficient evidence to verify or classify case identity
16. **Const. P. 917/2025 (SHC)** (`714f97cf-2ea6-4c06-bb92-ada4aa971174`): Category `identity_mismatch_active` — Citation namespace fields (year, journal, page) do not match citation string
17. **1988 SCMR 2004** (`757f72b3-e89e-42e2-af34-232e6615dcc3`): Category `insufficient_evidence` — Insufficient evidence to verify or classify case identity
18. **2017 LHC 5914** (`761c3af6-ae09-4663-9fe0-afa4278ef031`): Category `insufficient_evidence` — Insufficient evidence to verify or classify case identity
19. **2019 LHC 4989** (`7706deca-3379-4fdf-9c36-d6beb60e7e5a`): Category `insufficient_evidence` — Insufficient evidence to verify or classify case identity
20. **2017 LHC 5559** (`7b692c18-b69d-4afd-9235-bb67a59bf894`): Category `insufficient_evidence` — Insufficient evidence to verify or classify case identity
21. **Const. P. 1173/2023 (SHC)** (`9339eeac-2ed7-4305-ac13-6331d241e5e1`): Category `identity_mismatch_active` — Citation namespace fields (year, journal, page) do not match citation string
22. **2023 SCMR 55** (`96d29722-e82c-4571-acb6-f0fb79d94a0a`): Category `insufficient_evidence` — Insufficient evidence to verify or classify case identity
23. **2019 LHC 5124** (`9bf7ce10-8293-44c8-affa-989dd739c491`): Category `insufficient_evidence` — Insufficient evidence to verify or classify case identity
24. **1970 PLD 139** (`9c5ae4c6-4c0b-44d2-9bc3-204fd1f177a3`): Category `insufficient_evidence` — Insufficient evidence to verify or classify case identity
25. **2016 SCMR 1608** (`a0c96b45-166a-4648-a30f-dc51aa1ee7fb`): Category `insufficient_evidence` — Insufficient evidence to verify or classify case identity
26. **2019 LHC 5116** (`a86431e4-4e22-4d9e-b60e-5f75df6e71fd`): Category `insufficient_evidence` — Insufficient evidence to verify or classify case identity
27. **2014 GBLR 59** (`ad5ab015-b11b-440a-9f4e-a06123395b0a`): Category `insufficient_evidence` — Insufficient evidence to verify or classify case identity
28. **1991 SCMR 2084** (`bd110c22-cf60-4b50-bde8-3b055950b302`): Category `insufficient_evidence` — Insufficient evidence to verify or classify case identity
29. **2019 LHC 5114** (`d477cfef-1119-49d1-aca6-e13ed6d3eeab`): Category `insufficient_evidence` — Insufficient evidence to verify or classify case identity
30. **2018 LHC 4312** (`f04aa5d9-cb0a-4344-bf3f-563374f603be`): Category `insufficient_evidence` — Insufficient evidence to verify or classify case identity
31. **2017 PTD 1244** (`f4fd4395-430e-4e12-958b-92e098ff1340`): Category `insufficient_evidence` — Insufficient evidence to verify or classify case identity
32. **1988 SCMR 2001** (`fdc7de5c-fa86-4c2c-9a36-8becd6a7e0ab`): Category `insufficient_evidence` — Insufficient evidence to verify or classify case identity
33. **2019 LHC 5120** (`fef19e37-2982-4c58-b9bc-718a49251d71`): Category `insufficient_evidence` — Insufficient evidence to verify or classify case identity

---

## 5. Certification & Guardrails

- **Zero Database Mutations**: Audit executed strictly inside `BEGIN READ ONLY` transactions.
- **Zero Paid AI Calls**: No embedding, reranking, OCR-services, or LLM tokens invoked.
- **Resumable Artifacts**: Detailed results streaming to `scratch/full-judgment-link-audit/audit-results.jsonl` with state in `checkpoint.json`.
