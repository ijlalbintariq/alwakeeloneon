# Public SEO and AEO fixes — 10 November 2026

Public blog, statute and directory URLs could return valid server HTML but become error or sign-in pages after JavaScript loaded. Preview components also changed public canonicals to preview URLs. This change restores the public routes and makes server, browser, navigation and sitemap identity rules agree.

## Resulting behavior

- Public and legacy-preview blog URLs render the correct bundled article immediately. Missing articles remain on their URL with an unavailable state and noindex metadata.
- Existing public statute readers and the judgment directory are restored. Statute navigation cancels obsolete requests and does not show a previous statute under the next URL. Directory API requests use proper query strings and render case links and pagination.
- Public marketing canonicals remain on their public URLs. Legacy marketing preview URLs permanently redirect, preserving query parameters. Authenticated workspace preview routes remain separate. Pricing and ownership-statement routes are supported by the active router.
- Runtime startup no longer overwrites server canonicals with the homepage. The runtime script version is changed so browsers request the corrected script.
- A retired judgment UUID redirects only to a currently confirmed, active canonical owner. Missing/archived records return 404; temporary judgment/statute lookup failures return retryable 503 responses instead of publishing a noindex fallback.
- Judgment sitemaps and the public directory use the same active/canonical/stored-own candidate requirements and independently check the actual case header. Header reads are bounded to 250 IDs per query and 16,000 characters per record. Contradictory, unconfirmed, missing and retired records are omitted; database failures do not fail open.
- Sitemaps derive all 48 bundled blog URLs from the article data and use real publication/update dates. Directory ordering and facet/page canonicals are deterministic. Candidate totals are explicitly distinguished from confirmed case counts.
- Server articles contain semantic headings, lists and links with raw HTML disabled. Statute previews are visible. Public directories and blog pages contain crawlable result/article links. Court breadcrumbs use the directory's supported court-ID filter.
- Structured data escapes script-closing characters in database-controlled titles. ESM-only Markdown renderers are bundled into the CommonJS server build.
- Guides identify the publisher, calculate read time, disclose that an individual legal reviewer is not recorded, and link to official research portals. Unsupported volume and absolute AI-accuracy claims in the affected public templates were softened. Research portals do not establish that each legal claim has been independently reviewed.

## Validation

**146 focused tests pass, with zero failures or skips. TypeScript and the client/server build pass.** Build warnings about large bundles remain; this change does not establish field Core Web Vitals results.

**16 Chrome browser checks pass** against the built frontend and the actual public HTML renderer. They cover the homepage, About, Blog, pricing, three guides, legacy marketing redirects, two real statutes, directory pagination and a real repaired alias/canonical judgment pair. The final assertions also confirm missing-record HTTP 404 and omission of previously sampled unconfirmed priority-sitemap judgments.

Validation used an isolated local server with a real PostgreSQL connection inside `BEGIN READ ONLY`. The app's select/execute methods were bound to that read-only connection. The validation server permitted only GET/HEAD requests and blocked external HTTP. Browser checks allowed local resources and required public fonts; advertising and AI endpoints were not used. Authentication was simulated as an anonymous visitor. Live production still needs post-deploy confirmation.

Evidence is saved under ignored `scratch/seo-aeo-audit-2026-11-10/`, including `local-browser-verification.json`, `local-browser.log`, the original production responses and audit summaries. Focused test logs are in `/tmp/alwakeelo-seo-fix-tests.log`, `/tmp/alwakeelo-seo-fix-typecheck.log` and `/tmp/alwakeelo-seo-fix-build.log`.

## Limits and follow-up

No production records, vector indexes or embeddings were changed. No paid AI, embedding or reranking calls were made. Existing database and hosting usage still applies.

An actual named legal reviewer and evidence of their review must come from the publisher; no credentials or review claims were fabricated. Official source links are research starting points, not independent authentication of guides or judgments.

These changes remove demonstrated technical obstacles. They do not guarantee rankings or AI citations. Search Console is still needed to establish Google's selected canonicals, indexing reasons, query positions and traffic changes after recrawling. The full judgment-database link audit remains a separate task.

See [the original production audit](seo-aeo-review-2026-11-10.md) for the reproduced defects and measurement limits.
