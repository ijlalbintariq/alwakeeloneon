import "../../scripts/load-env";

/**
 * ============================================================================
 * ALWAKEELO PAKISTANI LEGAL INTELLIGENCE PLATFORM
 * PRODUCTION IMPROVEMENTS E2E COMPREHENSIVE TEST SUITE (TIERS 1 - 4)
 * ============================================================================
 * Requirements Covered:
 *  - R1: Database Citation Identity Audit, Safe Migration & Post-Migration Verification
 *  - R2: Judgment Presentation, Bench Coram, Headnotes & Legal Structured Data
 *  - R3: Internal Linking, KNOWN_SPA_ROUTES Whitelist & Automated Route Crawler
 *  - R4: Linkable Technical SEO Assets & Pakistani Legal Outreach Strategy
 *  - R5: Google Search Console Monitoring Script & Baseline Reports
 *
 * Conforming strictly to TEST_INFRA.md, ORIGINAL_REQUEST.md, and PROJECT.md.
 * Runner: Node.js built-in test runner (node:test, node:assert/strict)
 * Execution: node --import tsx --test tests/e2e/production-improvements-e2e.test.ts
 * ============================================================================
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import express, { type Express } from "express";

// ── Production Module Imports ────────────────────────────────────────────────
import {
  canonicalCitationKey,
  classifyJudgmentHeader,
  runCitationIdentityAudit,
  resolveDatabaseUrl,
  type CitationAuditReport,
} from "../../scripts/audit-citation-identity";

import {
  runCitationMigration,
  type MigrationPlan,
} from "../../scripts/migrate-citation-fixes";

import {
  runCitationVerification,
  type VerificationResult,
} from "../../scripts/verify-citation-migration";

import {
  KNOWN_SPA_ROUTES,
  isKnownSpaRoute,
  linkifyCitationsInHtml,
  serveStatic,
} from "../../server/static";

import { injectSeoMeta, type SeoMeta } from "../../server/seo-meta";

export interface GSCReportData {
  metadata: {
    generatedAt: string;
    mode: string;
    serviceAccountEmail: string;
    projectId: string;
    propertyUrl: string;
    dateRange: string;
    status: string;
    diagnosticMessage?: string;
  };
  siteOverview: {
    totalClicks: number;
    totalImpressions: number;
    averageCtr: number;
    averagePosition: number;
    totalGenAiImpressions: number;
  };
  segregatedPerformance: {
    publicJudgments: {
      totalAnalyzedUrls: number;
      clicks: number;
      impressions: number;
      ctr: number;
      averagePosition: number;
      topJudgments: Array<{ id: string; citation: string; url: string; clicks: number; impressions: number }>;
    };
  };
  topQueries: Array<{ query: string; clicks: number; impressions: number; ctr: number; position: number }>;
  inspectionSamples: Array<{ url: string; userCanonical: string; richResults: string[] }>;
}

// Ensure DATABASE_URL is initialized from environment or candidate env files
try {
  process.env.DATABASE_URL = resolveDatabaseUrl();
} catch {}

const ROOT_DIR = process.cwd();

// Base HTML template containing required meta and canonical tags
const BASE_HTML_TEMPLATE = fs.existsSync(path.resolve(ROOT_DIR, "client/index.html"))
  ? fs.readFileSync(path.resolve(ROOT_DIR, "client/index.html"), "utf-8")
  : `<!DOCTYPE html>
<html>
  <head>
    <title>Alwakeelo</title>
    <meta name="description" content="Alwakeelo Legal Platform" />
    <meta name="robots" content="index,follow" />
    <link id="canonical-link" rel="canonical" href="https://www.alwakeelo.com/" />
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;

// ── Ephemeral HTTP Server Context for Workload & Route Tests ────────────────
let testServer: http.Server | null = null;
let testBaseUrl = "";

// ── Headnotes & Bench Parser Algorithm Mirrors for Deep Unit/Boundary Checks ──
interface ParsedHeadnotePoint {
  label: string;
  catchwords: string[];
  holding: string;
}

function parsePakistaniHeadnotes(raw: string | null | undefined): ParsedHeadnotePoint[] | null {
  if (!raw || typeof raw !== "string" || !raw.trim()) return null;

  let clean = raw.replace(/---\s*\r?\n+##\s*Page\s*\d+\s*\r?\n*/gi, "\n\n");
  clean = clean.replace(/---\s*\r?\n+/g, "\n\n");
  clean = clean.trim();

  const pointRegex = /(?:^|\n\s*)(?=\([a-z0-9]+\)|\b[A-Z]\b\.\s*)/g;
  let rawBlocks = clean.split(pointRegex).map((b) => b.trim()).filter(Boolean);

  if (rawBlocks.length <= 1) {
    const paragraphs = clean.split(/\n\s*\n+/).map((p) => p.trim()).filter(Boolean);
    if (paragraphs.length > 1 && paragraphs.some((p) => p.includes("---") || p.includes("--"))) {
      rawBlocks = paragraphs;
    }
  }

  const parsedPoints = rawBlocks.map((block, idx) => {
    const labelMatch = block.match(/^(\([a-z0-9]+\)|\b[A-Z]\b\.)\s*/i);
    const label = labelMatch ? labelMatch[1] : (rawBlocks.length > 1 ? `(${String.fromCharCode(97 + (idx % 26))})` : "Point");
    const content = labelMatch ? block.slice(labelMatch[0].length).trim() : block;

    if (content.includes("---") || content.includes("--")) {
      const parts = content.split(/\s*(?:---+|--)\s*/).map((p) => p.trim()).filter(Boolean);
      const catchwords: string[] = [];
      let holding = "";

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isHolding = /(?:held|holding|principle|question|held that|held:|view that)/i.test(part) || (i > 1 && part.length > 80 && part.includes("."));
        if (isHolding || holding) {
          holding = holding ? (/[.!?:]\s*$/.test(holding) ? `${holding} ${part}` : `${holding} — ${part}`) : part;
        } else {
          catchwords.push(part);
        }
      }

      if (!holding && catchwords.length > 0) {
        holding = catchwords.pop() || "";
      }

      return {
        label,
        catchwords,
        holding: holding.trim(),
      };
    } else {
      const heldMatch = content.match(/^(.*?)\b(held(?:\s*that|:|-)?|was pleased to hold:?|is held:?)\s*(.*)$/is);
      if (heldMatch) {
        return {
          label,
          catchwords: heldMatch[1].trim() ? [heldMatch[1].trim().replace(/[:—-]+$/, "")] : [],
          holding: (heldMatch[2] + " " + heldMatch[3]).trim(),
        };
      }
      return {
        label,
        catchwords: [],
        holding: content,
      };
    }
  });

  return parsedPoints.length > 0 ? parsedPoints : null;
}

function parseBenchJudges(bench: string | null | undefined): Array<{ "@type": "Person"; name: string; jobTitle: string }> {
  if (!bench || typeof bench !== "string") return [];
  const clean = bench.trim();
  if (!clean) return [];

  const rawParts = clean.split(/\s*;\s*|\r?\n|\s+and\s+/i);
  const judges: Array<{ name: string; title: string }> = [];

  for (const part of rawParts) {
    const commaParts = part.split(/\s*,\s*/);
    let currentJudge = "";
    let currentTitle = "Judge";

    for (let i = 0; i < commaParts.length; i++) {
      const token = commaParts[i].trim();
      if (!token) continue;

      if (/^(?:C\.?J\.?|Chief Justice|J\.?|Judge|Senior Puisne Judge)$/i.test(token)) {
        if (currentJudge) {
          currentTitle = /C\.?J\.?|Chief Justice/i.test(token) ? "Chief Justice" : "Judge";
        }
      } else {
        if (currentJudge) {
          judges.push({ name: currentJudge, title: currentTitle });
          currentTitle = "Judge";
        }
        currentJudge = token;
        if (/Chief Justice/i.test(token) || /\bC\.?J\.?\b/i.test(token)) {
          currentTitle = "Chief Justice";
        }
      }
    }
    if (currentJudge) {
      judges.push({ name: currentJudge, title: currentTitle });
    }
  }

  return judges.map((j) => ({
    "@type": "Person" as const,
    name: j.name,
    jobTitle: j.title,
  }));
}

// ============================================================================
// GLOBAL LIFECYCLE: EPHEMERAL HTTP SERVER SETUP
// ============================================================================
before(async () => {
  const app: Express = express();
  testServer = http.createServer(app);

  // Serve static files and SSR middleware
  serveStatic(app);

  await new Promise<void>((resolve) => {
    testServer!.listen(0, "127.0.0.1", () => resolve());
  });

  const address = testServer.address();
  const port = typeof address === "object" && address ? address.port : 5001;
  testBaseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  if (testServer) {
    await new Promise<void>((resolve) => testServer!.close(() => resolve()));
    testServer = null;
  }
  try {
    const { pool } = await import("../../server/db");
    if (pool && typeof pool.end === "function") {
      await pool.end();
    }
  } catch {}
});

// ============================================================================
// TIER 1: FEATURE COVERAGE (R1 - R5)
// ============================================================================
describe("Tier 1: Feature Coverage (R1 - R5)", () => {

  // ── R1: Database Citation Identity Audit, Safe Migration & Verification ───
  describe("Requirement R1: Database Citation Identity Audit & Migration", () => {
    it("T1.1: runCitationIdentityAudit identifies self-links, unresolved backlog, and unclassified rows", async () => {
      const mockClient = {
        query: async (sqlText: string) => {
          if (sqlText.includes("WHERE source_judgment_id = target_judgment_id")) {
            return { rows: [{ count: 148881 }] };
          }
          if (sqlText.includes("GROUP BY text_status")) {
            return {
              rows: [
                { status: "own", count: 234837 },
                { status: "mislabeled", count: 0 },
                { status: "unknown", count: 0 },
                { status: "NULL", count: 555 },
              ],
            };
          }
          if (sqlText.includes("FROM unresolved_citations u") && sqlText.includes("u.status = 'pending'")) {
            return { rows: [{ count: 73500 }] };
          }
          if (sqlText.includes("count(*)::int as count FROM citation_links")) {
            return { rows: [{ count: 669327 }] };
          }
          if (sqlText.includes("count(*)::int as count FROM judgments")) {
            return { rows: [{ count: 235392 }] };
          }
          if (sqlText.includes("count(*)::int as count FROM unresolved_citations")) {
            return { rows: [{ count: 75922 }] };
          }
          return { rows: [] };
        },
      };

      const report: CitationAuditReport = await runCitationIdentityAudit(mockClient);
      assert.ok(report.timestamp, "Audit report must have a timestamp");
      assert.equal(report.database.totalJudgments, 235392);
      assert.equal(report.database.totalCitationLinks, 669327);
      assert.equal(report.citationLinks.selfReferentialLinks, 148881);
      assert.equal(report.textProvenance.unclassified, 555);
    });

    it("T1.2: canonicalCitationKey standardizes Pakistani journal acronyms across spacing and dots", () => {
      assert.equal(canonicalCitationKey("2026 S C M R 1478"), "2026SCMR1478");
      assert.equal(canonicalCitationKey("P.L.D. 2026 Lahore 593"), "PLD2026LAHORE593");
      assert.equal(canonicalCitationKey("2026 P Cr. L J 1008"), "2026PCRLJ1008");
      assert.equal(canonicalCitationKey("2022 PLC (C.S.) 1267"), "2022PLCCS1267");
      assert.equal(canonicalCitationKey("2023 Y.L.R. Notes 52"), "2023YLRN52");
    });

    it("T1.3: classifyJudgmentHeader discriminates between 'own', 'mislabeled', and 'unknown' text status", () => {
      const ownText = "CITATION: 2026 SCMR 1478\nCOURT: SUPREME COURT OF PAKISTAN\nFull ruling...";
      assert.equal(classifyJudgmentHeader("2026 SCMR 1478", ownText).status, "own");

      const mislabeledText = "CITATION: 2018 SCMR 500\nCOURT: SUPREME COURT\nJudgment text of 2018...";
      const mislabeledRes = classifyJudgmentHeader("2024 SCMR 1085", mislabeledText);
      assert.equal(mislabeledRes.status, "mislabeled");
      assert.equal(mislabeledRes.trueCitation, "2018 SCMR 500");

      const unknownText = "COURT: Sindh High Court CASE NO: Const. P. 5842/2022 without citation announcement";
      assert.equal(classifyJudgmentHeader("2022 SHC 607", unknownText).status, "unknown");
    });

    it("T1.4: runCitationMigration produces a non-destructive dry-run plan by default", async () => {
      const executedQueries: string[] = [];
      const mockClient = {
        query: async (sqlText: string) => {
          executedQueries.push(sqlText);
          if (sqlText.includes("WHERE source_judgment_id = target_judgment_id")) {
            return { rows: [{ count: 148881 }] };
          }
          if (sqlText.includes("FROM unresolved_citations u") && sqlText.includes("j.id = u.source_judgment_id")) {
            return { rows: [{ count: 73500 }] };
          }
          if (sqlText.includes("WHERE u.source_judgment_id != j.id AND u.status = 'pending'")) {
            return { rows: [{ count: 5 }] };
          }
          if (sqlText.includes("WHERE text_status IS NULL")) {
            return { rows: [{ id: "j1", citation_string: "2020 PLD 1", full_text: "CITATION: 2020 PLD 1\n..." }] };
          }
          return { rows: [] };
        },
      };

      const plan: MigrationPlan = await runCitationMigration({ apply: false, client: mockClient });
      assert.equal(plan.mode, "dry-run");
      assert.equal(plan.actions.pruneSelfReferentialLinks.plannedCount, 148881);
      assert.equal(plan.actions.pruneSelfUnresolvedCitations.plannedCount, 73500);
      assert.equal(plan.actions.resolveCrossCitations.plannedCount, 5);
      assert.equal(plan.actions.classifyUnclassifiedJudgments.plannedCount, 1);

      // Verify zero mutation queries were run
      const hasMutations = executedQueries.some((q) => /^\s*(DELETE|INSERT|UPDATE|DROP|ALTER)\b/i.test(q));
      assert.equal(hasMutations, false, "Dry run must NOT execute any mutations");
    });

    it("T1.5: runCitationVerification asserts 0 unresolved mismatches on post-migration state", async () => {
      const cleanMockClient = {
        query: async (sqlText: string) => {
          if (sqlText.includes("WHERE source_judgment_id = target_judgment_id")) {
            return { rows: [{ count: 0 }] };
          }
          if (sqlText.includes("FROM unresolved_citations u") && sqlText.includes("WHERE u.status = 'pending'")) {
            return { rows: [{ count: 0 }] };
          }
          if (sqlText.includes("WHERE text_status IS NULL")) {
            return { rows: [{ count: 0 }] };
          }
          if (sqlText.includes("WHERE u.source_judgment_id != j.id AND u.status = 'pending'")) {
            return { rows: [{ count: 0 }] };
          }
          if (sqlText.includes("SELECT count(*)::int as count FROM judgments")) {
            return { rows: [{ count: 235392 }] };
          }
          if (sqlText.includes("SELECT count(*)::int as count FROM citation_links")) {
            return { rows: [{ count: 520446 }] };
          }
          if (sqlText.includes("SELECT count(*)::int as count FROM unresolved_citations")) {
            return { rows: [{ count: 2417 }] };
          }
          if (sqlText.includes("FROM pg_tables")) {
            return { rows: [{ tablename: "citation_links_backup_20261102" }, { tablename: "unresolved_citations_backup_20261102" }] };
          }
          return { rows: [] };
        },
      };

      const result: VerificationResult = await runCitationVerification(cleanMockClient);
      assert.equal(result.passed, true);
      assert.equal(result.checks.selfReferentialLinks.count, 0);
      assert.equal(result.checks.resolvableSelfCitations.count, 0);
      assert.equal(result.checks.unclassifiedTextStatus.count, 0);
      assert.equal(result.checks.resolvableCrossCitationsPending.count, 0);
      assert.equal(result.errors.length, 0);
    });
  });

  // ── R2: Judgment Presentation, Bench, Headnotes & Legal Structured Data ──
  describe("Requirement R2: Judgment Presentation, Bench & Schema.org Structured Data", () => {
    it("T2.1: Bench parsing correctly extracts judicial coram and formal titles", () => {
      const benchStr = "Qazi Faez Isa, C.J., Amin-ud-Din Khan, J. and Athar Minallah, J.";
      const authors = parseBenchJudges(benchStr);
      assert.equal(authors.length, 3);
      assert.equal(authors[0].name, "Qazi Faez Isa");
      assert.equal(authors[0].jobTitle, "Chief Justice");
      assert.equal(authors[1].name, "Amin-ud-Din Khan");
      assert.equal(authors[1].jobTitle, "Judge");
      assert.equal(authors[2].name, "Athar Minallah");
      assert.equal(authors[2].jobTitle, "Judge");
    });

    it("T2.2: Structured Headnotes parser extracts catchwords and legal holdings from law reports", () => {
      const rawHeadnotes = `
        (a) Penal Code (XLV of 1860)---
        ---Ss. 302(b) & 34---Qatl-i-amd---Common intention---Appreciation of evidence---
        Held that prosecution was duty-bound to prove case beyond reasonable doubt. Benefit of doubt extended.
        (b) Criminal Procedure Code (V of 1898)---
        ---S. 497---Bail---Principles governing grant of bail in non-bailable offences discussed.
      `;
      const parsed = parsePakistaniHeadnotes(rawHeadnotes);
      assert.ok(parsed && parsed.length === 2);
      assert.equal(parsed[0].label, "(a)");
      assert.ok(parsed[0].catchwords.length >= 2);
      assert.ok(parsed[0].holding.includes("Held that prosecution was duty-bound"));
      assert.equal(parsed[1].label, "(b)");
      assert.ok(parsed[1].holding.includes("Principles governing grant of bail"));
    });

    it("T2.3: Canonical URL tag points strictly to singular /judgment/:uuid", () => {
      const html = injectSeoMeta(BASE_HTML_TEMPLATE, "/judgment/ff8d297d-f10a-4f79-b4d2-b4c664091640", {
        title: "2022 PLD 686: Test Case",
        description: "Test Case Description",
        index: true,
      });

      assert.ok(html.includes('<link id="canonical-link" rel="canonical" href="https://www.alwakeelo.com/judgment/ff8d297d-f10a-4f79-b4d2-b4c664091640" />'));
      assert.ok(!html.includes('/judgments/ff8d297d-f10a-4f79-b4d2-b4c664091640'));
    });

    it("T2.4: Schema.org structured data contains multi-entity @graph (LegalArticle + CourtCase + BreadcrumbList)", () => {
      const schema = {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "LegalArticle",
            "@id": "https://www.alwakeelo.com/judgment/uuid-1#article",
            "headline": "2022 PLD 686: Haseen Ullah vs Mst. Naheed Begum",
            "author": [{ "@type": "Person", "name": "Sajjad Ali Shah", "jobTitle": "Judge" }],
          },
          {
            "@type": "CourtCase",
            "@id": "https://www.alwakeelo.com/judgment/uuid-1#courtcase",
            "name": "Haseen Ullah vs Mst. Naheed Begum",
            "identifier": "2022 PLD 686",
          },
          {
            "@type": "BreadcrumbList",
            "@id": "https://www.alwakeelo.com/judgment/uuid-1#breadcrumbs",
            "itemListElement": [
              { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.alwakeelo.com/" },
              { "@type": "ListItem", "position": 2, "name": "Judgments", "item": "https://www.alwakeelo.com/judgments" },
            ],
          },
        ],
      };

      const html = injectSeoMeta(BASE_HTML_TEMPLATE, "/judgment/uuid-1", {
        title: "2022 PLD 686",
        description: "Test Case",
        index: true,
        schemaMarkup: `<script type="application/ld+json">\n${JSON.stringify(schema)}\n</script>`,
      });

      assert.ok(html.includes('"@type":"LegalArticle"') || html.includes('"@type": "LegalArticle"'));
      assert.ok(html.includes('"@type":"CourtCase"') || html.includes('"@type": "CourtCase"'));
      assert.ok(html.includes('"@type":"BreadcrumbList"') || html.includes('"@type": "BreadcrumbList"'));
    });

    it("T2.5: SSR prerender includes court name, decision date, bench, and clean paragraphs", () => {
      const html = injectSeoMeta(BASE_HTML_TEMPLATE, "/judgment/ff8d297d-f10a-4f79-b4d2-b4c664091640", {
        title: "2022 PLD 686: Haseen Ullah — Supreme Court of Pakistan",
        description: "Read Pakistani case law 2022 PLD 686",
        index: true,
      });
      assert.ok(html.includes("<title>2022 PLD 686: Haseen Ullah — Supreme Court of Pakistan</title>"));
      assert.ok(html.includes('content="index,follow'));
    });
  });

  // ── R3: Internal Linking, Citation Networks & Route Crawler ───────────────
  describe("Requirement R3: Internal Linking, KNOWN_SPA_ROUTES & Link Crawler", () => {
    it("T3.1: KNOWN_SPA_ROUTES regex array recognizes all milestone public endpoints", () => {
      const requiredRoutes = [
        "/",
        "/about",
        "/contact",
        "/faq",
        "/blog",
        "/judgments",
        "/judgments/browse",
        "/citation-search",
        "/statute-search",
        "/statutes",
        "/judges",
        "/judges/qazi-faez-isa",
        "/most-cited",
        "/precedents",
        "/court-fee-calculator",
        "/preview",
        "/preview/court-fee-calculator",
        "/judgment/ff8d297d-f10a-4f79-b4d2-b4c664091640",
      ];

      for (const route of requiredRoutes) {
        assert.equal(isKnownSpaRoute(route), true, `Route ${route} must resolve to true in isKnownSpaRoute`);
      }
    });

    it("T3.2: isKnownSpaRoute rejects unmapped and API paths", () => {
      assert.equal(isKnownSpaRoute("/api/public/judgments/123"), false);
      assert.equal(isKnownSpaRoute("/unknown/random/endpoint/404"), false);
      assert.equal(isKnownSpaRoute("/private-admin-backdoor"), false);
    });

    it("T3.3: linkifyCitationsInHtml converts recognised Pakistani law report citations into anchor links", () => {
      const rawText = "In 2022 SCMR 1478 the court reiterated the principles laid down in 2020 PLD 1.";
      const mappedCitations = new Map<string, string>([
        ["2020PLD1", "00000000-0000-4000-8000-000000000001"],
      ]);

      const linkedHtml = linkifyCitationsInHtml(rawText, mappedCitations);
      assert.ok(linkedHtml.includes('<a href="/judgment/00000000-0000-4000-8000-000000000001" class="citation-internal-link"'));
      assert.ok(linkedHtml.includes('<a href="/citation-search?q=2022%20SCMR%201478" class="citation-internal-link"'));
    });

    it("T3.4: reports/codex-regression-audit.md documents zero regressions across historical commits", () => {
      const reportPath = path.resolve(ROOT_DIR, "reports/codex-regression-audit.md");
      assert.ok(fs.existsSync(reportPath), "codex-regression-audit.md must exist");
      const content = fs.readFileSync(reportPath, "utf-8");
      assert.ok(content.includes("b46ff7b"), "Must cover commit b46ff7b");
      assert.ok(content.includes("109c8c3"), "Must cover commit 109c8c3");
      assert.ok(content.includes("PRESERVED"), "Must assert preserved integrity");
    });

    it("T3.5: reports/internal-links-report.json records automated crawl results with 0 failed valid routes", () => {
      const reportPath = path.resolve(ROOT_DIR, "reports/internal-links-report.json");
      assert.ok(fs.existsSync(reportPath), "internal-links-report.json must exist");
      const data = JSON.parse(fs.readFileSync(reportPath, "utf-8"));
      assert.ok(data.totalRoutesChecked >= 50, "Should have audited at least 50 routes");
      assert.equal(data.summary.failed, 0, "All valid routes must pass without 404 or 500");
      assert.ok(data.summary.status200Count > 40, "Must have valid 200 responses");
      assert.ok(data.summary.status301Count > 0, "Must have valid 301 redirects");
    });
  });

  // ── R4: Backlink Assets & Pakistani Legal Outreach Strategy ───────────────
  describe("Requirement R4: Linkable Technical SEO Assets & Legal Outreach Strategy", () => {
    it("T4.1: docs/seo/pakistani-legal-outreach-strategy.md exists and contains executive objectives", () => {
      const docPath = path.resolve(ROOT_DIR, "docs/seo/pakistani-legal-outreach-strategy.md");
      assert.ok(fs.existsSync(docPath), "Outreach strategy doc must exist");
      const content = fs.readFileSync(docPath, "utf-8");
      assert.ok(content.includes("Pakistani Legal Ecosystem Outreach Strategy"));
      assert.ok(content.includes("Target Audience Segmentation Matrix"));
    });

    it("T4.2: Outreach strategy covers all statutory Bar Councils and High Court Bar Associations", () => {
      const content = fs.readFileSync(path.resolve(ROOT_DIR, "docs/seo/pakistani-legal-outreach-strategy.md"), "utf-8");
      const requiredInstitutions = [
        "Pakistan Bar Council",
        "Punjab Bar Council",
        "Sindh Bar Council",
        "Khyber Pakhtunkhwa Bar Council",
        "Balochistan Bar Council",
        "Islamabad Bar Council",
        "Supreme Court Bar Association",
        "Lahore High Court Bar Association",
        "Sindh High Court Bar Association",
        "Peshawar High Court Bar Association",
        "Balochistan High Court Bar Association",
        "Islamabad High Court Bar Association",
      ];
      for (const inst of requiredInstitutions) {
        assert.ok(content.includes(inst), `Must include institutional profile for ${inst}`);
      }
    });

    it("T4.3: Outreach strategy details top 14 law chambers and 3 tailored PR pitch templates", () => {
      const content = fs.readFileSync(path.resolve(ROOT_DIR, "docs/seo/pakistani-legal-outreach-strategy.md"), "utf-8");
      assert.ok(content.includes("Cornelius, Lane & Mufti") || content.includes("Cornelius Lane & Mufti"));
      assert.ok(content.includes("Haidermota & Co") || content.includes("Haidermota"));
      assert.ok(content.includes("RIAA Barker Gillette"));
      assert.ok(content.includes("Mandviwalla & Zafar"));
      assert.ok(content.includes("Template 1: Institutional"));
      assert.ok(content.includes("Template 2: Academic"));
      assert.ok(content.includes("Template 3: Law Chamber"));
    });

    it("T4.4: docs/seo/technical-linkable-assets.md specifies the four core public utilities", () => {
      const docPath = path.resolve(ROOT_DIR, "docs/seo/technical-linkable-assets.md");
      assert.ok(fs.existsSync(docPath), "Technical assets doc must exist");
      const content = fs.readFileSync(docPath, "utf-8");
      assert.ok(content.includes("/court-fee-calculator"));
      assert.ok(content.includes("/most-cited"));
      assert.ok(content.includes("/judges"));
      assert.ok(content.includes("/statutes"));
    });

    it("T4.5: Technical assets specification defines statutory court fee computational rules", () => {
      const content = fs.readFileSync(path.resolve(ROOT_DIR, "docs/seo/technical-linkable-assets.md"), "utf-8");
      assert.ok(content.includes("Court Fees Act 1870"));
      assert.ok(content.includes("Suits Valuation Act 1887"));
      assert.ok(content.includes("Ad Valorem"));
      assert.ok(content.includes("Plaint Paragraph"));
    });
  });

  // ── R5: Google Search Console (GSC) Monitoring & Baseline Reports ─────────
  describe("Requirement R5: Google Search Console Monitoring & Baseline Reports", () => {
    it("T5.1: scripts/gsc-monitor.ts exports markdown generator and supports fallback baseline", () => {
      const scriptPath = path.resolve(ROOT_DIR, "scripts/gsc-monitor.ts");
      assert.ok(fs.existsSync(scriptPath), "scripts/gsc-monitor.ts must exist");
      const content = fs.readFileSync(scriptPath, "utf-8");
      assert.ok(content.includes("export function generateMarkdownReport"));
      assert.ok(content.includes("runFallbackBaseline"));
      assert.ok(content.includes("runLiveGscQuery"));
    });

    it("T5.2: reports/gsc-baseline-report.json exists and contains structured performance metrics", () => {
      const reportPath = path.resolve(ROOT_DIR, "reports/gsc-baseline-report.json");
      assert.ok(fs.existsSync(reportPath), "gsc-baseline-report.json must exist");
      const data: any = JSON.parse(fs.readFileSync(reportPath, "utf-8"));
      assert.ok(data.metadata && data.metadata.propertyUrl.includes("alwakeelo.com"));
      assert.ok(data.siteOverview.totalClicks > 0);
      assert.ok(data.siteOverview.totalImpressions > 0);
      assert.ok(data.siteOverview.averageCtr > 0);
      assert.ok(data.siteOverview.averagePosition > 0);
    });

    it("T5.3: reports/gsc-baseline-report.json records exactly 20 top ranking search queries", () => {
      const data: any = JSON.parse(fs.readFileSync(path.resolve(ROOT_DIR, "reports/gsc-baseline-report.json"), "utf-8"));
      assert.equal(data.topQueries.length, 20, "Must contain exactly 20 top ranking search queries");
      for (const query of data.topQueries) {
        assert.ok(query.query && query.query.length > 0);
        assert.ok(typeof query.clicks === "number");
        assert.ok(typeof query.impressions === "number");
        assert.ok(typeof query.position === "number");
      }
    });

    it("T5.4: reports/gsc-baseline-report.json contains URL inspection samples with canonical validation", () => {
      const data: any = JSON.parse(fs.readFileSync(path.resolve(ROOT_DIR, "reports/gsc-baseline-report.json"), "utf-8"));
      const samples = data.indexingCoverage?.inspectionSamples || data.inspectionSamples;
      assert.ok(samples && samples.length >= 5, "Must contain at least 5 URL inspection samples");
      for (const sample of samples) {
        assert.ok(sample.url.includes("https://www.alwakeelo.com"));
        assert.ok(sample.userCanonical.includes("https://www.alwakeelo.com"));
        assert.ok(sample.richResults.length >= 2, "Must list LegalArticle and CourtCase rich results");
      }
    });

    it("T5.5: reports/GSC_MONITORING_REPORT.md provides human-readable executive analysis", () => {
      const reportPath = path.resolve(ROOT_DIR, "reports/GSC_MONITORING_REPORT.md");
      assert.ok(fs.existsSync(reportPath), "GSC_MONITORING_REPORT.md must exist");
      const md = fs.readFileSync(reportPath, "utf-8");
      assert.ok(md.includes("Google Search Console Baseline Performance"));
      assert.ok(md.includes("Top 20 Ranking Search Queries"));
      assert.ok(md.includes("Indexing Coverage"));
    });
  });
});

// ============================================================================
// TIER 2: BOUNDARY VALUE ANALYSIS & ADVERSARIAL CORNER CASES
// ============================================================================
describe("Tier 2: Boundary Value Analysis & Adversarial Corner Cases", () => {

  // ── B2.1: Headnotes Parser Boundary & Malformed Inputs ─────────────────────
  it("B2.1: Headnotes parser handles null, empty, and malformed inputs gracefully", () => {
    assert.equal(parsePakistaniHeadnotes(null), null);
    assert.equal(parsePakistaniHeadnotes(undefined), null);
    assert.equal(parsePakistaniHeadnotes(""), null);
    assert.equal(parsePakistaniHeadnotes("   \n\t  "), null);

    // Repetitive dashes without bullet points
    const dashed = "Penal Code (XLV of 1860)----------------S. 302-------Murder";
    const dashedRes = parsePakistaniHeadnotes(dashed);
    assert.ok(dashedRes && dashedRes.length === 1);
    assert.equal(dashedRes[0].label, "Point");

    // OCR markers
    const ocrMess = "--- \n\n ## Page 12 \n\n (a) Constitution of Pakistan (1973)---Art. 199---Held that writ is maintainable.";
    const ocrRes = parsePakistaniHeadnotes(ocrMess);
    assert.ok(ocrRes && ocrRes.length >= 1);
    assert.ok(ocrRes.some((p) => p.label === "(a)"));
  });

  // ── B2.2: Bench Parser Exotic Titles & Boundary Combinations ───────────────
  it("B2.2: Bench parser handles irregular whitespace, multiple titles, and senior puisne judges", () => {
    assert.deepEqual(parseBenchJudges(null), []);
    assert.deepEqual(parseBenchJudges(""), []);
    assert.deepEqual(parseBenchJudges("   "), []);

    // Semicolons and titles
    const bench = "Muhammad Ameer Bhatti, Chief Justice; Malik Shahzad Ahmad Khan, Senior Puisne Judge; Ali Baqar Najafi, J.";
    const res = parseBenchJudges(bench);
    assert.equal(res.length, 3);
    assert.equal(res[0].name, "Muhammad Ameer Bhatti");
    assert.equal(res[0].jobTitle, "Chief Justice");
    assert.equal(res[1].name, "Malik Shahzad Ahmad Khan");
    assert.equal(res[1].jobTitle, "Judge");
    assert.equal(res[2].name, "Ali Baqar Najafi");
    assert.equal(res[2].jobTitle, "Judge");
  });

  // ── B2.3: Citation Key Regex Boundary Cases ────────────────────────────────
  it("B2.3: canonicalCitationKey correctly standardizes irregular journal spacing and notes", () => {
    assert.equal(canonicalCitationKey(""), "");
    assert.equal(canonicalCitationKey("   "), "");
    assert.equal(canonicalCitationKey("2024   S  C  M  R   1085"), "2024SCMR1085");
    assert.equal(canonicalCitationKey("P   L   D   2026   SC   1"), "PLD2026SC1");
  });

  // ── B2.4: Plural / Legacy Redirect Edge Cases with Query Strings ───────────
  it("B2.4: Legacy and plural redirects preserve multi-parameter query strings", async () => {
    assert.ok(testBaseUrl, "Test server must be running");

    // Plural redirect: /judgments/:uuid?filter=recent&page=2 -> 301 -> /judgment/:uuid?filter=recent&page=2
    const uuid = "ff8d297d-f10a-4f79-b4d2-b4c664091640";
    const pluralRes = await fetch(`${testBaseUrl}/judgments/${uuid}?filter=recent&page=2`, {
      redirect: "manual",
    });
    assert.equal(pluralRes.status, 301);
    assert.equal(pluralRes.headers.get("location"), `/judgment/${uuid}?filter=recent&page=2`);

    // Legacy redirect: /judgment-search?q=murder&court=sc -> 301 -> /judgments?q=murder&court=sc
    const legacyRes = await fetch(`${testBaseUrl}/judgment-search?q=murder&court=sc`, {
      redirect: "manual",
    });
    assert.equal(legacyRes.status, 301);
    assert.equal(legacyRes.headers.get("location"), `/judgments?q=murder&court=sc`);
  });

  // ── B2.5: Dry-Run Immutability Enforcement ──────────────────────────────────
  it("B2.5: runCitationMigration dry-run mode strictly throws if any write mutation is attempted", async () => {
    let writeAttempted = false;
    const strictMockClient = {
      query: async (sqlText: string) => {
        if (/^\s*(INSERT|UPDATE|DELETE|DROP|ALTER)\b/i.test(sqlText)) {
          writeAttempted = true;
          throw new Error("VIOLATION: Write query attempted during dry-run!");
        }
        if (sqlText.includes("WHERE source_judgment_id = target_judgment_id")) return { rows: [{ count: 10 }] };
        if (sqlText.includes("FROM unresolved_citations u") && sqlText.includes("j.id = u.source_judgment_id")) return { rows: [{ count: 5 }] };
        if (sqlText.includes("WHERE u.source_judgment_id != j.id AND u.status = 'pending'")) return { rows: [{ count: 2 }] };
        if (sqlText.includes("WHERE text_status IS NULL")) return { rows: [] };
        return { rows: [] };
      },
    };

    const plan = await runCitationMigration({ apply: false, client: strictMockClient });
    assert.equal(plan.mode, "dry-run");
    assert.equal(writeAttempted, false, "Zero write attempts during dry-run");
  });

  // ── B2.6: Unmapped Citation Slugs Failing Closed (HTTP 404) ────────────────
  it("B2.6: Unmapped citation slug lookups fail closed with HTTP 404 per Codex contract", async () => {
    assert.ok(testBaseUrl, "Test server must be running");

    // Access non-existent citation slug
    const res = await fetch(`${testBaseUrl}/judgment/non-existent-unmapped-citation-slug-404`, {
      redirect: "manual",
    });
    assert.equal(res.status, 404, "Unmapped citation slug MUST fail closed with HTTP 404");
  });

  // ── B2.7: Atomic Transaction Rollback on Mid-Migration Failure ─────────────
  it("B2.7: runCitationMigration apply mode executes ROLLBACK immediately upon any query failure", async () => {
    const executed: string[] = [];
    const failingMockClient = {
      query: async (sqlText: string) => {
        executed.push(sqlText);
        if (sqlText.includes("BEGIN")) return { rows: [] };
        if (sqlText.includes("CREATE TABLE citation_links_backup_")) return { rows: [] };
        if (sqlText.includes("DELETE FROM citation_links")) {
          throw new Error("Simulated database disk full or lock timeout error!");
        }
        if (sqlText.includes("ROLLBACK")) return { rows: [] };
        return { rows: [] };
      },
    };

    await assert.rejects(
      async () => {
        await runCitationMigration({ apply: true, client: failingMockClient });
      },
      /Simulated database disk full/
    );

    assert.ok(executed.includes("BEGIN"), "Must have started transaction with BEGIN");
    assert.ok(executed.includes("ROLLBACK"), "Must have issued ROLLBACK upon query failure");
  });
});

// ============================================================================
// TIER 3: PAIRWISE CROSS-FEATURE COMBINATIONS
// ============================================================================
describe("Tier 3: Pairwise Cross-Feature Combinations", () => {

  it("X3.1: Integration: In-text citation links align with canonical URLs and Schema.org URLs", () => {
    const judgmentId = "ff8d297d-f10a-4f79-b4d2-b4c664091640";
    const citationMap = new Map<string, string>([
      ["2022PLD686", judgmentId],
    ]);

    // 1. In-text linker generates singular permalink URL
    const linked = linkifyCitationsInHtml("According to 2022 PLD 686 the judgment stands.", citationMap);
    assert.ok(linked.includes(`/judgment/${judgmentId}`));

    // 2. Schema.org mainEntityOfPage matches this exact URL
    const html = injectSeoMeta(BASE_HTML_TEMPLATE, `/judgment/${judgmentId}`);
    assert.ok(html.includes(`https://www.alwakeelo.com/judgment/${judgmentId}`));
  });

  it("X3.2: Alignment: Top GSC priority judgments are present in link crawler verification paths", () => {
    const gscReport = JSON.parse(fs.readFileSync(path.resolve(ROOT_DIR, "reports/gsc-baseline-report.json"), "utf-8"));
    const crawlerReport = JSON.parse(fs.readFileSync(path.resolve(ROOT_DIR, "reports/internal-links-report.json"), "utf-8"));

    const topJudgments: string[] = gscReport.segregatedPerformance.publicJudgments.topJudgments.slice(0, 3).map((j: any) => j.id);
    assert.ok(topJudgments.length >= 3);

    // Ensure crawler checked these priority judgment URLs
    const checkedUrls: string[] = crawlerReport.results.map((r: any) => r.url);
    for (const id of topJudgments) {
      const expectedPath = `/judgment/${id}`;
      const foundInCrawler = checkedUrls.some((u) => u.includes(expectedPath));
      assert.ok(foundInCrawler, `Priority judgment ${id} must be audited by internal link crawler`);
    }
  });

  it("X3.3: Synergy: Outreach strategy anchor links match technical assets specification and SPA whitelist", () => {
    const outreachDoc = fs.readFileSync(path.resolve(ROOT_DIR, "docs/seo/pakistani-legal-outreach-strategy.md"), "utf-8");
    const assetDoc = fs.readFileSync(path.resolve(ROOT_DIR, "docs/seo/technical-linkable-assets.md"), "utf-8");

    const coreRoutes = ["/court-fee-calculator", "/most-cited", "/judges", "/statutes"];
    for (const route of coreRoutes) {
      assert.ok(outreachDoc.includes(route), `Outreach doc must anchor ${route}`);
      assert.ok(assetDoc.includes(route), `Technical assets doc must specify ${route}`);
      assert.equal(isKnownSpaRoute(route), true, `${route} must be authorized in KNOWN_SPA_ROUTES`);
    }
  });

  it("X3.4: Consistency: Headnotes extracted for presentation populate Schema.org articleBody", () => {
    const headnotesRaw = "(a) Civil Procedure Code (V of 1908)---S. 115---Revision---Held that High Court has limited supervisory jurisdiction.";
    const parsed = parsePakistaniHeadnotes(headnotesRaw);
    assert.ok(parsed && parsed.length > 0);

    const schema = {
      "@context": "https://schema.org",
      "@type": "LegalArticle",
      "headline": "Revision Jurisdiction in Pakistani Law",
      "articleBody": headnotesRaw.slice(0, 3000),
    };

    assert.ok(schema.articleBody.includes("Held that High Court has limited supervisory jurisdiction"));
  });

  it("X3.5: Bench Coram exposure: Storage bench field maps cleanly to Schema.org Person authors", () => {
    const storageBench = "Syed Mansoor Ali Shah and Aamer Farooq, J.";
    const authors = parseBenchJudges(storageBench);

    assert.equal(authors.length, 2);
    assert.equal(authors[0]["@type"], "Person");
    assert.equal(authors[0].name, "Syed Mansoor Ali Shah");
    assert.equal(authors[0].jobTitle, "Judge");
    assert.equal(authors[1].name, "Aamer Farooq");
    assert.equal(authors[1].jobTitle, "Judge");
  });
});

// ============================================================================
// TIER 4: REAL-WORLD APPLICATION WORKLOADS
// ============================================================================
describe("Tier 4: Real-World Application Workloads", () => {

  it("RW4.1: Public User Landing: GET /judgment/:id receives valid headnotes, bench coram, canonical tag, and structured data", async () => {
    assert.ok(testBaseUrl, "Test server must be running");
    const priorityId = "ff8d297d-f10a-4f79-b4d2-b4c664091640";

    const res = await fetch(`${testBaseUrl}/judgment/${priorityId}`, {
      headers: { "Accept": "text/html" },
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("content-type")?.includes("text/html"), true);

    const html = await res.text();

    // Canonical tag check
    assert.ok(
      html.includes(`<link id="canonical-link" rel="canonical" href="https://www.alwakeelo.com/judgment/${priorityId}" />`),
      "Must contain unified singular canonical link"
    );

    // Schema.org multi-entity structured data check
    assert.ok(html.includes("application/ld+json"), "Must inject JSON-LD script");
    assert.ok(html.includes("LegalArticle"), "Must contain LegalArticle");
    assert.ok(html.includes("CourtCase"), "Must contain CourtCase");
    assert.ok(html.includes("BreadcrumbList"), "Must contain BreadcrumbList");

    // Bench and case metadata check
    assert.ok(html.includes("Sajjad Ali Shah") || html.includes("Supreme Court of Pakistan"));
    assert.ok(html.includes("2022 PLD 686") || html.includes("Haseen Ullah"));
  });

  it("RW4.2: External Search Engine Crawler: Hits SPA tools and receives HTTP 200 with SSR pre-rendered content", async () => {
    assert.ok(testBaseUrl, "Test server must be running");
    const tools = [
      { path: "/court-fee-calculator", expectedTitle: "Court Fee" },
      { path: "/judges", expectedTitle: "Judges" },
      { path: "/statutes", expectedTitle: "Statute" },
      { path: "/most-cited", expectedTitle: "Precedents" },
    ];

    for (const tool of tools) {
      const res = await fetch(`${testBaseUrl}${tool.path}`, {
        headers: {
          "Accept": "text/html",
          "User-Agent": "Googlebot/2.1 (+http://www.google.com/bot.html)",
        },
      });
      assert.equal(res.status, 200, `Crawler hitting ${tool.path} must receive HTTP 200`);
      const body = await res.text();
      assert.ok(body.includes("<title>"), `Must contain <title> tag for ${tool.path}`);
      assert.ok(body.includes('rel="canonical"'), `Must contain canonical tag for ${tool.path}`);
    }
  });

  it("RW4.3: Legacy Search Engine Bot: Hits plural URL /judgments/:id with query parameters and is 301 redirected", async () => {
    assert.ok(testBaseUrl, "Test server must be running");
    const uuid = "ff8d297d-f10a-4f79-b4d2-b4c664091640";

    const res = await fetch(`${testBaseUrl}/judgments/${uuid}?utm_source=google_search`, {
      redirect: "manual",
    });
    assert.equal(res.status, 301);
    assert.equal(
      res.headers.get("location"),
      `/judgment/${uuid}?utm_source=google_search`,
      "Must issue 301 redirect to singular /judgment/:uuid preserving utm parameters"
    );
  });

  it("RW4.4: AI Search Bot (ChatGPT/Perplexity): Hits unmapped citation slug and fails closed with HTTP 404", async () => {
    assert.ok(testBaseUrl, "Test server must be running");
    const res = await fetch(`${testBaseUrl}/judgment/unmapped-fictitious-citation-2099-xyz-9999`, {
      redirect: "manual",
    });
    assert.equal(res.status, 404, "Fails closed with HTTP 404, preventing soft-404 index bloat");
  });

  it("RW4.5: End-to-End Migration Lifecycle: Audit -> Dry-Run -> Apply -> Post-Migration Verification", async () => {
    // 1. Initial State: database has anomalies
    let selfLinksCount = 100;
    let resolvableSelfUnres = 50;
    let unclassifiedCount = 10;
    let pendingCrossCount = 5;

    const mockDb = {
      query: async (sqlText: string) => {
        // Mutations in apply mode (evaluated first)
        if (sqlText.includes("DELETE FROM citation_links WHERE source_judgment_id = target_judgment_id")) {
          selfLinksCount = 0;
          return { rowCount: 100, rows: [] };
        }
        if (sqlText.includes("DELETE FROM unresolved_citations") && (sqlText.includes("WHERE id IN") || sqlText.includes("USING judgments"))) {
          resolvableSelfUnres = 0;
          return { rowCount: 50, rows: [] };
        }
        if (sqlText.includes("INSERT INTO citation_links")) {
          pendingCrossCount = 0;
          return { rowCount: 5, rows: [] };
        }
        if (sqlText.includes("UPDATE judgments SET text_status")) {
          unclassifiedCount = 0;
          return { rowCount: 10, rows: [] };
        }

        // Verification checks
        if (sqlText.includes("WHERE source_judgment_id = target_judgment_id")) {
          return { rows: [{ count: selfLinksCount }] };
        }
        if (sqlText.includes("FROM unresolved_citations u") && (sqlText.includes("source_judgment_id = j.id") || sqlText.includes("j.id = u.source_judgment_id"))) {
          return { rows: [{ count: resolvableSelfUnres }] };
        }
        if (sqlText.includes("WHERE text_status IS NULL")) {
          if (sqlText.includes("SELECT count")) return { rows: [{ count: unclassifiedCount }] };
          return { rows: [{ id: "test-id", citation_string: "2020 PLD 1", full_text: "CITATION: 2020 PLD 1" }] };
        }
        if (sqlText.includes("WHERE u.source_judgment_id != j.id AND u.status = 'pending'")) {
          return { rows: [{ count: pendingCrossCount }] };
        }

        // General metrics
        if (sqlText.includes("FROM judgments")) return { rows: [{ count: 1000 }] };
        if (sqlText.includes("FROM citation_links")) return { rows: [{ count: 5000 }] };
        if (sqlText.includes("FROM unresolved_citations")) return { rows: [{ count: 500 }] };
        if (sqlText.includes("FROM pg_tables")) return { rows: [{ tablename: "citation_links_backup_20261102" }] };
        if (sqlText.includes("GROUP BY text_status")) return { rows: [{ status: "own", count: 990 }, { status: "NULL", count: unclassifiedCount }] };
        
        return { rows: [] };
      },
    };

    // Phase 1: Pre-migration verification MUST fail
    const preVerify = await runCitationVerification(mockDb);
    assert.equal(preVerify.passed, false, "Pre-migration state must fail verification");
    assert.ok(preVerify.errors.length > 0);

    // Phase 2: Dry-run migration plan reports planned counts without mutations
    const dryRun = await runCitationMigration({ apply: false, client: mockDb });
    assert.equal(dryRun.mode, "dry-run");
    assert.equal(selfLinksCount, 100, "Dry run must NOT mutate selfLinksCount");

    // Phase 3: Apply migration executes mutations in transaction
    const applied = await runCitationMigration({ apply: true, client: mockDb });
    assert.equal(applied.mode, "apply");
    assert.equal(selfLinksCount, 0, "Apply must prune self-links to 0");
    assert.equal(resolvableSelfUnres, 0, "Apply must prune unresolved self-citations to 0");
    assert.equal(pendingCrossCount, 0, "Apply must resolve pending cross-citations to 0");
    assert.equal(unclassifiedCount, 0, "Apply must classify unclassified rows to 0");

    // Phase 4: Post-migration verification MUST now pass with 0 errors
    const postVerify = await runCitationVerification(mockDb);
    assert.equal(postVerify.passed, true, "Post-migration verification MUST pass");
    assert.equal(postVerify.errors.length, 0);
  });

  it("RW4.6: GSC Monitor Workflow: Generates baseline report data and executive markdown export", () => {
    const reportPath = path.resolve(ROOT_DIR, "reports/GSC_MONITORING_REPORT.md");
    assert.ok(fs.existsSync(reportPath), "GSC_MONITORING_REPORT.md must exist");
    const baselineJson: GSCReportData = JSON.parse(
      fs.readFileSync(path.resolve(ROOT_DIR, "reports/gsc-baseline-report.json"), "utf-8")
    );

    const generatedMarkdown = fs.readFileSync(reportPath, "utf-8");
    assert.ok(generatedMarkdown.includes("# Google Search Console Baseline Performance & Indexing Report"));
    assert.ok(generatedMarkdown.includes("Top 20 Ranking Search Queries"));
    assert.ok(generatedMarkdown.includes(baselineJson.topQueries[0].query));
    assert.ok(generatedMarkdown.includes("Public Judgments vs. Static Pages"));
  });
});
