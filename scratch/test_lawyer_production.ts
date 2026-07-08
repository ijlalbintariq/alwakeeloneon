/**
 * Production Legal Query Test — Lawyer's Perspective
 * 
 * Tests real Pakistani legal queries across Standard, Turbo, and Apex modes.
 * Evaluates statute and case law retrieval quality from a practicing lawyer's POV.
 */
import { classifyQueryIntent } from "../server/pipeline/intent-classifier";
import { runRetrieval } from "../server/pipeline/retrieval-engine";

const TEST_USER_ID = "global-admin-judgments";

// Real-world legal queries a Pakistani lawyer would ask
const LEGAL_QUERIES = [
  {
    label: "Criminal — Bail in Non-Bailable Offense",
    query: "What are the grounds for granting bail under Section 497 CrPC in murder cases in Pakistan?",
    expectedStatutes: ["CrPC", "Section 497"],
    expectedCaseLaw: ["bail", "murder", "Supreme Court"],
  },
  {
    label: "Constitutional — Fundamental Rights",
    query: "What does Article 10-A of the Constitution of Pakistan say about right to fair trial and due process?",
    expectedStatutes: ["Constitution", "Article 10-A"],
    expectedCaseLaw: ["fundamental rights", "due process"],
  },
  {
    label: "Family Law — Khula / Dissolution of Marriage",
    query: "What is the legal procedure for obtaining Khula under the Dissolution of Muslim Marriages Act 1939?",
    expectedStatutes: ["Dissolution of Muslim Marriages", "1939"],
    expectedCaseLaw: ["khula", "dissolution"],
  },
  {
    label: "Civil — Specific Performance of Contract",
    query: "Under what conditions can specific performance of a contract be granted under the Specific Relief Act 1877?",
    expectedStatutes: ["Specific Relief Act", "1877"],
    expectedCaseLaw: ["specific performance", "contract"],
  },
  {
    label: "Criminal — Anti-Terrorism Offenses",
    query: "What constitutes an act of terrorism under Section 6 of the Anti-Terrorism Act 1997 and what are the penalties?",
    expectedStatutes: ["Anti-Terrorism Act", "Section 6", "1997"],
    expectedCaseLaw: ["terrorism", "ATA"],
  },
];

interface TestResult {
  label: string;
  query: string;
  durationMs: number;
  intent: any;
  statutes: { keyword: any[]; voyage: any[] };
  caseLaw: any[];
  adminDocs: any[];
  lawyerAnalysis: string;
}

async function runTest(q: typeof LEGAL_QUERIES[0]): Promise<TestResult> {
  const t0 = Date.now();
  
  const intent = classifyQueryIntent(q.query);
  const retrieval = await runRetrieval(intent, TEST_USER_ID, {
    caseLaw: 10,
    statutes: 6,
    adminDocs: 8,
  });

  const durationMs = Date.now() - t0;

  // Separate Voyage statute chunks from other admin docs
  const voyageStatutes = (retrieval.adminDocs || []).filter((d: any) => d.source === "statute");
  const otherAdminDocs = (retrieval.adminDocs || []).filter((d: any) => d.source !== "statute");

  // Lawyer-grade analysis
  const analysis: string[] = [];

  // Evaluate statute quality
  if (voyageStatutes.length > 0) {
    const relevantStatutes = voyageStatutes.filter((s: any) => {
      const content = (s.title + " " + s.content).toLowerCase();
      return q.expectedStatutes.some(kw => content.includes(kw.toLowerCase()));
    });
    const pct = Math.round((relevantStatutes.length / voyageStatutes.length) * 100);
    analysis.push(`Voyage Statutes: ${relevantStatutes.length}/${voyageStatutes.length} relevant (${pct}% precision)`);
    if (pct >= 80) analysis.push("→ EXCELLENT: Would cite in court filing");
    else if (pct >= 50) analysis.push("→ GOOD: Useful for research, needs filtering");
    else analysis.push("→ WEAK: Off-topic statutes, needs improvement");
  } else {
    analysis.push("Voyage Statutes: NONE — critical gap for legal research");
  }

  // Evaluate keyword statutes
  if ((retrieval.statutes || []).length > 0) {
    analysis.push(`Keyword Statutes: ${retrieval.statutes.length} sections found`);
  }

  // Evaluate case law
  if ((retrieval.caseLaw || []).length > 0) {
    analysis.push(`Case Law: ${retrieval.caseLaw.length} judgments`);
    const topCases = retrieval.caseLaw.slice(0, 3);
    const hasRelevant = topCases.some((c: any) => {
      const text = ((c.title || "") + " " + (c.caseName || "") + " " + (c.summary || "")).toLowerCase();
      return q.expectedCaseLaw.some(kw => text.includes(kw.toLowerCase()));
    });
    if (hasRelevant) analysis.push("→ Top cases appear topically relevant");
    else analysis.push("→ Top cases may need manual filtering");
  } else {
    analysis.push("Case Law: NONE");
  }

  return {
    label: q.label,
    query: q.query,
    durationMs,
    intent,
    statutes: { keyword: retrieval.statutes || [], voyage: voyageStatutes },
    caseLaw: retrieval.caseLaw || [],
    adminDocs: otherAdminDocs,
    lawyerAnalysis: analysis.join("\n"),
  };
}

async function main() {
  console.log("═".repeat(80));
  console.log("PRODUCTION LEGAL QUERY TEST — Lawyer's Perspective");
  console.log("═".repeat(80));
  console.log(`Database: ${(process.env.DATABASE_URL || "").split("@")[1]?.split("/")[0] || "?"}`);
  console.log(`Voyage API: ${!!process.env.VOYAGE_API_KEY}`);
  console.log(`Time: ${new Date().toISOString()}\n`);

  const results: TestResult[] = [];

  for (const q of LEGAL_QUERIES) {
    console.log("─".repeat(80));
    console.log(`📋 ${q.label}`);
    console.log(`   "${q.query}"`);
    console.log("─".repeat(80));

    try {
      const result = await runTest(q);
      results.push(result);

      console.log(`  Intent: ${result.intent.type} | needsStatutes=${result.intent.needsStatutes} | needsAdminDocs=${result.intent.needsAdminDocs}`);
      console.log(`  Duration: ${result.durationMs}ms\n`);

      // Voyage Statute Chunks (the main focus)
      console.log(`  📜 VOYAGE STATUTE CHUNKS: ${result.statutes.voyage.length}`);
      for (const s of result.statutes.voyage) {
        const snippet = (s.content || "").replace(/\n/g, " ").slice(0, 100);
        console.log(`    • "${s.title}" → ${snippet}...`);
      }

      // Keyword Statutes
      console.log(`\n  📖 KEYWORD STATUTES: ${result.statutes.keyword.length}`);
      for (const s of result.statutes.keyword.slice(0, 4)) {
        console.log(`    • [score=${s.relevanceScore}] ${s.actName || "?"} § ${s.sectionNumber || s.sectionTitle || "?"}`);
      }

      // Case Law
      console.log(`\n  ⚖️  CASE LAW: ${result.caseLaw.length}`);
      for (const c of result.caseLaw.slice(0, 5)) {
        const court = c.court || "?";
        const year = c.year || "?";
        const name = c.caseName || c.title || "Unnamed";
        console.log(`    • [${court}, ${year}] ${String(name).slice(0, 80)}`);
      }

      // Lawyer's Verdict
      console.log(`\n  🧑‍⚖️ LAWYER'S ASSESSMENT:`);
      for (const line of result.lawyerAnalysis.split("\n")) {
        console.log(`    ${line}`);
      }
      console.log();
    } catch (err: any) {
      console.error(`  ❌ ERROR: ${err.message}\n`);
    }
  }

  // Summary
  console.log("═".repeat(80));
  console.log("SUMMARY");
  console.log("═".repeat(80));
  
  let passCount = 0;
  for (const r of results) {
    const hasVoyage = r.statutes.voyage.length > 0;
    const hasCaseLaw = r.caseLaw.length > 0;
    const hasKeyword = r.statutes.keyword.length > 0;
    const status = hasVoyage && (hasCaseLaw || hasKeyword) ? "✅" : hasVoyage || hasCaseLaw ? "⚠️" : "❌";
    if (status === "✅") passCount++;
    console.log(`  ${status} ${r.label}: ${r.statutes.voyage.length} voyage statutes, ${r.statutes.keyword.length} keyword statutes, ${r.caseLaw.length} case law (${r.durationMs}ms)`);
  }
  console.log(`\n  Overall: ${passCount}/${results.length} queries fully satisfied`);
  console.log(`  Average duration: ${Math.round(results.reduce((a, r) => a + r.durationMs, 0) / results.length)}ms`);

  process.exit(0);
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
