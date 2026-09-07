# E2E Test Infra: Al Wakeelo Experimental Preview

## Test Philosophy & Five-Tier Testing Methodology
- Opaque-box, requirement-driven. Native Node.js test runner (`node --import tsx --test`).
- Methodology: Five-Tier Testing Methodology comprising Category-Partition + Boundary Value Analysis + Pairwise Combinations + Real-World Workload Testing + Adversarial Stress.

## Feature Inventory Mapping & Scope
| # | Feature | Source (requirement) | Tier 1 | Tier 2 | Tier 3 |
|---|---------|---------------------|:------:|:------:|:------:|
| 1 | Document Analyzer 6-Pillar Deep Scan | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ |
| 2 | Chat Inspector & Citation Graph | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ |
| 3 | TipTap Drafting Studio & Templates | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ |
| 4 | Case Files & Diary PostgreSQL CRUD | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| 5 | Document Scans & Findings Persistence | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| 6 | Organization Activity Logs Persistence | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| 7 | Legal Drafts Cloud Persistence | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| 8 | Search History Live Deletion | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| 9 | pgvector Dual-Database RAG Retrieval | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| 10 | Route Rendering & Shell Navigation | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ |
| 11 | Multi-Model LLM Orchestration | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ |

## Test Architecture
- Test runner: `node --import tsx --test tests/e2e/preview-master-verification.test.ts`
- Secondary & unit runner: `npm test` and `npm run test:e2e`
- Master 5-tier runner: `node --import tsx --test tests/preview-master-5tier-e2e.test.ts`
- Pass/fail semantics: Exit code 0 on all tests passing, strict assertions via `node:assert/strict`.
- Directory layout:
  - `tests/unit/**/*.test.ts`: Unit logic, statutory computation, and component tests.
  - `tests/e2e/**/*.test.ts`: End-to-end integration and workflow verification tests.

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | End-to-End Plaint Defect Analysis & Limitation Rollover | F1, F5, F10 | High |
| 2 | AI Legal Research with Grounded Precedents & Citation Graph | F2, F9, F11 | High |
| 3 | Multi-Pillar Commercial Agreement Drafting & Clause Insertion | F3, F7, F10 | High |
| 4 | Chamber Case Intake, Diary Hearing & Compliance Audit | F4, F6, F8 | High |
| 5 | Full Zero-Mock Session Lifecycle & Data Integrity | F1..F11 | High |

## Coverage Thresholds
- Tier 1: ≥5 per feature (55+ tests)
- Tier 2: ≥5 per feature (55+ tests)
- Tier 3: Pairwise coverage of major feature interactions (15+ tests)
- Tier 4: ≥5 realistic application scenarios (5+ tests)
- Total Target: ~130+ comprehensive verification tests
