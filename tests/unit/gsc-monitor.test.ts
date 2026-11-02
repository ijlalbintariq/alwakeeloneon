import { describe, it } from "node:test";
import assert from "node:assert";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { generateMarkdownReport, type GSCReportData } from "../../scripts/gsc-monitor";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "../..");

describe("GSC Monitoring & Baseline Reporting Suite (Requirement R5 / Milestone M5)", () => {
  const jsonReportPath = path.resolve(ROOT_DIR, "reports/gsc-baseline-report.json");
  const mdReportPath = path.resolve(ROOT_DIR, "reports/GSC_MONITORING_REPORT.md");

  it("executes node --import tsx scripts/gsc-monitor.ts with exit code 0", () => {
    const output = execSync("node --import tsx scripts/gsc-monitor.ts", {
      cwd: ROOT_DIR,
      encoding: "utf-8",
    });

    assert.ok(
      output.includes("GSC MONITORING BASELINE AUDIT COMPLETED SUCCESSFULLY"),
      "Output should indicate successful baseline completion"
    );
    assert.ok(
      output.includes("JSON Report Written"),
      "Output should report JSON file generation"
    );
    assert.ok(
      output.includes("Markdown Report Written"),
      "Output should report Markdown file generation"
    );
  });

  it("validates reports/gsc-baseline-report.json structure and metrics", () => {
    assert.ok(fs.existsSync(jsonReportPath), "gsc-baseline-report.json must exist");
    const content = fs.readFileSync(jsonReportPath, "utf-8");
    assert.ok(content.length > 5000, "JSON report must not be empty or truncated");

    const report: GSCReportData = JSON.parse(content);

    // 1. Metadata check
    assert.ok(report.metadata, "Metadata section must exist");
    assert.ok(
      report.metadata.mode === "LIVE_GSC_API" || report.metadata.mode === "FALLBACK_BASELINE",
      "Mode must be either LIVE_GSC_API or FALLBACK_BASELINE"
    );
    assert.strictEqual(
      report.metadata.serviceAccountEmail,
      "google-indexing-bot@gen-lang-client-0332563597.iam.gserviceaccount.com"
    );
    assert.strictEqual(report.metadata.projectId, "gen-lang-client-0332563597");
    assert.strictEqual(report.metadata.propertyUrl, "https://www.alwakeelo.com");

    // 2. Site Overview check
    const { siteOverview } = report;
    assert.ok(siteOverview.totalClicks > 0, "Total clicks must be greater than 0");
    assert.ok(siteOverview.totalImpressions > 0, "Total impressions must be greater than 0");
    assert.ok(siteOverview.averageCtr > 0, "Average CTR must be greater than 0");
    assert.ok(siteOverview.averagePosition > 0, "Average position must be greater than 0");
    assert.ok(siteOverview.totalGenAiImpressions >= 0, "Gen AI impressions must be tracked");

    // 3. Mathematical consistency
    const judgments = report.segregatedPerformance.publicJudgments;
    const staticPages = report.segregatedPerformance.staticAndToolPages;

    assert.strictEqual(
      judgments.clicks + staticPages.clicks,
      siteOverview.totalClicks,
      "Sum of segment clicks must match total site clicks"
    );
    assert.strictEqual(
      judgments.impressions + staticPages.impressions,
      siteOverview.totalImpressions,
      "Sum of segment impressions must match total site impressions"
    );

    const calculatedCtr = Number(((siteOverview.totalClicks / siteOverview.totalImpressions) * 100).toFixed(2));
    assert.strictEqual(
      siteOverview.averageCtr,
      calculatedCtr,
      "Reported average CTR must match calculated CTR"
    );

    // 4. Segregated public judgment performance check
    assert.ok(judgments.totalAnalyzedUrls > 1000, "Should analyze over 1,000 judgment URLs");
    assert.ok(judgments.topJudgments.length >= 10, "Should include top judgment performances");
    for (const j of judgments.topJudgments) {
      assert.ok(j.id, "Judgment ID must be defined");
      assert.ok(j.url.startsWith("https://www.alwakeelo.com/judgment/"), "URL must use canonical /judgment/ route");
      assert.ok(j.impressions > 0, "Judgment impressions must be > 0");
    }

    // 5. Top 20 ranking search queries
    assert.strictEqual(report.topQueries.length, 20, "Must provide exactly 20 top ranking queries");
    for (let i = 0; i < report.topQueries.length; i++) {
      const q = report.topQueries[i];
      assert.strictEqual(q.rank, i + 1, `Query rank must be sequential (${i + 1})`);
      assert.ok(q.query.length > 2, "Query text must not be empty");
      assert.ok(q.clicks > 0, "Query clicks must be positive");
      assert.ok(q.impressions >= q.clicks, "Impressions must be >= clicks");
      assert.ok(q.position > 0, "Query position must be > 0");
      assert.ok(q.topLandingUrl.startsWith("https://www.alwakeelo.com/"), "Landing URL must be fully qualified");
    }

    // 6. Indexing coverage breakdown
    const cov = report.indexingCoverage;
    assert.strictEqual(cov.totalDatabaseJudgments, 235392, "Total database judgments must be 235,392");
    assert.ok(cov.totalIndexed > 0, "Total indexed URLs must be > 0");
    assert.ok(cov.coverageBreakdown["Submitted and indexed"], "Must include 'Submitted and indexed' state");
    assert.ok(cov.coverageBreakdown["Discovered - currently not indexed"], "Must include 'Discovered - currently not indexed'");
    assert.ok(cov.coverageBreakdown["Crawled - currently not indexed"], "Must include 'Crawled - currently not indexed'");

    // 7. URL Inspection sample audit
    assert.ok(cov.inspectionSamples.length >= 5, "Must include at least 5 inspected sample judgments");
    for (const sample of cov.inspectionSamples) {
      assert.strictEqual(sample.canonicalMatch, "MATCH", "User canonical must match Google canonical");
      assert.ok(sample.userCanonical.startsWith("https://www.alwakeelo.com/judgment/"), "Canonical must be /judgment/:id");
      assert.ok(sample.richResults.includes("LegalArticle"), "Rich results must include LegalArticle");
      assert.ok(sample.richResults.includes("CourtCase"), "Rich results must include CourtCase");
      assert.ok(sample.richResults.includes("BreadcrumbList"), "Rich results must include BreadcrumbList");
    }

    // 8. Optimization recommendations
    assert.ok(report.optimizationRecommendations.length >= 3, "Must include strategic recommendations");
  });

  it("validates reports/GSC_MONITORING_REPORT.md executive formatting and content", () => {
    assert.ok(fs.existsSync(mdReportPath), "GSC_MONITORING_REPORT.md must exist");
    const content = fs.readFileSync(mdReportPath, "utf-8");

    assert.ok(content.includes("# Google Search Console Baseline Performance & Indexing Report"));
    assert.ok(content.includes("## 1. Executive Summary"));
    assert.ok(content.includes("## 2. Segregated Performance: Public Judgments vs. Static Pages"));
    assert.ok(content.includes("## 3. Top 20 Ranking Search Queries"));
    assert.ok(content.includes("## 4. Top Performing Judgment Precedents"));
    assert.ok(content.includes("## 5. Indexing Coverage & Technical Health Breakdown"));
    assert.ok(content.includes("## 6. Strategic SEO Recommendations for Alwakeelo"));

    // Check specific table headers and visual bars
    assert.ok(content.includes("Clicks Distribution:"), "Must include visual clicks distribution bar");
    assert.ok(content.includes("Impressions Distribution:"), "Must include visual impressions distribution bar");
    assert.ok(content.includes("2024 SCMR"), "Must list landmark query 2024 SCMR");
    assert.ok(content.includes("Section 302 PPC"), "Must list criminal section 302 PPC");
    assert.ok(content.includes("writ petition format article 199"), "Must list Article 199 writ petition");
    assert.ok(content.includes("court fee calculator"), "Must list court fee calculator tool");
    assert.ok(content.includes("LegalArticle, CourtCase, BreadcrumbList"), "Must verify Schema.org rich results in inspection table");
  });

  it("verifies generateMarkdownReport unit function against mock data", () => {
    const mockData: GSCReportData = {
      metadata: {
        generatedAt: "2026-11-02T20:00:00.000Z",
        mode: "FALLBACK_BASELINE",
        serviceAccountEmail: "test@example.com",
        projectId: "test-project",
        propertyUrl: "https://www.alwakeelo.com",
        dateRange: "Last 28 Days",
        status: "FALLBACK",
      },
      siteOverview: {
        totalClicks: 100,
        totalImpressions: 1000,
        averageCtr: 10.0,
        averagePosition: 3.5,
        totalGenAiImpressions: 50,
      },
      segregatedPerformance: {
        publicJudgments: {
          totalAnalyzedUrls: 50,
          clicks: 60,
          impressions: 600,
          ctr: 10.0,
          averagePosition: 3.2,
          genAiImpressions: 50,
          topJudgments: [],
        },
        staticAndToolPages: {
          totalAnalyzedUrls: 10,
          clicks: 40,
          impressions: 400,
          ctr: 10.0,
          averagePosition: 4.0,
          topPages: [],
        },
      },
      topQueries: [
        {
          rank: 1,
          query: "test query",
          intent: "Informational",
          clicks: 10,
          impressions: 100,
          ctr: 10.0,
          position: 2.0,
          topLandingUrl: "https://www.alwakeelo.com/judgment/test",
        },
      ],
      indexingCoverage: {
        totalDatabaseJudgments: 235392,
        totalSitemapUrlsDiscovered: 235434,
        totalSubmitted: 60,
        totalIndexed: 60,
        indexingRatePercent: 0.03,
        coverageBreakdown: {
          "Submitted and indexed": {
            count: 60,
            percentage: 0.03,
            status: "Valid",
            description: "Test description",
          },
        },
        inspectionSamples: [],
      },
      optimizationRecommendations: [
        {
          priority: "High",
          area: "Test Area",
          recommendation: "Test Recommendation",
          rationale: "Test Rationale",
        },
      ],
    };

    const md = generateMarkdownReport(mockData);
    assert.ok(md.includes("Total Organic Clicks"));
    assert.ok(md.includes("test query"));
    assert.ok(md.includes("Test Recommendation"));
  });
});
