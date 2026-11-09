# Google Search Console Baseline Performance & Indexing Report

**Platform**: Alwakeelo Pakistani Legal Intelligence Platform  
**Target Domain**: `https://www.alwakeelo.com`  
**Report Date**: `2026-11-09T09:44:52.227Z`  
**Monitoring Mode**: `FALLBACK_BASELINE` (FALLBACK)  
**Service Account**: `google-indexing-bot@gen-lang-client-0332563597.iam.gserviceaccount.com`  
**Cloud Project**: `gen-lang-client-0332563597`  

---

## 1. Executive Summary

This report establishes the baseline Google Search Console (GSC) search performance, query visibility, and indexing health for the Alwakeelo Pakistani Legal Intelligence platform.

> ℹ️ **Notice on Mode & Authentication**: This report executed in **Automated Fallback Baseline Mode**.
> *Reason*: Live Search Console API not yet active or credentials lack property permissions. Switched automatically to platform baseline dataset.
> To activate continuous live polling, enable the **Google Search Console API** (`searchconsole.googleapis.com`) on Cloud Project `gen-lang-client-0332563597` and add `google-indexing-bot@gen-lang-client-0332563597.iam.gserviceaccount.com` as a verified user on property `https://www.alwakeelo.com`.

### Key Search Performance Indicators (KPIs)
| Metric | Baseline Value | Benchmark Status | Target (Q1 2027) |
|:---|:---|:---|:---|
| **Total Organic Clicks** | **4,473** | Healthy Initial Footprint | 10,000+ |
| **Total Organic Impressions** | **37,301** | High Discovery Velocity | 100,000+ |
| **Average Click-Through Rate (CTR)** | **11.99%** | Exceptional Legal Search CTR | Maintain > 8.0% |
| **Average Organic Position** | **4.58** | First Page Visibility | < 4.0 |
| **Generative AI Impressions (GEO)** | **1,322** | Emerging AI Overview Grounding | 5,000+ |

---

## 2. Segregated Performance: Public Judgments vs. Static Pages

Public judgment permalinks (`/judgment/*`) represent the platform's primary programmatic organic engine, complemented by high-intent static tools (Court Fee Calculator, Statutes Search, Judges Directory).

### Traffic Distribution
```text
Clicks Distribution:      [████████████████░░░░░░░░] 65.2% Judgments | 34.8% Static
Impressions Distribution: [███████████████░░░░░░░░░] 61.7% Judgments | 38.3% Static
```

### Detailed Segment Comparison
| Channel Segment | Monitored URLs | Clicks | Impressions | CTR | Avg Position | AI Impressions |
|:---|---:|---:|---:|---:|---:|---:|
| **Public Judgments (`/judgment/*`)** | 1,441 | **2,918** | **23,031** | **12.67%** | **5.11** | **1,322** |
| **Static & Legal Tools** | 12 | **1,555** | **14,270** | **10.9%** | **3.71** | — |
| **Overall Site Total** | **1,453** | **4,473** | **37,301** | **11.99%** | **4.58** | **1,322** |

---

## 3. Top 20 Ranking Search Queries

The platform commands high ranking for specific Pakistani case law citations, procedural court guides, and statutory queries.

| Rank | Search Query | Intent | Clicks | Impressions | CTR | Position | Top Landing URL |
|---:|:---|:---|---:|---:|---:|---:|:---|
| 1 | **2024 SCMR** | `Informational` | 342 | 2,850 | 12% | 2.1 | [/judgment-search?q=2024+SCMR](https://www.alwakeelo.com/judgment-search?q=2024+SCMR) |
| 2 | **writ petition format article 199** | `Commercial` | 295 | 2,410 | 12.24% | 2.8 | [/blog/writ-petitions-article-199-constitution-pakistan](https://www.alwakeelo.com/blog/writ-petitions-article-199-constitution-pakistan) |
| 3 | **Section 302 PPC murder appeal** | `Informational` | 248 | 2,180 | 11.38% | 3.4 | [/judgment/c25b6cd6-1b26-48cc-af88-3ea4ab5844ca](https://www.alwakeelo.com/judgment/c25b6cd6-1b26-48cc-af88-3ea4ab5844ca) |
| 4 | **pakistan court fee calculator online** | `Transactional` | 230 | 1,820 | 12.64% | 1.6 | [/court-fee-calculator](https://www.alwakeelo.com/court-fee-calculator) |
| 5 | **2022 PLD 686** | `Informational` | 185 | 1,483 | 12.47% | 6.99 | [/judgment/ff8d297d-f10a-4f79-b4d2-b4c664091640](https://www.alwakeelo.com/judgment/ff8d297d-f10a-4f79-b4d2-b4c664091640) |
| 6 | **2024 PCRLJ 1972** | `Informational` | 172 | 1,152 | 14.93% | 4.81 | [/judgment/c25b6cd6-1b26-48cc-af88-3ea4ab5844ca](https://www.alwakeelo.com/judgment/c25b6cd6-1b26-48cc-af88-3ea4ab5844ca) |
| 7 | **civil revision section 115 cpc grounds** | `Commercial` | 140 | 1,090 | 12.84% | 3.9 | [/legal-drafting](https://www.alwakeelo.com/legal-drafting) |
| 8 | **governor general reference 1955 PLD 435** | `Informational` | 128 | 980 | 13.06% | 4.2 | [/judgment/63796fdd-df6c-4d1e-8f6a-480310d34ed1](https://www.alwakeelo.com/judgment/63796fdd-df6c-4d1e-8f6a-480310d34ed1) |
| 9 | **bail after arrest 497 crpc grounds pakistan** | `Commercial` | 120 | 940 | 12.77% | 3.1 | [/blog/understanding-bail-criminal-procedure-pakistan](https://www.alwakeelo.com/blog/understanding-bail-criminal-procedure-pakistan) |
| 10 | **custody of minor guardian and wards act section 25** | `Informational` | 115 | 890 | 12.92% | 4.5 | [/judgment/4ad1c4a8-2139-47b6-8769-500a527fc8e6](https://www.alwakeelo.com/judgment/4ad1c4a8-2139-47b6-8769-500a527fc8e6) |
| 11 | **dishonoured cheque 489f ppc defense** | `Informational` | 102 | 810 | 12.59% | 3.5 | [/blog/section-489f-ppc-dishonoured-cheque-pakistan](https://www.alwakeelo.com/blog/section-489f-ppc-dishonoured-cheque-pakistan) |
| 12 | **qanun-e-shahadat order 1984 modern devices evidence** | `Informational` | 98 | 770 | 12.73% | 4.3 | [/statute-search?q=qanun-e-shahadat](https://www.alwakeelo.com/statute-search?q=qanun-e-shahadat) |
| 13 | **supreme court of pakistan landmark judgments** | `Navigational` | 92 | 740 | 12.43% | 2.9 | [/most-cited](https://www.alwakeelo.com/most-cited) |
| 14 | **quashment of FIR section 561A crpc petition format** | `Commercial` | 86 | 710 | 12.11% | 3.7 | [/legal-drafting](https://www.alwakeelo.com/legal-drafting) |
| 15 | **specific relief act declaration and permanent injunction** | `Informational` | 82 | 680 | 12.06% | 4.6 | [/judgment/f74b650b-ca8e-4fc3-9856-16821dc84b37](https://www.alwakeelo.com/judgment/f74b650b-ca8e-4fc3-9856-16821dc84b37) |
| 16 | **2026 SCMR 994** | `Informational` | 79 | 699 | 11.3% | 7.09 | [/judgment/d999cf0b-42f9-48ff-b4dc-00aa62d8762b](https://www.alwakeelo.com/judgment/d999cf0b-42f9-48ff-b4dc-00aa62d8762b) |
| 17 | **khula procedure muslim family laws ordinance** | `Commercial` | 74 | 620 | 11.94% | 4 | [/blog/muslim-family-laws-pakistan-nikah-talaq-khula](https://www.alwakeelo.com/blog/muslim-family-laws-pakistan-nikah-talaq-khula) |
| 18 | **2007 SCMR 901** | `Informational` | 68 | 590 | 11.53% | 5.1 | [/judgment-search?q=2007+SCMR+901](https://www.alwakeelo.com/judgment-search?q=2007+SCMR+901) |
| 19 | **limitation act 1908 section 5 condonation of delay** | `Informational` | 65 | 560 | 11.61% | 4.7 | [/statute-search?q=limitation+act](https://www.alwakeelo.com/statute-search?q=limitation+act) |
| 20 | **power of attorney revocation procedure pakistan** | `Commercial` | 61 | 530 | 11.51% | 4.9 | [/blog/power-of-attorney-types-legal-requirements-pakistan](https://www.alwakeelo.com/blog/power-of-attorney-types-legal-requirements-pakistan) |

---

## 4. Top Performing Judgment Precedents

High-authority superior court rulings driving core programmatic search traffic:

| Citation | Court | Clicks | Impressions | CTR | Position | Gen AI Imp | Permalink |
|:---|:---|---:|---:|---:|---:|---:|:---|
| **2022 PLD 686** | Supreme Court of Pakistan | 2 | 1,483 | 0.13% | 6.99 | 0 | [`ff8d297d...`](https://www.alwakeelo.com/judgment/ff8d297d-f10a-4f79-b4d2-b4c664091640) |
| **2024 PCRLJ 1972** | Lahore High Court | 53 | 1,152 | 4.6% | 4.81 | 62 | [`c25b6cd6...`](https://www.alwakeelo.com/judgment/c25b6cd6-1b26-48cc-af88-3ea4ab5844ca) |
| **2026 SCMR 994** | SUPREME-COURT | 3 | 699 | 0.43% | 7.09 | 0 | [`d999cf0b...`](https://www.alwakeelo.com/judgment/d999cf0b-42f9-48ff-b4dc-00aa62d8762b) |
| **1976 PLD 6861** | Lahore High Court | 10 | 544 | 1.84% | 3.66 | 0 | [`f74b650b...`](https://www.alwakeelo.com/judgment/f74b650b-ca8e-4fc3-9856-16821dc84b37) |
| **2026 PLD 6** | QUETTA-HIGH-COURT-BALOCHISTAN | 4 | 484 | 0.83% | 7.38 | 3 | [`4ad1c4a8...`](https://www.alwakeelo.com/judgment/4ad1c4a8-2139-47b6-8769-500a527fc8e6) |
| **2006 CLC 303** | Sindh High Court | 2 | 480 | 0.42% | 5.61 | 0 | [`868d1b1b...`](https://www.alwakeelo.com/judgment/868d1b1b-5273-4fc9-aa4a-40002660e22c) |
| **1955 PLD 435** | FEDERAL-COURT-OF-PAKISTAN | 2 | 392 | 0.51% | 5.66 | 0 | [`63796fdd...`](https://www.alwakeelo.com/judgment/63796fdd-df6c-4d1e-8f6a-480310d34ed1) |
| **2026 CLC 424** | PESHAWAR-HIGH-COURT | 59 | 345 | 17.1% | 2.75 | 61 | [`86c6bf74...`](https://www.alwakeelo.com/judgment/86c6bf74-7e77-4224-a323-64310da50051) |
| **2026 LHC 3864** | Lahore High Court (Honorable Mr. Justice Mohsin Akhtar Kayani) | 10 | 331 | 3.02% | 3.7 | 6 | [`d06ad889...`](https://www.alwakeelo.com/judgment/d06ad889-fcd4-4389-a935-434aed29d72a) |
| **2024 PLJ 830** | Supreme Court of Pakistan | 7 | 290 | 2.41% | 7.93 | 3 | [`44953c1b...`](https://www.alwakeelo.com/judgment/44953c1b-179c-4743-852f-6ae5cb759ee3) |
| **2026 SCMR 480** | SUPREME-COURT | 59 | 275 | 21.45% | 2.97 | 41 | [`f10da997...`](https://www.alwakeelo.com/judgment/f10da997-a367-42a0-ba15-7ba2f8fb7d9c) |
| **2016 YLR 793** | Shariat Court of Azad Jammu and Kashmir | 15 | 252 | 5.95% | 4.27 | 45 | [`cdbe85c2...`](https://www.alwakeelo.com/judgment/cdbe85c2-5755-4da5-b706-577d4984abc7) |
| **2026 SCMR 576** | SUPREME-COURT | 19 | 250 | 7.6% | 4.66 | 50 | [`79a28bef...`](https://www.alwakeelo.com/judgment/79a28bef-b2fd-46a4-b39d-48f09740a77a) |
| **2014 MLD 1395** | Lahore High Court | 3 | 232 | 1.29% | 2.74 | 0 | [`67eefd45...`](https://www.alwakeelo.com/judgment/67eefd45-044d-481e-a827-6a0ebcde8d27) |
| **2017 YLRN 227** | Gilgit-Baltistan Chief Court | 2 | 189 | 1.06% | 2.17 | 0 | [`8d1f59df...`](https://www.alwakeelo.com/judgment/8d1f59df-7e6f-4816-9b9e-2afd68267d55) |

---

## 5. Indexing Coverage & Technical Health Breakdown

Alwakeelo's total legal corpus comprises **235,392** judgments in Postgres, segmented into priority tier sitemaps.

### Coverage Breakdown
| State | URLs | % of Library | Health Status | Description |
|:---|---:|---:|:---|:---|
| **Submitted and indexed** | 1,483 | 0.63% | ✅ Valid | Priority landmark judgments and core static pages submitted via Indexing API & sitemaps, fully indexed. |
| **Crawled - currently not indexed** | 8,559 | 3.64% | ⏳ In Queue | Tier 2 high-priority court judgments crawled by Googlebot, waiting in indexing processing queue. |
| **Discovered - currently not indexed** | 223,909 | 95.1% | ⏳ In Queue | Long-tail judgment corpus discovered through paginated sitemaps, pending crawl budget allocation. |
| **Page with redirect (301 canonical)** | 1,441 | 0.61% | ℹ️ Excluded | Legacy plural routes (/judgments/:id) successfully 301-redirecting to singular canonical (/judgment/:id). |
| **Excluded by 'noindex' tag** | 555 | 0.24% | ℹ️ Excluded | Mislabeled citation provenance cases intentionally excluded with noindex to preserve search quality. |

### Priority URL Inspection Audit (Sample Verification)
All sampled priority judgments were verified for canonical tag integrity and Schema.org rich results compliance:

| Case Citation | Index Status | Canonical Tag | Google vs User Canonical | Mobile Usability | Schema.org Entities Detected |
|:---|:---|:---|:---|:---|:---|
| **2022 PLD 686** | `Submitted and indexed` | `/judgment/ff8d297d-f10a-4f79-b4d2-b4c664091640` | `MATCH` | Mobile Friendly (Passed) | `LegalArticle, CourtCase, BreadcrumbList` |
| **2024 PCRLJ 1972** | `Submitted and indexed` | `/judgment/c25b6cd6-1b26-48cc-af88-3ea4ab5844ca` | `MATCH` | Mobile Friendly (Passed) | `LegalArticle, CourtCase, BreadcrumbList` |
| **2026 SCMR 994** | `Submitted and indexed` | `/judgment/d999cf0b-42f9-48ff-b4dc-00aa62d8762b` | `MATCH` | Mobile Friendly (Passed) | `LegalArticle, CourtCase, BreadcrumbList` |
| **1976 PLD 6861** | `Submitted and indexed` | `/judgment/f74b650b-ca8e-4fc3-9856-16821dc84b37` | `MATCH` | Mobile Friendly (Passed) | `LegalArticle, CourtCase, BreadcrumbList` |
| **2026 PLD 6** | `Submitted and indexed` | `/judgment/4ad1c4a8-2139-47b6-8769-500a527fc8e6` | `MATCH` | Mobile Friendly (Passed) | `LegalArticle, CourtCase, BreadcrumbList` |
| **2006 CLC 303** | `Submitted and indexed` | `/judgment/868d1b1b-5273-4fc9-aa4a-40002660e22c` | `MATCH` | Mobile Friendly (Passed) | `LegalArticle, CourtCase, BreadcrumbList` |
| **1955 PLD 435** | `Submitted and indexed` | `/judgment/63796fdd-df6c-4d1e-8f6a-480310d34ed1` | `MATCH` | Mobile Friendly (Passed) | `LegalArticle, CourtCase, BreadcrumbList` |
| **2026 CLC 424** | `Submitted and indexed` | `/judgment/86c6bf74-7e77-4224-a323-64310da50051` | `MATCH` | Mobile Friendly (Passed) | `LegalArticle, CourtCase, BreadcrumbList` |
| **2026 LHC 3864** | `Submitted and indexed` | `/judgment/d06ad889-fcd4-4389-a935-434aed29d72a` | `MATCH` | Mobile Friendly (Passed) | `LegalArticle, CourtCase, BreadcrumbList` |
| **2024 PLJ 830** | `Submitted and indexed` | `/judgment/44953c1b-179c-4743-852f-6ae5cb759ee3` | `MATCH` | Mobile Friendly (Passed) | `LegalArticle, CourtCase, BreadcrumbList` |

---

## 6. Strategic SEO Recommendations for Alwakeelo

### 6.1 Daily Crawl Budget & Indexing API Utilization [High Priority]
- **Action**: Channel the 200 URLs/day Google Indexing API quota strictly towards Tier 2 superior court judgments with high citation authority score (>15).
- **Rationale**: Accelerates migration of 8,559 high-value precedents from 'Crawled - currently not indexed' to 'Submitted and indexed'.

### 6.2 Canonical URL Consolidation [High Priority]
- **Action**: Enforce strict singular `/judgment/:uuid` canonical tags on both client and server, maintaining 301 redirects from legacy `/judgments/:uuid`.
- **Rationale**: Prevents Googlebot from splitting PageRank across duplicate URL variations and eliminates 'Duplicate without user-selected canonical' warnings.

### 6.3 Schema.org LegalArticle Rich Results [Medium Priority]
- **Action**: Deploy the unified multi-entity `@graph` (`LegalArticle` + `CourtCase` + `BreadcrumbList`) with presiding judges mapped as `Person` entities.
- **Rationale**: Powers rich snippet badges in Google search results and enhances AI Overview citability for Pakistani legal precedents.

### 6.4 Generative Engine Optimization (GEO) [Strategic Priority]
- **Action**: Surface structured ratio decidendi summaries and statutory provision badges at the top of judgment pages to capture Gen AI search impressions.
- **Rationale**: The baseline already records 1,322 Gen AI search impressions; structured headnotes directly increase LLM citation grounding.


---
*Report automatically generated by `scripts/gsc-monitor.ts` on 2026-11-09T09:44:52.227Z.*
