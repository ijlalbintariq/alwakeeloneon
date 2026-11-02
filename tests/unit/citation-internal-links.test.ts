import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import http from "node:http";
import {
  isKnownSpaRoute,
  KNOWN_SPA_ROUTES,
  linkifyCitationsInHtml,
  serveStatic,
} from "../../server/static";
import {
  PAKISTANI_CITATION_REGEX,
  normalizeCitationToken,
} from "../../client/src/components/formatted-judgment-text";

test("isKnownSpaRoute: resolves all added milestone public routes to true", () => {
  const routesToVerify = [
    "/",
    "/judges",
    "/judges/qazi-faez-isa",
    "/statutes",
    "/statute-search",
    "/most-cited",
    "/precedents",
    "/court-fee-calculator",
    "/citation-search",
    "/legal-drafting",
    "/contract-drafting",
    "/contracts",
    "/cases",
    "/case-files",
    "/diary",
    "/tax-return",
    "/preview",
    "/preview/court-fee-calculator",
    "/preview/judgments",
    "/preview/most-cited",
    "/preview/judges",
    "/preview/statutes",
  ];

  for (const route of routesToVerify) {
    assert.equal(
      isKnownSpaRoute(route),
      true,
      `Expected isKnownSpaRoute("${route}") to be true`
    );
  }
});

test("isKnownSpaRoute: correctly rejects unmapped and API routes", () => {
  const invalidRoutes = [
    "/non-existent-random-route-xyz",
    "/api/judgments",
    "/api/auth/me",
    "/admin/forbidden-unmapped-area",
  ];

  for (const route of invalidRoutes) {
    assert.equal(
      isKnownSpaRoute(route),
      false,
      `Expected isKnownSpaRoute("${route}") to be false`
    );
  }
});

test("PAKISTANI_CITATION_REGEX & normalizeCitationToken: accurately identifies Pakistani citations", () => {
  const sampleText =
    "The principles laid down in 2021 SCMR 201 and PLD 2020 SC 1 were further applied in 2022 YLR 450, 2019 MLD 101, and 2018 CLC 789.";

  const matches = [...sampleText.matchAll(PAKISTANI_CITATION_REGEX)].map((m) => m[0]);
  assert.equal(matches.length, 5);
  assert.ok(matches.includes("2021 SCMR 201"));
  assert.ok(matches.includes("PLD 2020 SC 1"));
  assert.ok(matches.includes("2022 YLR 450"));
  assert.ok(matches.includes("2019 MLD 101"));
  assert.ok(matches.includes("2018 CLC 789"));

  assert.equal(normalizeCitationToken("  2021   SCMR  201  "), "2021SCMR201");
  assert.equal(normalizeCitationToken("PLD-2020-SC-1"), "PLD2020SC1");
});

test("linkifyCitationsInHtml: generates citation-search links for unmapped citations", () => {
  const rawText = "Reference is made to 2021 SCMR 201 and PLD 2020 SC 1.";
  const html = linkifyCitationsInHtml(rawText);

  assert.match(
    html,
    /href="\/citation-search\?q=2021%20SCMR%20201"/,
    "Expected unmapped citation to link to /citation-search?q=2021%20SCMR%20201"
  );
  assert.match(
    html,
    /href="\/citation-search\?q=PLD%202020%20SC%201"/,
    "Expected unmapped citation to link to /citation-search?q=PLD%202020%20SC%201"
  );
  assert.match(html, /class="citation-internal-link"/);
});

test("linkifyCitationsInHtml: generates direct judgment permalinks for mapped citations", () => {
  const rawText = "In 2021 SCMR 201, the court established the precedent.";
  const citationMap = new Map([
    ["2021SCMR201", "ff8d297d-f10a-4f79-b4d2-b4c664091640"],
  ]);

  const html = linkifyCitationsInHtml(rawText, citationMap);

  assert.match(
    html,
    /href="\/judgment\/ff8d297d-f10a-4f79-b4d2-b4c664091640"/,
    "Expected mapped citation to link directly to /judgment/:uuid"
  );
  assert.doesNotMatch(html, /href="\/citation-search/);
});

test("Plural canonical 301 redirects and legacy redirects via HTTP server", async () => {
  const app = express();
  const server = http.createServer(app);
  serveStatic(app);

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 5002;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Plural /judgments/:uuid -> 301 -> /judgment/:uuid
    const uuid = "00000000-0000-4000-8000-000000000001";
    const resPlural = await fetch(`${baseUrl}/judgments/${uuid}`, { redirect: "manual" });
    assert.equal(resPlural.status, 301, "Expected HTTP 301 on plural judgment URL");
    assert.equal(resPlural.headers.get("location"), `/judgment/${uuid}`);

    // 2. Query string preservation during 301 redirect
    const resPluralQs = await fetch(`${baseUrl}/judgments/${uuid}?tab=citations`, { redirect: "manual" });
    assert.equal(resPluralQs.status, 301);
    assert.equal(resPluralQs.headers.get("location"), `/judgment/${uuid}?tab=citations`);

    // 3. Legacy /judgment-search -> 301 -> /judgments
    const resLegacy = await fetch(`${baseUrl}/judgment-search`, { redirect: "manual" });
    assert.equal(resLegacy.status, 301);
    assert.equal(resLegacy.headers.get("location"), "/judgments");

    // 4. Known SPA route returns 200 with HTML
    const resCourtFee = await fetch(`${baseUrl}/court-fee-calculator`, {
      headers: { Accept: "text/html" },
    });
    assert.equal(resCourtFee.status, 200);
    const feeHtml = await resCourtFee.text();
    assert.match(feeHtml, /Court Fee Calculator/);

    // 5. Unmapped route returns 404
    const resNotFound = await fetch(`${baseUrl}/totally-non-existent-route-404-check`, {
      headers: { Accept: "text/html" },
    });
    assert.equal(resNotFound.status, 404);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
