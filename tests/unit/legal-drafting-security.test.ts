import test from "node:test";
import assert from "node:assert/strict";
import {
  escapeHtml,
  LEGAL_DRAFT_PREVIEW_CSP,
  sanitizeLegalDraftHtml,
} from "../../server/legal-drafting-security";

test("sanitizeLegalDraftHtml removes executable preview content", () => {
  const sanitized = sanitizeLegalDraftHtml(`
    <script>alert(1)</script>
    <img src=x onerror="alert(2)">
    <p onclick="alert(3)">Safe pleading text</p>
    <a href="javascript:alert(4)" target="_blank">unsafe link</a>
    <iframe src="https://example.com"></iframe>
    <svg onload="alert(5)"></svg>
  `);

  assert.match(sanitized, /Safe pleading text/);
  assert.doesNotMatch(sanitized, /<script|<img|onerror|onclick|javascript:|<iframe|<svg|onload/i);
});

test("sanitizeLegalDraftHtml preserves legal document formatting", () => {
  const sanitized = sanitizeLegalDraftHtml(
    '<h1 style="text-align:center">PRAYER</h1><table><tr><th>S.No.</th><td colspan="2">Annexure A</td></tr></table>',
  );

  assert.match(sanitized, /<h1 style="text-align:center">PRAYER<\/h1>/);
  assert.match(sanitized, /<table>/);
  assert.match(sanitized, /colspan="2"/);
});

test("preview title escaping and CSP block script execution", () => {
  assert.equal(
    escapeHtml(`<img src=x onerror='alert(1)'>&"`),
    "&lt;img src=x onerror=&#39;alert(1)&#39;&gt;&amp;&quot;",
  );
  assert.match(LEGAL_DRAFT_PREVIEW_CSP, /script-src 'none'/);
  assert.match(LEGAL_DRAFT_PREVIEW_CSP, /frame-ancestors 'none'/);
});
