# Al Wakeelo case-law AEO / GEO implementation

Date: 17 November 2026. Scope: public homepage, case-law search, crawler guidance and research messaging. Changes are local; deployment has not been performed.

## Evidence and readiness

The live homepage and /judgments returned readable, server-rendered text through web inspection. The existing application already has per-route metadata, public judgment permalinks, structured data, an XML sitemap and an llms.txt file. The highest-value gap in this pass was clear, consistent product information rather than more schema or more pages.

No numerical visibility or platform scores are assigned: Search Console, Bing Webmaster Tools, production crawler logs and ChatGPT citation measurements were not available. Google AI features, ChatGPT and Perplexity visibility remain unmeasured. Local technical readiness is improved, not proof of indexing or recommendations.

## Implemented

- A single shared research guide renders visibly on the homepage and case-law search page, and in their initial server HTML. It answers what the app does, how to search citations, coverage limits and how to verify results. Answers stand alone, without artificial word-count targets.
- Canonical /judgments title and description are shared by its active React page and server metadata. Workspace previews remain noindex.
- Search screen no longer asserts an unverified 600,000+ judgment count. Homepage Reddit endorsement claims were replaced with a feedback route.
- Explicit OAI-SearchBot and PerplexityBot access in robots.txt. The existing wildcard already allowed these crawlers: this makes the policy explicit, rather than resolving a demonstrated block. GPTBot's existing training policy is unchanged.
- Existing llms.txt now describes available records and source verification without an unsupported database count or first-in-market claim. It is a navigation aid, not a ranking mechanism.
- Existing Organization, WebSite and SoftwareApplication markup retained. No invented reviews, ratings, credentials or AI-specific schema added. Existing FAQ markup is not a promise of a search feature.

## Crawler access

Local robots.txt permits OAI-SearchBot, ChatGPT-User, GPTBot, Googlebot, Bingbot, ClaudeBot and PerplexityBot (explicitly or through wildcard). Bytespider, PetalBot and Amazonbot remain blocked. Authentication and private-route protections remain necessary; robots rules do not grant data access.

Live robots.txt could not be fetched: web access returned an error and shell curl failed DNS resolution. Production CDN/WAF behavior, crawler IP access and live sitemap contents were not verified. Public homepage and search HTML were accessible through the web tool.

## Brand evidence

Search found Al Wakeelo's LinkedIn posts and founder commentary. These are first-party statements, not independent product validation. The limited searches did not surface a confirmed Wikipedia entry, Reddit discussion or YouTube channel; this is not evidence that none exist. No posts, outreach or directory submissions were made.

Example evidence: https://www.linkedin.com/posts/ijlalbintariqamin_legaltech-pakistanlaw-ai-activity-7472380365916172288-Bei9

## Next actions and success checks

1. Deploy the changes through the normal release process. Fetch / and /judgments without JavaScript and check that all four research answers, canonical URLs and indexable metadata appear. Check robots.txt and hosting rules for OAI-SearchBot. Failure signal: missing text, redirects to sign-in, 403 responses or crawler challenges.
2. In verified Google Search Console and Bing Webmaster Tools, submit https://www.alwakeelo.com/sitemap.xml and inspect /judgments plus representative eligible judgment records. This requires account access. Track indexed pages and crawl errors; eligibility alone does not guarantee indexing.
3. Audit published legal guides for unsupported statistics, case references and reviewer credentials before promoting them. Record real legal review and source links where performed. This pass did not validate the full legal blog corpus; broad accuracy claims remain elsewhere. Do not invent reviewers or update dates simply for freshness.
4. Publish a first-hand case-law search demonstration using a verified public judgment, its source and the actual search result. Link it from the relevant research page; share through the owner's real professional channels. Measure qualified visits and source links rather than manufacturing endorsements.
5. Establish a weekly baseline for "Pakistani case law research app", "search PLD and SCMR judgments online", "AI legal research Pakistan" and "Al Wakeelo case law". Record platform, date, prompt, cited URLs and whether search was enabled. Track ChatGPT referral visits and genuine OAI-SearchBot requests separately. No baseline recommendations were measured in this pass.

## Verification

TypeScript check passed. Public SEO server/client and judgment sitemap indexability suites: 26 tests passed, including rendering the shared research answers without JavaScript. Tests used no production database. Production deployment and visual browser inspection were not performed.

## Primary guidance

- OpenAI crawler documentation: https://developers.openai.com/api/docs/bots — OAI-SearchBot controls search discovery; GPTBot concerns model training, and ChatGPT-User handles user-triggered visits. This corrects the GEO skill's conflation of GPTBot with search.
- Google AI features: https://developers.google.com/search/docs/appearance/ai-features — ordinary SEO, indexable text, internal links and visible-content/schema agreement matter. No special AI text file or schema is required, and inclusion is not guaranteed.

AEO/GEO can improve discoverability. It cannot force ChatGPT to recommend Al Wakeelo, and website optimization does not constitute a ChatGPT app-directory submission.

## Public judgment detail pages — follow-up implementation

Applied the same approach to /judgment/{id}. Shared record-based metadata now supplies the server HTML and React reader. A visible citation summary identifies the case, recorded citation, court and decision date; a canonical permalink and verification guidance accompany it. No legal holding or outcome is generated from metadata.

Replaced duplicated LegalArticle/CourtCase graphs with Schema.org WebPage, CreativeWork and BreadcrumbList. Removed journal abbreviations incorrectly used as ISSNs, guessed case-number values, inferred party entity types, court-as-Person authors and decision dates labelled as publication dates. Unknown fields are omitted. The reader removes the initial server judgment graph when React takes ownership to avoid duplicates or stale identity data. Unverified records still receive no confirmed-case graph or citation summary and remain noindex.

Validation: TypeScript passed; 32 targeted tests passed, including record navigation, sitemap identity safeguards, safe HTML rendering, missing/invalid dates, metadata agreement and a single graph after mounting. No production database or browser visual review was used. Changes remain local and require deployment.

Schema references: https://schema.org/WebPage and https://schema.org/CreativeWork. These are descriptive markup, not a special AI ranking requirement.
