# AlWakeelo SEO and AEO review — 10 November 2026

## Conclusion

The strongest confirmed obstacle is a mismatch between the production frontend router and the server's public SEO routes. The frontend was switched to preview components, but public URLs, article slug parsing, canonicals and server-rendered content were not migrated consistently. As a result, some useful public pages become error screens or sign-in pages after JavaScript executes, and marketing pages change their canonical URLs to the preview namespace.

Separate judgment SEO code also bypasses canonical ownership resolution used by the API. Sitemap eligibility does not match the actual identity/indexability rules.

These are observed technical defects and credible obstacles to search discovery, indexing and answer extraction. They do not prove the amount of traffic lost or explain every keyword position. Public web search does find the site, guides and judgments. A claim that the entire domain is unindexed or penalized would be unsupported.

## Scope and evidence

- Production `/health` reported main commit `01b36657bff2dd5367e24dcec9fa07c2dbc62d3e`.
- Fetched the live robots file, sitemap index, static sitemap, priority and tier-2 judgment sitemaps, first general judgment sitemap and first statute sitemap.
- Inspected 79 distinct HTML URLs: all 58 URLs in the static sitemap, 12 judgments selected from three sitemap files, four statute pages, a known repaired alias and its canonical owner, and three additional preview/workspace URLs. This is a bounded template audit, not an audit of all approximately 250,000 judgments.
- All 79 raw HTML requests returned HTTP 200. That did not establish correct rendered content.
- Performed 13 Chrome navigation checks across 12 unique URLs, including mobile and desktop homepage checks, three public blog articles, their working preview counterpart, two statute pages, a judgment directory, and an alias/owner pair.
- Inspected relevant frontend routing, metadata, server rendering, sitemap, blog and identity code. No application code or production records were changed. No paid model, embedding or reranking services were called.
- Detailed raw responses, parsed metadata, browser text, screenshots, timings and source references are in the ignored local directory `scratch/seo-aeo-audit-2026-11-10/`.

## Confirmed findings, in priority order

### 1. Critical: public blog articles become “Article Not Found”

Three valid public article URLs returned the complete article in server HTML, but the browser then replaced it with “Article Not Found” and the generic title “Legal Guide | Al Wakeelo”:

- `/blog/section-489f-ppc-dishonoured-cheque-pakistan`
- `/blog/ai-for-legal-drafting`
- `/blog/understanding-bail-criminal-procedure-pakistan`

The cheque article renders successfully at `/preview/blog/section-489f-ppc-dishonoured-cheque-pakistan`.

Root cause: `client/src/experimental/AppPreviewRouter.tsx:120` mounts `PreviewBlogDetail` at `/blog/:slug`, but `client/src/experimental/pages/PreviewBlogDetail.tsx:11` extracts parameters only from `/preview/blog/:slug`. The public slug is undefined, its query is disabled and the bundled article lookup fails. `client/src/main.tsx:5` removes the server prerender before the React view renders.

**Fix first:** make the article component recognize the actual public route, use the same article identity on server and client, and make the public URL canonical. Preserve existing working links through deliberate redirects. Validate several articles through a real browser and Google Search Console live inspection; checking raw HTTP alone will miss this defect.

### 2. Critical: public statute URLs and the browse directory are absent from the active frontend router

The live statute sitemap advertises 5,906 `/statute-view/<id>` URLs. Raw HTML for the four sampled statutes contains indexable titles and statute snippets. Browser checks of `/statute-view/1` and `/statute-view/2` both ended at `/preview/auth`, with sign-in content and `noindex,nofollow`.

`/judgments/browse`, which is included in the static sitemap, becomes “Record Not Found” after JavaScript. Its rendered canonical changes to `/judgment/browse` and its robots directive becomes `noindex,nofollow`.

Root cause: `client/src/App.tsx:102` sends all paths through `AppPreviewRouter`. That router has no `/statute-view/:id` route; its catch-all at `AppPreviewRouter.tsx:274` redirects to the dashboard, which sends unauthenticated users to sign-in. It also has `/judgments/:id` at line 198, which captures `browse` as a judgment ID instead of a directory route.

**Fix first:** restore an intentional public statute-reader route and put an explicit browse-directory route ahead of dynamic judgment routes. If a page is intentionally private, remove it from the public sitemap instead of presenting contradictory public SEO content. Verify that valid public pages remain readable without authentication after JavaScript executes. The missing route is structural; this review did not browser-check all 5,906 statute URLs.

### 3. High: public canonicals change to preview URLs after JavaScript

Observed in both homepage browser checks and the About/blog checks:

| Requested public URL | Raw canonical | Rendered canonical |
| --- | --- | --- |
| `/` | `/` | `/preview` |
| `/about` | `/about` | `/preview/about` |
| `/blog` | `/blog` | `/preview/blog` |

`/preview` itself returns HTTP 200 and an indexable generic “Chambers Workspace Preview” title in raw HTML. Navigation also promotes preview URLs while the sitemap promotes public URLs.

Root cause: preview pages hardcode their old paths in `useDocumentHead`: `PreviewLanding.tsx:207`, `PreviewAbout.tsx:10`, `PreviewBlog.tsx:13`. `client/src/hooks/use-document-head.ts:31` overwrites the server canonical with those values. The production router mounts these same components at both namespaces.

**Fix:** define one public canonical route map shared by server and client. Update navigation and metadata, then permanently redirect duplicate marketing preview URLs to their public equivalents. Do not redirect unrelated authenticated preview workspace routes indiscriminately. Check raw HTML, rendered HTML, canonical tags, OG URLs, internal links and redirect destinations together.

Google specifically recommends that JavaScript not change a canonical to a different URL from the one in the original HTML. [Google JavaScript SEO guidance](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)

### 4. High: repaired old judgment URLs return contradictory initial SEO HTML

Reproduced using this already repaired pair:

- Old UUID: `00eb9c2c-3b26-428d-9d4f-1531ef378929`
- Canonical owner: `aff23d45-99f0-4a16-bfc4-cc6f4d6ed19d`

The old UUID's public API correctly returns **1971 PCRLJ 1285 — AURANGZEB vs THE STATE**, owner UUID `aff23d45-99f0-4a16-bfc4-cc6f4d6ed19d`, integrity `own`. The browser eventually shows this correct owner and canonical.

However, the initial HTML for the old UUID says **1960 PLD 111 — Judgment identity unverified**, includes `noindex,nofollow` and self-canonicalizes the old UUID. Requests using Googlebot and OAI-SearchBot user-agent strings reproduced the same response. Those user-agent checks test response behavior; they are not proof of actual crawler visits.

Root cause: `server/static.ts:182` queries the requested judgment row directly, without selecting or following its `canonical_judgment_id`. The API and client reader do follow ownership. Initial SEO and final reader therefore disagree. This is a separate HTML-rendering defect; it does not invalidate the previously verified canonical API response or stored body repair.

**Fix:** reuse validated canonical resolution for HTML and permanently redirect a proven alias to its active canonical owner. Keep safety checks for missing, chained or unconfirmed owners. Do not remove identity safeguards to make a URL indexable.

Google may skip rendering after encountering an initial `noindex`, so relying on client JavaScript to replace that directive can fail. [Google robots-meta and JavaScript guidance](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)

### 5. High: sitemaps advertise non-indexable judgments

Seven of the 12 judgment URLs selected from sitemap files returned `noindex,nofollow` and an unverified identity in raw HTML: two of four priority samples, all four tier-2 samples and one of four general samples. This sample was selected by position, not randomly; **7/12 is not an estimate for the whole database**.

Example priority URL: `/judgment/d999cf0b-42f9-48ff-b4dc-00aa62d8762b`.

Root cause: `server/sitemap.ts:52` excludes stored `mislabeled` records but permits unknown/null states that the runtime identity assessment may withhold. Priority and tier-2 handlers at lines 283–286 and 311–314 similarly exclude only stored mislabeled states, use static inventories and fail open when provenance lookup fails. This does not establish that every advertised record is a valid, active, canonical, indexable judgment.

**Fix:** share the actual indexability rules, exclude unconfirmed and retired records, and emit only valid canonical URLs. Keep unconfirmed pages withheld until source evidence supports them. Never remove `noindex` from unsafe judgments merely to satisfy a sitemap. Recheck sampled and changed sitemap URLs after deployment.

### 6. High for AEO and discovery: useful content has weak server-rendered structure and internal links

Raw `/judgments`, `/judgments/browse`, `/blog` and `/about` contain no `<a>` elements. The blog landing lists guide names without article anchors; the judgment directory fallback contains generic descriptive text rather than crawlable case listings and pagination. The browser supplies some navigation, but public pages should offer useful crawl paths in their initial HTML as well.

The cheque guide's raw article has zero H2 elements and zero anchors. `server/static.ts:918` escapes its complete Markdown into a single `<div>`, retaining literal Markdown markers instead of semantic headings, lists and source links.

All four sampled statute pages have `display:none; aria-hidden=true` on their SEO content block (`server/static.ts:772`); the excerpt is truncated. The browser subsequently removes that block, and the missing statute route leads to authentication. This is an observable rendering/accessibility mismatch, not evidence of a confirmed cloaking penalty.

**Fix:** render the same useful, visible content on server and client; safely render Markdown as HTML; provide real result links, court/topic directories and pagination. Fix broken public routes before expanding the content inventory.

### 7. High for legal trust: guides do not identify accountable legal reviewers or primary sources

The bundled dataset contains 48 articles, with zero author fields, zero reviewer fields and zero external HTTP source URLs in article bodies. JSON-LD uses the generic organization “Al Wakeelo Legal Team”; the rendered guide template has dates/read times but no named reviewer. Organization authorship is permitted, but readers cannot identify who checked a specific legal explanation.

**Fix:** add real author/reviewer profiles and applicable credentials, primary statute/judgment links, review dates and clear limits. Do not invent reviewers, sources or endorsements. Check publication claims such as “600,000+ judgments” and claims that hallucinations are eliminated against a published, defensible coverage and verification methodology. This audit did not query fresh database totals and does not establish that every numerical claim is false.

Google emphasizes trustworthy sourcing, clear authorship and reliability, especially for topics that can affect people's wellbeing. This is not a claim that an author field alone is a ranking factor. [Google helpful-content guidance](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)

## Secondary findings

- Seven of the 48 bundled article slugs are absent from the static sitemap. Generate the article sitemap from the actual public article inventory after fixing the public route.
- `/cases` and `/case-files` return indexable homepage metadata and self-canonicals despite being workspace routes. `/preview/blog/ai-for-legal-drafting` is separately indexable. Use explicit rules for public pages, private workspaces and true errors.
- A nonexistent valid-format judgment UUID returned HTTP 200 with a generic noindex fallback. The HTML SEO path also merges missing records, query saturation and timeouts. Distinguish a real 404 from a transient 503; do not turn a temporary database problem into a valid page's noindex response.
- Several sitemap handlers assign today's date regardless of real content modification. Use truthful modification dates.
- `llms.txt` exists and recommends citation links, whereas MCP returns validated UUID links. Keep documentation consistent with actual ambiguity checks and canonical policy. One advertised example `/judgment/PLD-2024-SC-100` returned 404; examples are not evidence that the underlying case must exist.

## What is already working

- The site is publicly reachable and appears in public web search results.
- Robots allows general crawling; no explicit block for Googlebot, OAI-SearchBot or PerplexityBot was observed. The specific blocks are Bytespider, PetalBot and Amazonbot.
- The sitemap index and sampled sitemap files return valid XML from the canonical `www` host.
- Useful canonical judgment pages can return proper case identity and indexable content.
- Structured data already exists, including organization/site, article, breadcrumb and legislation markup. More schema alone will not fix broken routes.
- Independent brand presence exists, including Stanford CodeX and LegalTechCircle listings. No backlink count or domain-authority score was measured, so “no backlinks” is not a supported explanation.

## AEO interpretation

For Google AI Overviews and AI Mode, a page must be indexed and eligible for a search snippet. Fixing public routing, consistency, crawl paths and reliable content therefore comes before special AI files or extra markup. Google does not require a special AI schema or `llms.txt` for these features. [Google AI features](https://developers.google.com/search/docs/appearance/ai-features), [Google generative AI optimization guide](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide)

For ChatGPT search, OAI-SearchBot access matters; GPTBot controls training and is a separate choice. Access does not guarantee selection or citation. This review did not measure answer citations across AI platforms. [OpenAI crawler documentation](https://developers.openai.com/api/docs/bots)

## Performance observations and limits

The initial mobile-viewport homepage run observed LCP around 2.44 seconds on this Mac and connection, without mobile CPU/network throttling. Desktop runs varied from roughly 1.2 to 2.86 seconds. These are individual local observations, not field Core Web Vitals results and not a basis for declaring the site globally fast or slow. INP and real-user CLS were not measured.

The homepage loaded approximately 0.70 MB encoded / 2.24 MB decoded JavaScript in that run, including third-party advertising. The blog loaded the full shared article-data bundle. Reducing unnecessary public-page JavaScript is a worthwhile follow-up, but the routing and indexability defects are more directly demonstrated than a performance-based ranking diagnosis.

## Prioritized action plan and acceptance checks

1. **Restore public routes and article parsing.** Public blog articles, statute readers and the browse directory must render their intended content without authentication. Check fresh direct navigation, client navigation and JavaScript-disabled/raw responses. No valid article may become an error screen.
2. **Unify canonical URLs and internal links.** Public and rendered canonicals must agree. Confirm deliberate permanent redirects from duplicate marketing preview URLs and proven judgment aliases. Keep unrelated workspace routes intact.
3. **Align sitemaps with actual indexability.** Every advertised page must exist and be intended for indexing. Correctly withheld judgments stay withheld and are removed from indexable inventories.
4. **Make rendered content consistent and discoverable.** Use semantic visible server content, real directory/article anchors and pagination. Separate genuine missing pages from transient errors and private routes.
5. **Strengthen legal evidence and accountability.** Add genuine reviewer attribution and primary sources to the most valuable guides, then verify answer accuracy and coverage claims before expanding content.
6. **Validate in Search Console and monitor.** Inspect the homepage, a guide, statute, canonical judgment and old alias. Compare selected canonicals, indexing reasons, rendered HTML and crawl outcomes. Monitor indexed canonical pages and query impressions/CTR/positions over time; rankings are not guaranteed after technical fixes.

## Unavailable evidence

No authenticated Search Console or Analytics access was available. Local SEO credential checks found none configured. An OpenSEO integration supporting connected Search Console data was discovered, but it is not installed or connected in this session. The user can install it and connect the relevant property for the next diagnostic step.

Consequently, exact keyword rankings, impressions, click losses, Google's selected canonical, indexing totals, manual actions, backlink metrics, field Core Web Vitals and actual Google/ChatGPT citation share remain unmeasured. No numerical health score is assigned to these unmeasured categories.
