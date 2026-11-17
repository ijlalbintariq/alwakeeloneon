# Google judgment indexing investigation — 17 November 2026

## Findings

Input: alwakeelo.com-Coverage-Validation-2026-11-17.xlsx. Parsed the XLSX as data, without executing workbook content. Its Table sheet contains 2,000 judgment URLs: 1,000 validation statuses Failed and 1,000 Pending. These are validation statuses, not a fresh URL Inspection verdict. Its Metadata sheet identifies “Crawled - currently not indexed” across “All known pages.” Crawl dates in the export span 6–15 November 2026. The approximately 106,000 affected-page total comes from the user's Search Console report, not from the 2,000-row export.

Live sample: ten unique judgment URLs, comprising three provided in chat and seven spread across the export. All returned HTTP 200, an indexable robots directive, and a self-referencing canonical URL. Initial judgment HTML contained 3,152–26,841 text characters. This sample is small and purposive; it cannot establish the prevalence of an issue across 106,000 URLs. Full results: google-indexing-sample-2026-11-17.json.

On /judgment/2e28cd36-0df6-43d7-901b-99d02b78e479, Chrome's DOM mutation trace reproduced this sequence:

1. Server HTML: case-specific title, judgment text and index,follow.
2. JavaScript startup: deletes the server's judgment text before the reader has data.
3. Reader loading: replaces metadata with noindex,nofollow while requesting the same judgment from /api/public/judgments/:id.
4. Successful response: restores judgment text and index,follow.

That is an avoidable rendering/indexability inconsistency. Slow or failed requests can leave an important public page without its original content and metadata. It is a demonstrated defect, but is not proof of the sole cause of Google's exclusion decisions.

Google API credential check: no credentials configured (tier -1). No connected Search Console tool was available. Google's chosen canonical, rendered snapshot, crawl logs, manual actions and actual index status could not be inspected. No sitemap submission or validation restart was performed.

## Fix implemented

- Confirmed public judgment HTML carries safely escaped JSON containing only fields already permitted in the public reader. Unconfirmed records do not get this data.
- The reader initializes from that same verified record rather than starting with a blank, noindex state.
- Initial judgment text remains in the document until the reader takes over. The canonical URL, title and indexability remain case-specific during the handoff.
- A temporary refresh failure retains the initial public record. A definitive 404/410 or newly unconfirmed record still removes indexability; identity safeguards are preserved.
- Payloads cannot be reused for a different judgment ID. Unchecked headnotes and private fields are excluded. The existing 25,000-character initial-text limit remains; longer judgments show an explicit preview notice until the full API record arrives.
- Public API refresh remains in place to load full text, headnotes and citation relationships.

No changes to robots access, mass content generation, blanket indexing of unverified cases, database identity labels or forced URL submission were needed for this defect.

## Validation

- TypeScript check and focused server HTML, public navigation, canonical, sitemap and SEO tests.
- Regression cases cover initial HTML data, delayed/failed refresh, changed identity, cross-record navigation, removal, and escaping script-like judgment text.
- Chrome local preview using the real public sample record, with an eight-second delayed API request followed by a simulated 503: case title and text stayed visible and observed robots values stayed index,follow throughout. No temporary noindex appeared.
- Live Google indexing improvement is not established by these local checks.

## Deployment and Search Console follow-up

1. Deploy this fix through the normal main-branch release process. After deployment, inspect the affected sample without JavaScript and with a throttled connection; verify the case title/text, canonical URL and robots directive remain consistent.
2. In Search Console, inspect a few representative Failed URLs from the export. Compare Google-selected and user-declared canonicals, last crawl and fetched/rendered HTML. Use “Test live URL” and confirm indexing is allowed. A passing live test is eligibility, not a promise of indexing.
3. Request indexing for a few important, confirmed examples after the live fix is verified. Use normal sitemap discovery for the larger corpus. The Google Indexing API is restricted to eligible JobPosting and livestream pages, not judgment libraries.
4. Start a new validation run only after the live checks pass. Track sampled URLs' recrawl dates and index statuses; validation and index updates are asynchronous. A failed validation can persist if other pages have distinct problems.
5. If URLs are recrawled after the fix but remain excluded, investigate corpus-level duplication, OCR quality, complete source text, inaccurate captions, meaningful internal links and independent source value. Samples show some noisy/truncated captions; no unverified legal corrections were made. Do not pad judgments with generated text to meet arbitrary word counts.

## Sources

- Google Page indexing report: https://support.google.com/webmasters/answer/7440203?hl=en — “Crawled - currently not indexed” does not itself prove a technical failure; Google does not index every page.
- Google URL Inspection: https://support.google.com/webmasters/answer/9012289?hl=en — use URL-level evidence to assess crawl, canonical and indexing state.

Release status at report creation: local changes tested; not yet deployed or validated in Search Console.
