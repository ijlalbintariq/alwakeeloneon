# Technical Linkable SEO Assets & Embeddable Utilities Specification

**Platform:** Alwakeelo Pakistani Legal Intelligence Platform  
**Document:** `docs/seo/technical-linkable-assets.md`  
**Classification:** Technical SEO, Public Assets & Developer Integration Specification  
**Version:** 1.0 (Production-Ready)  
**Associated Endpoints:** `/court-fee-calculator`, `/most-cited`, `/judges`, `/statutes`  

---

## 1. Executive Overview & Technical SEO Strategy

To build sustainable, high-authority organic backlink equity in the legal sector, Alwakeelo develops and maintains **interactive, high-utility technical web assets**. Rather than relying on generic content marketing, these assets solve recurring, mathematically rigorous, or research-intensive problems encountered daily by advocates, law clerks, litigants, scholars, and court reporters.

### 1.1 Technical Principles of Linkable Assets
1. **Zero-Friction Public Accessibility:** All linkable utilities are completely accessible without requiring user registration, authentication walls, or paywall truncation.
2. **Server-Side Rendered (SSR) Metadata:** Each tool provides crawler-accessible HTML headers including unique `<title>`, `<meta name="description">`, `<link rel="canonical">`, OpenGraph social cards, and Schema.org JSON-LD microdata.
3. **High-Value Utility Density:** Tools provide immediate utility—such as court fee calculations with copyable legal draft paragraphs, citation treatment graphs, and statutory section permalinks.
4. **Embeddable Distribution:** Every asset includes standardized iframe, JavaScript Web Component, and Markdown badge embed specifications for third-party law firms, bar association portals, and legal publications.

---

## 2. Technical Asset 1: Pakistani Court Fee & Valuation Calculator

### 2.1 Overview & Canonical Endpoint
- **Public URL:** `https://www.alwakeelo.com/court-fee-calculator`
- **Internal Engine Module:** `client/src/lib/court-fee.ts` (supplemented by `client/src/experimental/data/statutesCompendiumData.ts`)
- **Statutory Foundation:** 
  - Court Fees Act 1870 (Act VII of 1870 as amended provincially)
  - Suits Valuation Act 1887 (Act VII of 1887)
  - Provincial High Court Rules and Orders
  - Family Courts Act 1964 (Act XXXV of 1964) & Family Courts Rules
  - Stamp Act 1899 (Act II of 1899)

### 2.2 Supported Suit Types & Computational Algorithms
The calculator handles 15 distinct legal actions with automatic detection of value requirements, statutory articles, and provincial ceilings:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PAKISTANI COURT FEE ENGINE                          │
│                                                                             │
│  [User Selects Suit Type] ─────────► [Needs Pecuniary Valuation?]           │
│                                             │                               │
│                                    No ──────┴────── Yes                     │
│                                     │                │                      │
│                                     ▼                ▼                      │
│                              [Fixed Schedule]   [Ad Valorem Slab Engine]    │
│                              • Writ: Rs 100     • Slabs: 5% -> 7.5%         │
│                              • Injunction: Rs500• Max Cap: Rs 200,000       │
│                              • Family: Rs 500   • Revision: 50% Appeal Fee  │
│                              • Bail: Rs 25                                  │
│                                     │                │                      │
│                                     └───────┬────────┘                      │
│                                             ▼                               │
│                       [Output: PKR Fee, Formula, Plaint Paragraph]          │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Detailed Schedule Breakdown

| Suit Type Identifier | Descriptive Label | Input Requirement | Statutory Authority | Calculation Logic / Fee (PKR) |
| :--- | :--- | :--- | :--- | :--- |
| `money` | Money / Recovery Suit | `valueRs` (Numeric) | Schedule I, Article 1 | Slabs up to 7.5% (Capped at Rs. 200,000) |
| `property-declaration` | Declaration with Consequential Relief | `valueRs` (Market / Relief Value) | Schedule I, Article 1 | Ad valorem based on value of relief sought |
| `property-possession` | Possession of Immovable Property | `valueRs` (Market Value) | Schedule I, Article 1 | Ad valorem on market value |
| `specific-performance` | Specific Performance of Contract | `valueRs` (Consideration Value) | Schedule I, Article 1 | Ad valorem on contract consideration |
| `civil-appeal` | Civil Appeal against Decree | `valueRs` (Decree Value) | Schedule I, Article 1 | Same ad valorem fee as initial plaint |
| `civil-revision` | Civil Revision under S. 115 CPC | `valueRs` (Suit Value) | Schedule I, Article 1 | Exactly 50% of ad valorem appeal fee |
| `injunction` | Suit for Permanent Injunction | None (Fixed) | Schedule II, Article 17(iii) | Fixed Rs. 500 (Punjab/Federal) / Rs. 50 (General) |
| `family-maintenance` | Family Court — Maintenance Claim | None (Fixed) | Family Courts Rules | Fixed Rs. 500 / Rs. 15 statutory stamp |
| `family-khula` | Family Court — Khula / Dissolution | None (Fixed) | Family Courts Rules | Fixed Rs. 500 / Rs. 15 statutory stamp |
| `family-custody` | Custody / Guardians and Wards Act | None (Fixed) | Guardians & Wards Act 1890 | Fixed Rs. 500 |
| `writ-constitutional` | High Court Constitutional Writ (Art. 199) | None (Fixed) | Schedule II, Article 11 | Fixed Rs. 100 / Rs. 500 |
| `criminal-appeal` | Criminal Appeal | None (Fixed) | Schedule II, Article 11 | Fixed Rs. 100 |
| `bail-application` | Bail Application (S. 497/498 CrPC) | None (Fixed) | Schedule II, Article 1A | Fixed Rs. 25 |
| `vakalatnama` | Advocate Power of Attorney Form | None (Fixed) | Stamp Act 1899 + Court Fees | Rs. 25 stamp + Rs. 5 court fee = Rs. 30 |
| `general-misc` | Miscellaneous Judicial Application | None (Fixed) | Schedule II, Article 1A | Fixed Rs. 100 |

### 2.3 Ad Valorem Computational Slabs
The cumulative ad valorem algorithm implemented in `computeAdValorem(valueRs, province)` adheres strictly to the statutory brackets:
1. **Up to Rs. 25,000:** 5% of value (minimum threshold fee: Rs. 250).
2. **Rs. 25,001 to Rs. 100,000:** Rs. 1,250 + 6% of value in excess of Rs. 25,000.
3. **Rs. 100,001 to Rs. 500,000:** Rs. 5,750 + 7% of value in excess of Rs. 100,000.
4. **Rs. 500,001 to Rs. 1,000,000:** Rs. 33,750 + 7.5% of value in excess of Rs. 500,000.
5. **Above Rs. 1,000,000:** Rs. 71,250 + 7.5% of value in excess of Rs. 1,000,000.
6. **Statutory Ceiling Cap:** Enforces `PROVINCIAL_CEILING` of Rs. 200,000 (Punjab, Sindh, KPK, Balochistan, Islamabad).

### 2.4 Programmatic Valuation Paragraph Generator
For litigation practitioners, the calculator outputs a court-ready valuation paragraph formatted for direct inclusion into plaints:

> *"The value of the suit for the purposes of court fee and jurisdiction is fixed at Rs. [Value], upon which the requisite ad valorem court fee of Rs. [Calculated Fee] has been affixed in accordance with Schedule I, Article 1 of the Court Fees Act, 1870."*

---

## 3. Technical Asset 2: Landmark Cases & Most Cited Precedents

### 3.1 Overview & Canonical Endpoint
- **Public URL:** `https://www.alwakeelo.com/most-cited`
- **Internal Engine Module:** `client/src/experimental/pages/PreviewMostCited.tsx`
- **Underlying Dataset:** `shared/priority-judgments.json`, `citation_links` table (669,327 relationships)
- **Primary Search Intent:** Authoritative case law research, judicial citations, ratio decidendi lookup, moot court preparation.

### 3.2 Citation Ranking & Authority Algorithm
Rankings are dynamically calculated based on:
1. **Total Inbound Citations (`timesCited`):** Count of verified citations received from subsequent judgments across 75+ years of reporting.
2. **Court Hierarchy Weight:** Supreme Court of Pakistan rulings receive a 3x weight multiplier over High Court rulings.
3. **Treatment Classification:**
   - `relied_upon`: Positive authority reaffirming legal principle.
   - `referred_to`: Procedural or factual citation.
   - `distinguished`: Limited or distinguished on facts.
   - `overruled`: Negative treatment indicating invalidated precedent.

### 3.3 Dynamic Filters & Public Dimensions
- **Court Hierarchy Selector:** Supreme Court of Pakistan, Lahore High Court, High Court of Sindh, Peshawar High Court, High Court of Balochistan, Islamabad High Court, Federal Shariat Court.
- **Temporal Filter:** Filterable by decision year range (`minYear`, `maxYear`).
- **Subject Matter Categorization:**
  - *Constitutional Law:* Fundamental Rights (Articles 9, 10A, 14, 19, 25), Writ Jurisdiction (Article 199), Suo Motu & Original Jurisdiction (Article 184(3)), 26th Constitutional Amendment.
  - *Criminal Law & Procedure:* Bail Jurisprudence (S. 497 CrPC), Murder Trials (S. 302 PPC), Evidence Evaluation, Qatl-i-Amd.
  - *Civil Procedure & Property:* Specific Relief, Adverse Possession, Mesne Profits, Injunctions (Order XXXIX CPC).
  - *Commercial & Banking:* Financial Institutions Recovery (FIO 2001), Negotiable Instruments, Corporate Insolvency.
  - *Family & Succession:* Muslim Family Laws Ordinance 1961, Khula Dower Rights, Child Custody Welfare Doctrine.

---

## 4. Technical Asset 3: Pakistan Superior Court Judicial Directory

### 4.1 Overview & Canonical Endpoints
- **Public Directory URL:** `https://www.alwakeelo.com/judges`
- **Judge Profile Canonical Pattern:** `https://www.alwakeelo.com/judges/:name` (e.g. `/judges/mansoor-ali-shah`, `/judges/qazi-faez-isa`, `/judges/yahya-afridi`, `/judges/aamer-farooq`)
- **Internal Engine Modules:** `client/src/experimental/pages/PreviewJudges.tsx`, `PreviewJudgeProfile.tsx`

### 4.2 Judicial Profile Analytics Dimensions
Each public judge profile aggregates data from the underlying judgments database:
1. **Career Analytics:** Active judicial years, total authored opinions, total bench appearances.
2. **Bench Distribution:** Rulings delivered in Division Benches (DB), Full Benches, and Larger Benches.
3. **Subject Matter Concentration:** Case distribution breakdown across Constitutional, Criminal, Tax/Commercial, Civil, and Service matters.
4. **Authored Landmark Authorities:** Chronological index of cited landmark judgments authored by the judge with direct canonical permalinks (`/judgment/:uuid`).
5. **Recent Decisions Feed:** Real-time stream of newly uploaded and processed opinions.

---

## 5. Technical Asset 4: Consolidated Federal & Provincial Statutes Compendium

### 5.1 Overview & Canonical Endpoints
- **Public Compendium URL:** `https://www.alwakeelo.com/statutes`
- **Statute Search Endpoint:** `https://www.alwakeelo.com/statute-search`
- **Statute View Endpoint:** `https://www.alwakeelo.com/statute-view/:id`
- **Internal Engine Module:** `client/src/experimental/pages/PreviewStatutes.tsx` (supported by `majorEnactmentsData.ts`, `actsManifest.ts`, and `statutesCompendiumData.ts`)
- **Scope:** 83,117 sections across 5,887 federal and provincial Acts.

### 5.2 Flagship Enactments with Section-Level Permalinks
1. **Constitution of the Islamic Republic of Pakistan, 1973:**
   - Fully updated with all amendments through the 26th Constitutional Amendment Act, 2024.
   - Canonical permalinks: `/statutes#constitution-art-199`, `/statutes#constitution-art-184-3`, `/statutes#constitution-art-10a`.
2. **Pakistan Penal Code, 1860 (Act XLV of 1860):** 612 sections covering general exceptions, offences against human body, and property.
3. **Code of Criminal Procedure, 1898 (Act V of 1898):** 642 sections covering investigation, trial, bail, appeal, and revision.
4. **Code of Civil Procedure, 1908 (Act V of 1908):** 158 sections and Order I through Order LII with provincial amendments.
5. **Qanun-e-Shahadat Order, 1984 (President's Order No. 10 of 1984):** Law of evidence in civil and criminal proceedings.
6. **Specific Relief Act, 1877 (Act I of 1877):** Injunctions, declarations, and specific performance of contracts.
7. **Limitation Act, 1908 (Act IX of 1908):** Complete Schedule I articles with automated Section 4 court vacation / weekend rollover engine.

---

## 6. Embeddable Widget Specifications & Code Snippets

To facilitate distribution and backlink acquisition, external publishers (law firms, bar associations, legal bloggers, law reviews) can integrate Alwakeelo’s interactive tools directly into their websites.

### 6.1 Widget 1: Interactive Court Fee Calculator (Responsive iframe)
External law chambers and legal blogs can embed the court fee calculator into their client advisory or practitioner pages:

```html
<!-- Alwakeelo Pakistani Court Fee Calculator Embed -->
<div class="alwakeelo-calculator-container" style="width:100%;max-width:720px;margin:20px auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);">
  <iframe 
    src="https://www.alwakeelo.com/court-fee-calculator?embed=true&theme=light" 
    width="100%" 
    height="640" 
    frameborder="0" 
    scrolling="no" 
    loading="lazy"
    title="Pakistani Court Fee Calculator (Court Fees Act 1870)"
    style="border:none;display:block;"
  ></iframe>
  <div style="background:#f8fafc;padding:10px 16px;border-top:1px solid #e2e8f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;color:#64748b;display:flex;justify-content:space-between;align-items:center;">
    <span>Powered by <a href="https://www.alwakeelo.com/court-fee-calculator" target="_blank" rel="noopener" style="color:#0f766e;font-weight:600;text-decoration:none;">Alwakeelo Legal Intelligence</a></span>
    <span>Compliant with Court Fees Act 1870</span>
  </div>
</div>
```

### 6.2 Widget 2: Live Landmark Citation Badge (Dynamic SVG / HTML)
Law review editors and bloggers citing Pakistani case law can embed dynamic citation badges displaying citation treatment and authority metrics:

#### Markdown Syntax (for GitHub, Law Blogs, and Legal Markdown):
```markdown
[![Citation: PLD 2020 SC 686](https://www.alwakeelo.com/api/badge/citation/PLD-2020-SC-686.svg)](https://www.alwakeelo.com/judgment/PLD-2020-SC-686 "Verified by Alwakeelo Legal Precedent Graph")
```

#### HTML Pill Badge:
```html
<a 
  href="https://www.alwakeelo.com/judgment/PLD-2020-SC-686" 
  target="_blank" 
  rel="noopener"
  style="display:inline-flex;align-items:center;gap:6px;background:#f0fdf4;border:1px solid #bbf7d0;color:#166534;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;font-weight:600;padding:4px 10px;border-radius:9999px;text-decoration:none;"
  title="View verified judicial treatment on Alwakeelo"
>
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 12 2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>
  PLD 2020 SC 686 (Relied Upon)
</a>
```

### 6.3 Widget 3: Superior Court Judge Bench Card Embed
For court reporters and news publications covering judicial appointments and judgments:

```html
<div class="alwakeelo-judge-card" style="max-width:480px;border:1px solid #cbd5e1;border-radius:10px;padding:16px;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,sans-serif;">
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
    <div style="background:#0f766e;color:#ffffff;width:40px;height:40px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:18px;">⚖️</div>
    <div>
      <h4 style="margin:0;font-size:16px;color:#0f172a;">Hon'ble Mr. Justice Mansoor Ali Shah</h4>
      <p style="margin:2px 0 0;font-size:12px;color:#64748b;">Supreme Court of Pakistan</p>
    </div>
  </div>
  <p style="font-size:13px;color:#334155;line-height:1.5;margin-bottom:12px;">
    Authored 1,400+ reported judgments with high concentrations in Constitutional Rights, Administrative Law, and Environmental Jurisprudence.
  </p>
  <div style="border-top:1px solid #f1f5f9;padding-top:10px;display:flex;justify-content:space-between;align-items:center;font-size:12px;">
    <a href="https://www.alwakeelo.com/judges/mansoor-ali-shah" target="_blank" rel="noopener" style="color:#0f766e;font-weight:600;text-decoration:none;">
      View Complete Judicial Analytics →
    </a>
    <span style="color:#94a3b8;">Source: Alwakeelo</span>
  </div>
</div>
```

---

## 7. Legal Citation Guidelines for External Bloggers, Legal Media & Law Reviews

To foster uniform citation practices across the Pakistani internet, Alwakeelo provides the following citation standard for web publishers, law reviews, and practitioners.

### 7.1 Uniform Pakistani Legal Citation Standard (UPLCS)
Pakistani superior court judgments should be cited following this standard:

```
[Petitioner Name] v. [Respondent Name], [Law Report Citation], [Court Designation] ([Year of Decision])
```

#### Examples:
- **Supreme Court of Pakistan:**  
  *Justice Qazi Faez Isa v. President of Pakistan*, PLD 2021 SC 1, Supreme Court of Pakistan (2020).  
  *Digital Backlink Anchor:* `https://www.alwakeelo.com/judgment/PLD-2021-SC-1`
- **Lahore High Court:**  
  *Asghar Leghari v. Federation of Pakistan*, PLD 2018 Lahore 364, Lahore High Court (2015).  
  *Digital Backlink Anchor:* `https://www.alwakeelo.com/judgment/PLD-2018-Lahore-364`
- **Sindh High Court:**  
  *Messrs Trade Links v. Collector of Customs*, 2022 CLD 412, High Court of Sindh (2022).  
  *Digital Backlink Anchor:* `https://www.alwakeelo.com/judgment/2022-CLD-412`

### 7.2 Digital Linking & Attribution Rules for Web Publishers
When referencing Pakistani case law on external blogs, news websites, or law review articles:
1. **Hyperlink the Citation String:** Anchor the exact citation string (e.g. `2024 SCMR 128` or `PLD 2020 SC 686`) to Alwakeelo’s canonical URL.
2. **Canonical Slug Structure:** Publishers may use either the citation slug format (`https://www.alwakeelo.com/judgment/[REPORTER]-[YEAR]-[PAGE]`) or the canonical UUID format (`https://www.alwakeelo.com/judgment/[UUID]`). Both resolve to HTTP 200 via permanent 301 redirection.
3. **Statute Permalinks:** When citing specific sections of statutes, link directly to the statutory section anchor:
   - Constitution Article 199: `https://www.alwakeelo.com/statutes#constitution-art-199`
   - Section 497 CrPC: `https://www.alwakeelo.com/statutes#crpc-sec-497`
   - Section 12 Specific Relief Act: `https://www.alwakeelo.com/statutes#sra-sec-12`

### 7.3 Schema.org Structured Data Guidelines for Legal Publishers
External legal blogs and law reviews implementing Schema.org structured data should nest the Alwakeelo canonical citation record using `@id` references:

```json
{
  "@context": "https://schema.org",
  "@type": "LegalArticle",
  "headline": "Analysis of Landmark Constitutional Bail Jurisprudence in Pakistan",
  "author": {
    "@type": "Person",
    "name": "Barrister Ahmad Khan"
  },
  "publisher": {
    "@type": "Organization",
    "name": "Pakistani Law Review"
  },
  "citation": [
    {
      "@type": "CourtCase",
      "name": "Talat Ishaq v. State",
      "sameAs": "https://www.alwakeelo.com/judgment/PLD-2019-SC-112",
      "identifier": "PLD 2019 SC 112"
    }
  ]
}
```

---

## 8. Technical Verification & Performance Validation

To ensure all linkable assets meet rigorous technical SEO and performance benchmarks:

### 8.1 Verification Commands

```bash
# 1. Verify HTTP 200 status code on all public asset endpoints
curl -I -s https://www.alwakeelo.com/court-fee-calculator | head -n 5
curl -I -s https://www.alwakeelo.com/most-cited | head -n 5
curl -I -s https://www.alwakeelo.com/judges | head -n 5
curl -I -s https://www.alwakeelo.com/statutes | head -n 5

# 2. Verify Canonical and Meta Description Tags in HTML response
curl -s https://www.alwakeelo.com/court-fee-calculator | grep -iE 'canonical|description|og:title'

# 3. Verify Court Fee Calculation Unit Test Integrity
npx tsx --test tests/unit/exhaustive-production-readiness-audit.test.ts
```

### 8.2 SEO Health & Quality Targets
- **Lighthouse Performance Score:** ≥ 90/100 on desktop and mobile.
- **Cumulative Layout Shift (CLS):** < 0.05.
- **Largest Contentful Paint (LCP):** < 1.8 seconds.
- **Schema.org Validation:** Zero warnings or errors in Google Rich Results Test for `LegalArticle`, `CourtCase`, and `BreadcrumbList`.

---

*Alwakeelo Legal Technologies — Confidential Technical SEO Asset Specification. Built for production compliance with Milestone M4.*
