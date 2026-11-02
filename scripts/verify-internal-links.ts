/**
 * scripts/verify-internal-links.ts
 *
 * Automated Route & Link Crawler for Alwakeelo Legal Platform.
 * Verifies internal links across:
 *  1. Known SPA routes (whitelisted static and public tool routes)
 *  2. Judgment permalinks (/judgment/:uuid)
 *  3. Plural canonical redirect routes (/judgments/:uuid -> 301 -> /judgment/:uuid)
 *  4. In-text citation links and citation slug resolution routes
 *
 * Asserts:
 *  - All valid routes return HTTP 200 or valid HTTP 301 redirects
 *  - ZERO HTTP 404 or HTTP 500 errors across valid routes
 *  - All redirects consolidate to canonical singular URLs
 *
 * Outputs summary report to reports/internal-links-report.json.
 */

import express from "express";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { registerRoutes } from "../server/routes";
import { serveStatic, isKnownSpaRoute, KNOWN_SPA_ROUTES, linkifyCitationsInHtml } from "../server/static";

export interface RouteCheckResult {
  url: string;
  category: "known_spa" | "judgment_permalink" | "plural_redirect" | "citation_link" | "negative_check";
  expectedStatus: number | number[];
  actualStatus: number;
  statusText: string;
  redirectLocation?: string | null;
  responseTimeMs: number;
  passed: boolean;
  notes?: string;
}

export interface InternalLinksReport {
  timestamp: string;
  serverUrl: string;
  totalRoutesChecked: number;
  summary: {
    totalChecked: number;
    passed: number;
    failed: number;
    status200Count: number;
    status301Count: number;
    status404Count: number;
    status500Count: number;
  };
  categories: {
    knownSpaRoutes: { total: number; passed: number; failed: number };
    judgmentPermalinks: { total: number; passed: number; failed: number };
    pluralRedirectRoutes: { total: number; passed: number; failed: number };
    citationLinks: { total: number; passed: number; failed: number };
    negativeChecks: { total: number; passed: number; failed: number };
  };
  inTextCitationExtraction: {
    sampleTested: string;
    citationsFound: number;
    hyperlinkedHtml: string;
    allExtractedLinksValid: boolean;
  };
  results: RouteCheckResult[];
}

export async function runInternalLinkCrawler(): Promise<{ report: InternalLinksReport; success: boolean }> {
  console.log("==================================================================");
  console.log("  ALWAKEELO AUTOMATED INTERNAL ROUTE & LINK CRAWLER (R3 / M3)");
  console.log("==================================================================");

  // 1. Spin up ephemeral in-process test server on port 0
  const app = express();
  const server = http.createServer(app);

  await registerRoutes(server, app);
  serveStatic(app);

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 5001;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`[Crawler] Attached to ephemeral test server at ${baseUrl}\n`);

  const results: RouteCheckResult[] = [];

  // 2. Define Route Test Suite
  const spaRoutesToTest = [
    "/",
    "/about",
    "/contact",
    "/faq",
    "/blog",
    "/privacy",
    "/terms",
    "/cancellation-return-refund-policy",
    "/ownership-statement",
    "/install",
    "/word-addin-guide",
    "/judgments",
    "/judgments/browse",
    "/judgment-search",
    "/citation-search",
    "/statute-search",
    "/statutes",
    "/judges",
    "/judges/qazi-faez-isa",
    "/most-cited",
    "/precedents",
    "/court-fee-calculator",
    "/legal-drafting",
    "/contract-drafting",
    "/contracts",
    "/cases",
    "/case-files",
    "/diary",
    "/tax-return",
    "/preview",
    "/preview/judgments",
    "/preview/most-cited",
    "/preview/judges",
    "/preview/statutes",
    "/preview/court-fee-calculator",
  ];

  const judgmentPermalinks = [
    "/judgment/00000000-0000-4000-8000-000000000001",
    "/judgment/ff8d297d-f10a-4f79-b4d2-b4c664091640",
    "/judgment/c25b6cd6-1b26-48cc-af88-3ea4ab5844ca",
    "/judgment/d999cf0b-42f9-48ff-b4dc-00aa62d8762b",
  ];

  const pluralRedirectRoutes = [
    "/judgments/00000000-0000-4000-8000-000000000001",
    "/judgments/ff8d297d-f10a-4f79-b4d2-b4c664091640",
    "/judgments/c25b6cd6-1b26-48cc-af88-3ea4ab5844ca",
    "/judgments/d999cf0b-42f9-48ff-b4dc-00aa62d8762b",
  ];

  const citationLinks = [
    "/citation-search?q=2020%20CLC%201910",
    "/citation-search?q=2021%20SCMR%20201",
    "/citation-search?q=PLD%202020%20SC%201",
    "/citation-search?q=1997%20SCMR%201203",
  ];

  const negativeChecks = [
    "/non-existent-unmapped-route-xyz-404-probe",
    "/unknown-category/probe-404",
    "/judgment/unresolvable-nonexistent-citation-slug-404",
  ];

  // Helper request function
  async function checkRoute(
    path: string,
    category: RouteCheckResult["category"],
    expectedStatus: number | number[]
  ): Promise<RouteCheckResult> {
    const start = Date.now();
    let actualStatus = 0;
    let statusText = "";
    let redirectLocation: string | null = null;

    try {
      const res = await fetch(`${baseUrl}${path}`, {
        redirect: "manual",
        headers: { "Accept": "text/html" },
      });
      actualStatus = res.status;
      statusText = res.statusText;
      redirectLocation = res.headers.get("location");
    } catch (err: any) {
      actualStatus = 500;
      statusText = err?.message || "Connection Error";
    }

    const duration = Date.now() - start;
    const allowedStatuses = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
    let passed = allowedStatuses.includes(actualStatus);

    // Extra validation for 301 redirects
    if (actualStatus === 301) {
      if (category === "plural_redirect") {
        const expectedTarget = path.replace(/^\/judgments\//, "/judgment/");
        if (redirectLocation !== expectedTarget && !redirectLocation?.endsWith(expectedTarget)) {
          passed = false;
        }
      } else if (path === "/judgment-search") {
        if (redirectLocation !== "/judgments" && !redirectLocation?.endsWith("/judgments")) {
          passed = false;
        }
      }
    }

    return {
      url: path,
      category,
      expectedStatus,
      actualStatus,
      statusText,
      redirectLocation,
      responseTimeMs: duration,
      passed,
    };
  }

  // 3. Execute Checks
  console.log(">> Crawling Known SPA Routes...");
  for (const p of spaRoutesToTest) {
    const expected = p === "/judgment-search" ? 301 : 200;
    const r = await checkRoute(p, "known_spa", expected);
    results.push(r);
  }

  console.log(">> Crawling Judgment Permalinks...");
  for (const p of judgmentPermalinks) {
    const r = await checkRoute(p, "judgment_permalink", 200);
    results.push(r);
  }

  console.log(">> Crawling Plural Canonical Redirect Routes...");
  for (const p of pluralRedirectRoutes) {
    const r = await checkRoute(p, "plural_redirect", 301);
    results.push(r);
  }

  console.log(">> Crawling Citation Internal Search Links...");
  for (const p of citationLinks) {
    const r = await checkRoute(p, "citation_link", 200);
    results.push(r);
  }

  console.log(">> Executing Negative Route Probes (asserting proper 404 handling)...");
  for (const p of negativeChecks) {
    const r = await checkRoute(p, "negative_check", 404);
    results.push(r);
  }

  // 4. Test In-Text Citation Extraction & Hyperlinking
  console.log(">> Verifying In-Text Citation Linker Engine...");
  const sampleOpinion = `In the landmark precedent of 2021 SCMR 201, the apex bench reiterated the principles first settled in PLD 2020 SC 1 and 1997 SCMR 1203 regarding constitutional remedies.`;
  const linkedHtml = linkifyCitationsInHtml(sampleOpinion);

  // Also test with a mapped citation
  const citationMap = new Map([
    ["2021 SCMR 201", "ff8d297d-f10a-4f79-b4d2-b4c664091640"],
  ]);
  const mappedHtml = linkifyCitationsInHtml(sampleOpinion, citationMap);

  // Extract all hrefs from both linked samples
  const unmappedHrefs = [...linkedHtml.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  const mappedHrefs = [...mappedHtml.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  const allSampleHrefs = [...new Set([...unmappedHrefs, ...mappedHrefs])];

  let inTextLinksValid = allSampleHrefs.length >= 3;

  for (const href of allSampleHrefs) {
    const hrefRes = await checkRoute(href, "citation_link", [200, 301]);
    results.push(hrefRes);
    if (!hrefRes.passed) inTextLinksValid = false;
  }

  // 5. Shutdown Server
  await new Promise<void>((resolve) => server.close(() => resolve()));

  // 6. Aggregate Statistics
  const validRouteResults = results.filter((r) => r.category !== "negative_check");
  const failedValidRoutes = validRouteResults.filter((r) => !r.passed);

  const summary = {
    totalChecked: results.length,
    passed: results.filter((r) => r.passed).length,
    failed: results.filter((r) => !r.passed).length,
    status200Count: results.filter((r) => r.actualStatus === 200).length,
    status301Count: results.filter((r) => r.actualStatus === 301).length,
    status404Count: results.filter((r) => r.actualStatus === 404).length,
    status500Count: results.filter((r) => r.actualStatus === 500).length,
  };

  const getCatStats = (cat: RouteCheckResult["category"]) => {
    const subset = results.filter((r) => r.category === cat);
    return {
      total: subset.length,
      passed: subset.filter((r) => r.passed).length,
      failed: subset.filter((r) => !r.passed).length,
    };
  };

  const report: InternalLinksReport = {
    timestamp: new Date().toISOString(),
    serverUrl: baseUrl,
    totalRoutesChecked: results.length,
    summary,
    categories: {
      knownSpaRoutes: getCatStats("known_spa"),
      judgmentPermalinks: getCatStats("judgment_permalink"),
      pluralRedirectRoutes: getCatStats("plural_redirect"),
      citationLinks: getCatStats("citation_link"),
      negativeChecks: getCatStats("negative_check"),
    },
    inTextCitationExtraction: {
      sampleTested: sampleOpinion,
      citationsFound: allSampleHrefs.length,
      hyperlinkedHtml: linkedHtml,
      allExtractedLinksValid: inTextLinksValid,
    },
    results,
  };

  // 7. Write JSON Report
  const reportsDir = path.resolve(process.cwd(), "reports");
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  const reportPath = path.resolve(reportsDir, "internal-links-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
  console.log(`\n[Report] Wrote crawl verification report to: ${reportPath}`);

  // 8. Console Output Table
  console.log("\n------------------------------------------------------------------");
  console.log(`  CRAWLER SUMMARY: ${summary.passed}/${summary.totalChecked} PASSED`);
  console.log(`  HTTP 200: ${summary.status200Count} | HTTP 301: ${summary.status301Count} | HTTP 404: ${summary.status404Count}`);
  console.log(`  Failed Valid Routes: ${failedValidRoutes.length}`);
  console.log("------------------------------------------------------------------");

  if (failedValidRoutes.length > 0) {
    console.error("\n[FAILURES DETECTED]:");
    for (const f of failedValidRoutes) {
      console.error(`  - ${f.url} | Expected: ${f.expectedStatus} | Actual: ${f.actualStatus}`);
    }
    return { report, success: false };
  }

  console.log("\n✔ Internal linking & routing verification PASSED with ZERO errors!");
  return { report, success: true };
}

// Self-executing CLI
if (process.argv[1] && process.argv[1].endsWith("verify-internal-links.ts")) {
  runInternalLinkCrawler()
    .then(({ success }) => {
      process.exit(success ? 0 : 1);
    })
    .catch((err) => {
      console.error("[Crawler Error]:", err);
      process.exit(1);
    });
}
