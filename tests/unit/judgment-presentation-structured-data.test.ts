import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildCanonicalUrl, injectSeoMeta } from "../../server/seo-meta";

describe("Milestone M2: Judgment Presentation, Headnotes & Legal Structured Data", () => {
  const sampleUuid = "ff8d297d-f10a-4f79-b4d2-b4c664091640";

  test("buildCanonicalUrl normalizes all judgment URL variants to singular /judgment/:uuid", () => {
    const pluralUrl = `/judgments/${sampleUuid}`;
    const singularUrl = `/judgment/${sampleUuid}`;
    const previewPUrl = `/preview/p/${sampleUuid}`;
    const previewPublicUrl = `/preview/public/judgments/${sampleUuid}`;

    assert.equal(
      buildCanonicalUrl(pluralUrl),
      `https://www.alwakeelo.com/judgment/${sampleUuid}`,
      "Plural /judgments/:uuid must resolve to singular canonical",
    );
    assert.equal(
      buildCanonicalUrl(singularUrl),
      `https://www.alwakeelo.com/judgment/${sampleUuid}`,
      "Singular /judgment/:uuid must resolve to singular canonical",
    );
    assert.equal(
      buildCanonicalUrl(previewPUrl),
      `https://www.alwakeelo.com/judgment/${sampleUuid}`,
      "Preview /preview/p/:uuid must resolve to singular canonical",
    );
    assert.equal(
      buildCanonicalUrl(previewPublicUrl),
      `https://www.alwakeelo.com/judgment/${sampleUuid}`,
      "Preview /preview/public/judgments/:uuid must resolve to singular canonical",
    );

    // Non-judgment routes remain unchanged
    assert.equal(buildCanonicalUrl("/"), "https://www.alwakeelo.com/");
    assert.equal(buildCanonicalUrl("/judgments"), "https://www.alwakeelo.com/judgments");
    assert.equal(buildCanonicalUrl("/judgments/browse"), "https://www.alwakeelo.com/judgments/browse");
    assert.equal(buildCanonicalUrl("/statutes"), "https://www.alwakeelo.com/statutes");
  });

  test("injectSeoMeta produces consistent canonical and OG tags for judgment routes", () => {
    const mockHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Al Wakeelo</title>
          <meta name="description" content="Default description" />
          <meta name="robots" content="index,follow" />
          <link id="canonical-link" rel="canonical" href="https://www.alwakeelo.com/" />
          <meta id="og-url-meta" property="og:url" content="https://www.alwakeelo.com/" />
          <meta property="og:title" content="Al Wakeelo" />
          <meta property="og:description" content="Default" />
          <meta name="twitter:title" content="Al Wakeelo" />
          <meta name="twitter:description" content="Default" />
        </head>
        <body>
          <div id="root"></div>
        </body>
      </html>
    `;

    const customMeta = {
      title: "2024 SCMR 100: Federation of Pakistan v. Public Interest",
      description: "Supreme Court of Pakistan constitutional judgment on fundamental rights.",
      index: true,
      schemaMarkup: `<script type="application/ld+json">{"@context":"https://schema.org","@type":"LegalArticle"}</script>`,
    };

    const injected = injectSeoMeta(mockHtml, `/judgments/${sampleUuid}`, customMeta);

    // Canonical link must point to singular /judgment/:uuid even when plural was requested
    assert.match(
      injected,
      new RegExp(`<link id="canonical-link" rel="canonical" href="https://www.alwakeelo.com/judgment/${sampleUuid}" />`),
    );
    assert.match(
      injected,
      new RegExp(`<meta id="og-url-meta" property="og:url" content="https://www.alwakeelo.com/judgment/${sampleUuid}" />`),
    );
    assert.match(injected, /<title>2024 SCMR 100: Federation of Pakistan v\. Public Interest<\/title>/);
    assert.match(injected, /{"@context":"https:\/\/schema\.org","@type":"LegalArticle"}/);
  });

  test("server/static.ts enforces 301 redirects from /judgments/:uuid to /judgment/:uuid", () => {
    const staticTsPath = path.resolve(process.cwd(), "server/static.ts");
    const staticContent = fs.readFileSync(staticTsPath, "utf-8");

    // Check for explicit app.get 301 redirect route
    assert.ok(
      staticContent.includes("/^\\/judgments\\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i") &&
      staticContent.includes("res.redirect(301, qs ? `/judgment/${id}?${qs}` : `/judgment/${id}`)") &&
      staticContent.includes("Enforce singular /judgment/:uuid canonical route with 301 redirect"),
      "server/static.ts must register explicit 301 redirect route for legacy plural URLs to singular canonical URL",
    );
  });

  test("server/static.ts generates Schema.org @graph with LegalArticle, CourtCase, and BreadcrumbList", () => {
    const staticTsPath = path.resolve(process.cwd(), "server/static.ts");
    const staticContent = fs.readFileSync(staticTsPath, "utf-8");

    // Verifies Schema.org @graph multi-entity structure
    assert.ok(staticContent.includes('"@graph": ['), "Must output Schema.org @graph");
    assert.ok(staticContent.includes('"@type": "LegalArticle"'), "Must include LegalArticle");
    assert.ok(staticContent.includes('"@type": "CourtCase"'), "Must include CourtCase");
    assert.ok(staticContent.includes('"@type": "BreadcrumbList"'), "Must include BreadcrumbList");
    assert.ok(staticContent.includes("parseBenchJudges"), "Must parse bench judges into Person entities");
    assert.ok(staticContent.includes("bench: judgments.bench"), "Must select judgments.bench from DB");
  });

  test("server/storage.ts and server/routes.ts expose bench in JudgmentDetail and API response", () => {
    const storageTsPath = path.resolve(process.cwd(), "server/storage.ts");
    const storageContent = fs.readFileSync(storageTsPath, "utf-8");

    assert.ok(storageContent.includes("bench: string | null;"), "JudgmentDetail must declare bench field");
    assert.ok(storageContent.includes("bench: judgments.bench,"), "getJudgmentDetail must select judgments.bench");
    assert.ok(storageContent.includes("bench: row.bench || null,"), "getJudgmentDetail must return bench");

    const routesTsPath = path.resolve(process.cwd(), "server/routes.ts");
    const routesContent = fs.readFileSync(routesTsPath, "utf-8");

    assert.ok(routesContent.includes("bench: judgment.bench || null,"), "GET /api/public/judgments/:id must return bench");
  });

  test("client PreviewPublicJudgment.tsx implements useDocumentHead, bench badge, structured headnotes, and Schema.org @graph", () => {
    const clientPagePath = path.resolve(process.cwd(), "client/src/experimental/pages/PreviewPublicJudgment.tsx");
    const clientContent = fs.readFileSync(clientPagePath, "utf-8");

    // Bench in PublicJudgmentData interface
    assert.ok(clientContent.includes("bench?: string | null;"), "PublicJudgmentData must declare bench");

    // Gavel and User icons imported
    assert.ok(clientContent.includes("Gavel"), "Must import and use Gavel icon");
    assert.ok(clientContent.includes("User"), "Must import and use User icon");

    // Canonical destinations are checked by the mounted reader navigation tests.
    assert.ok(clientContent.includes("useDocumentHead({"), "Must invoke useDocumentHead");

    // Bench rendering in document header alongside Court and Date
    assert.ok(clientContent.includes("Bench:"), "Header must display Bench alongside Court and Date");
    assert.ok(clientContent.includes("Presiding Bench / Coram"), "Must render Presiding Bench card");

    // Headnotes parser
    assert.ok(clientContent.includes("parsePakistaniHeadnotes"), "Must define parsePakistaniHeadnotes");
    assert.ok(
      clientContent.includes("Reported Headnotes &amp; Statutory Catchwords"),
      "Must render structured headnotes title",
    );
    assert.ok(clientContent.includes("Official Editorial Headnotes Not Reported"), "Must provide graceful fallback for null headnotes");

    // Schema.org @graph JSON-LD
    assert.ok(clientContent.includes('"@graph": ['), "Must build Schema.org @graph");
    assert.ok(clientContent.includes('"@type": "LegalArticle"'), "Must include LegalArticle in client JSON-LD");
    assert.ok(clientContent.includes('"@type": "CourtCase"'), "Must include CourtCase in client JSON-LD");
    assert.ok(clientContent.includes('"@type": "BreadcrumbList"'), "Must include BreadcrumbList in client JSON-LD");
    assert.ok(clientContent.includes('type="application/ld+json"'), "Must render application/ld+json script tag");
  });
});
