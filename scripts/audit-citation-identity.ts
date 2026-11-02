/**
 * scripts/audit-citation-identity.ts
 *
 * Automated Database Citation Identity & Metadata Audit Tool
 *
 * Scans the Alwakeelo database for citation mapping anomalies:
 * - Self-referential citation links (source_judgment_id = target_judgment_id)
 * - Self-citations in unresolved_citations backlog
 * - Unclassified text status (text_status IS NULL) and mislabeled text
 * - Mismatched metadata (petitioner = respondent, null courts, null decision dates)
 *
 * Outputs structured report to: reports/citation-audit-report.json
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import pg from "pg";

const { Client } = pg;

export interface CitationAuditReport {
  timestamp: string;
  auditVersion: string;
  database: {
    totalJudgments: number;
    totalCitationLinks: number;
    totalUnresolvedCitations: number;
  };
  citationLinks: {
    total: number;
    validCrossLinks: number;
    selfReferentialLinks: number;
    orphanedLinks: number;
    sampleSelfLinks: Array<{
      id: number;
      sourceJudgmentId: string;
      citationText: string;
    }>;
  };
  unresolvedCitations: {
    totalPending: number;
    selfCitations: number;
    resolvableCrossCitations: number;
    externalOrMalformed: number;
    sampleResolvableCross: Array<{
      id: number;
      sourceJudgmentId: string;
      rawCitation: string;
      targetJudgmentId: string;
    }>;
  };
  textProvenance: {
    total: number;
    own: number;
    mislabeled: number;
    unknown: number;
    unclassified: number;
  };
  metadataQuality: {
    nullDecisionDates: number;
    nullCourts: number;
    nullPetitioners: number;
    nullRespondents: number;
    identicalParties: number;
    sampleIdenticalParties: Array<{
      id: string;
      citation: string;
      petitioner: string;
      respondent: string;
    }>;
  };
  healthScores: {
    citationGraphIntegrity: number;
    unresolvedCleanliness: number;
    provenanceClassification: number;
    metadataCompleteness: number;
    overallHealthScore: number;
  };
  recommendations: string[];
}

/**
 * Resolves DATABASE_URL from process.env, .env, or client/src/experimental/alwakeeloneon-1.env.
 */
export function resolveDatabaseUrl(): string {
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim()) {
    return process.env.DATABASE_URL.trim().replace(/^["']|["']$/g, "");
  }

  const candidatePaths = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "client/src/experimental/alwakeeloneon-1.env"),
  ];

  for (const envPath of candidatePaths) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf8");
      for (const line of content.split(/\r?\n/)) {
        const match = line.match(/^\s*DATABASE_URL\s*=\s*(.*)$/);
        if (match) {
          const val = match[1].trim().replace(/^["']|["']$/g, "");
          if (val) return val;
        }
      }
    }
  }

  throw new Error(
    "DATABASE_URL could not be found in process.env, .env, or client/src/experimental/alwakeeloneon-1.env"
  );
}

/**
 * Computes a canonical alphanumeric key for Pakistani legal citations,
 * collapsing spaced acronyms (e.g., 'S C M R' -> 'SCMR') and normalizing dotted variants.
 */
export function canonicalCitationKey(raw: string): string {
  let s = String(raw || "").toUpperCase();

  // Canonicalize dotted/spaced journal abbreviations
  s = s.replace(/P\s*\.?\s*CR?\s*\.?\s*L\s*\.?\s*J\s*\.?\s*N(?:OTES?)?/gi, " PCRLJN ");
  s = s.replace(/P\s*\.?\s*CR?\s*\.?\s*L\s*\.?\s*J/gi, " PCRLJ ");
  s = s.replace(/PLC\s*\(?\s*C\.?\s*S\.?\s*\)?\s*N(?:OTES?)?/gi, " PLCCSN ");
  s = s.replace(/PLC\s*\(?\s*C\.?\s*S\.?\s*\)?/gi, " PLCCS ");
  s = s.replace(/Y\s*\.?\s*L\s*\.?\s*R\s*\.?\s*N(?:OTES?)?/gi, " YLRN ");
  s = s.replace(/C\s*\.?\s*L\s*\.?\s*C\s*\.?\s*N(?:OTES?)?/gi, " CLCN ");
  s = s.replace(/\bPLC\s*N(?:OTES?)?\b/gi, " PLCN ");
  s = s.replace(/S\s*\.?\s*C\s*\.?\s*M\s*\.?\s*R\s*\.?/gi, " SCMR ");
  s = s.replace(/P\s*\.?\s*L\s*\.?\s*D\s*\.?/gi, " PLD ");
  s = s.replace(/G\s*\.?\s*B\s*\.?\s*L\s*\.?\s*R\s*\.?/gi, " GBLR ");

  // Strip punctuation and split letters/digits
  s = s.replace(/[.,()\[\]\/-]/g, " ");
  s = s.replace(/([A-Z])(\d)/g, "$1 $2").replace(/(\d)([A-Z])/g, "$1 $2");

  const rawTokens = s.split(/\s+/).filter(Boolean);
  const tokens: string[] = [];
  for (const t of rawTokens) {
    const prev = tokens[tokens.length - 1];
    if (t.length === 1 && /^[A-Z]$/.test(t) && prev && /^[A-Z]+$/.test(prev) && prev.length <= 5) {
      tokens[tokens.length - 1] = prev + t;
    } else {
      tokens.push(t);
    }
  }

  return tokens.join("").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Classifies a judgment's text provenance based on its header lines.
 */
export function classifyJudgmentHeader(
  storedCitation: string,
  fullText: string
): { status: "own" | "mislabeled" | "unknown"; trueCitation: string | null } {
  const header = (fullText || "").slice(0, 4000);
  const citationField = header.match(/(?:^|\n)\s*CITATION\s*:\s*([^\r\n]+)/i)?.[1]?.trim();
  const reportedAs = header.match(/(?:^|\n)\s*Reported\s+As\s*:\s*([^\r\n]+)/i)?.[1]?.trim();
  const announced = citationField || reportedAs;

  if (announced && announced.toLowerCase() !== "none" && announced.toLowerCase() !== "null") {
    const canonAnnounced = canonicalCitationKey(announced);
    const canonStored = canonicalCitationKey(storedCitation);

    if (
      canonAnnounced === canonStored ||
      canonAnnounced.includes(canonStored) ||
      canonStored.includes(canonAnnounced)
    ) {
      return { status: "own", trueCitation: null };
    } else {
      return { status: "mislabeled", trueCitation: announced };
    }
  }

  // Fallback: search initial lines for printed reporter headers
  const lines = header.split(/\r?\n/).slice(0, 25);
  const canonStored = canonicalCitationKey(storedCitation);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 5 && trimmed.length < 80) {
      const lineKey = canonicalCitationKey(trimmed);
      if (lineKey.includes(canonStored) || canonStored.includes(lineKey)) {
        return { status: "own", trueCitation: null };
      }
    }
  }

  return { status: "unknown", trueCitation: null };
}

/**
 * Executes the complete citation identity and metadata audit against a database client.
 */
export async function runCitationIdentityAudit(
  clientOrPool?: any
): Promise<CitationAuditReport> {
  let client = clientOrPool;
  let ownClient = false;

  if (!client) {
    const connectionString = resolveDatabaseUrl();
    client = new Client({
      connectionString,
      options: "-c default_transaction_read_only=on",
      statement_timeout: 60000,
    });
    await client.connect();
    ownClient = true;
  }

  try {
    // 1. Total judgments
    const judgmentsRes = await client.query(
      "SELECT count(*)::int as count FROM judgments"
    );
    const totalJudgments = Number(judgmentsRes.rows[0]?.count || 0);

    // 2. Citation Links Breakdown
    const linksTotalRes = await client.query(
      "SELECT count(*)::int as count FROM citation_links"
    );
    const totalCitationLinks = Number(linksTotalRes.rows[0]?.count || 0);

    const selfLinksRes = await client.query(
      "SELECT count(*)::int as count FROM citation_links WHERE source_judgment_id = target_judgment_id"
    );
    const selfReferentialLinks = Number(selfLinksRes.rows[0]?.count || 0);

    const validCrossLinks = Math.max(0, totalCitationLinks - selfReferentialLinks);

    const sampleSelfLinksRes = await client.query(
      "SELECT id, source_judgment_id, citation_text FROM citation_links WHERE source_judgment_id = target_judgment_id LIMIT 5"
    );
    const sampleSelfLinks = sampleSelfLinksRes.rows.map((r: any) => ({
      id: Number(r.id),
      sourceJudgmentId: String(r.source_judgment_id),
      citationText: String(r.citation_text || ""),
    }));

    // 3. Unresolved Citations Backlog Breakdown
    const unresTotalRes = await client.query(
      "SELECT count(*)::int as count FROM unresolved_citations WHERE status = 'pending'"
    );
    const totalPendingUnresolved = Number(unresTotalRes.rows[0]?.count || 0);

    const selfUnresRes = await client.query(`
      SELECT count(*)::int as count 
      FROM unresolved_citations u 
      JOIN judgments j ON j.id = u.source_judgment_id 
        AND (LOWER(TRIM(j.citation_string)) = LOWER(TRIM(u.raw_citation)) 
             OR (j.year = u.year AND j.page = u.page))
      WHERE u.status = 'pending'
    `);
    const selfCitations = Number(selfUnresRes.rows[0]?.count || 0);

    const resolvableCrossRes = await client.query(`
      SELECT count(*)::int as count 
      FROM unresolved_citations u 
      JOIN judgments j ON LOWER(TRIM(j.citation_string)) = LOWER(TRIM(u.raw_citation)) 
      WHERE u.source_judgment_id != j.id AND u.status = 'pending'
    `);
    const resolvableCrossCitations = Number(resolvableCrossRes.rows[0]?.count || 0);

    const externalOrMalformed = Math.max(
      0,
      totalPendingUnresolved - selfCitations - resolvableCrossCitations
    );

    const sampleCrossRes = await client.query(`
      WITH matches AS MATERIALIZED (
        SELECT u.id, u.source_judgment_id, u.raw_citation, j.id as target_judgment_id
        FROM unresolved_citations u 
        JOIN judgments j ON LOWER(TRIM(j.citation_string)) = LOWER(TRIM(u.raw_citation)) 
        WHERE u.source_judgment_id != j.id AND u.status = 'pending'
      )
      SELECT * FROM matches LIMIT 5
    `);
    const sampleResolvableCross = sampleCrossRes.rows.map((r: any) => ({
      id: Number(r.id),
      sourceJudgmentId: String(r.source_judgment_id),
      rawCitation: String(r.raw_citation),
      targetJudgmentId: String(r.target_judgment_id),
    }));

    // 4. Text Provenance Breakdown
    const provenanceRes = await client.query(`
      SELECT COALESCE(text_status, 'NULL') as status, count(*)::int as count 
      FROM judgments 
      GROUP BY text_status
    `);
    let ownCount = 0;
    let mislabeledCount = 0;
    let unknownCount = 0;
    let unclassifiedCount = 0;

    for (const r of provenanceRes.rows) {
      const s = String(r.status);
      const c = Number(r.count);
      if (s === "own") ownCount = c;
      else if (s === "mislabeled") mislabeledCount = c;
      else if (s === "unknown") unknownCount = c;
      else if (s === "NULL") unclassifiedCount = c;
    }

    // 5. Metadata Quality
    const metadataRes = await client.query(`
      SELECT 
        count(*) FILTER (WHERE decision_date IS NULL)::int as null_dates,
        count(*) FILTER (WHERE court_id IS NULL AND court_name_snapshot IS NULL)::int as null_courts,
        count(*) FILTER (WHERE petitioner IS NULL)::int as null_petitioners,
        count(*) FILTER (WHERE respondent IS NULL)::int as null_respondents,
        count(*) FILTER (WHERE petitioner IS NOT NULL AND respondent IS NOT NULL AND LOWER(TRIM(petitioner)) = LOWER(TRIM(respondent)))::int as identical_parties
      FROM judgments
    `);
    const metaRow = metadataRes.rows[0] || {};
    const nullDecisionDates = Number(metaRow.null_dates || 0);
    const nullCourts = Number(metaRow.null_courts || 0);
    const nullPetitioners = Number(metaRow.null_petitioners || 0);
    const nullRespondents = Number(metaRow.null_respondents || 0);
    const identicalParties = Number(metaRow.identical_parties || 0);

    const sampleIdenticalRes = await client.query(`
      SELECT id, citation_string, petitioner, respondent 
      FROM judgments 
      WHERE petitioner IS NOT NULL AND respondent IS NOT NULL AND LOWER(TRIM(petitioner)) = LOWER(TRIM(respondent))
      LIMIT 5
    `);
    const sampleIdenticalParties = sampleIdenticalRes.rows.map((r: any) => ({
      id: String(r.id),
      citation: String(r.citation_string),
      petitioner: String(r.petitioner),
      respondent: String(r.respondent),
    }));

    // 6. Compute Health Scores (0 to 100)
    const citationGraphIntegrity =
      totalCitationLinks > 0
        ? Number(((validCrossLinks / totalCitationLinks) * 100).toFixed(1))
        : 100;

    const unresolvedCleanliness =
      totalPendingUnresolved > 0
        ? Number(
            (
              ((totalPendingUnresolved - selfCitations) / totalPendingUnresolved) *
              100
            ).toFixed(1)
          )
        : 100;

    const provenanceClassification =
      totalJudgments > 0
        ? Number(
            (
              ((totalJudgments - unclassifiedCount) / totalJudgments) *
              100
            ).toFixed(1)
          )
        : 100;

    const metadataCompleteness =
      totalJudgments > 0
        ? Number(
            (
              (1 -
                (nullDecisionDates + nullCourts + identicalParties) /
                  (totalJudgments * 3)) *
              100
            ).toFixed(1)
          )
        : 100;

    const overallHealthScore = Number(
      (
        citationGraphIntegrity * 0.35 +
        unresolvedCleanliness * 0.25 +
        provenanceClassification * 0.25 +
        metadataCompleteness * 0.15
      ).toFixed(1)
    );

    // 7. Formulate Recommendations
    const recommendations: string[] = [];
    if (selfReferentialLinks > 0) {
      recommendations.push(
        `Prune ${selfReferentialLinks.toLocaleString()} self-referential citation links from citation_links.`
      );
    }
    if (selfCitations > 0) {
      recommendations.push(
        `Prune ${selfCitations.toLocaleString()} self-citations from unresolved_citations backlog.`
      );
    }
    if (resolvableCrossCitations > 0) {
      recommendations.push(
        `Resolve ${resolvableCrossCitations} cross-citations into citation_links linking valid precedents.`
      );
    }
    if (unclassifiedCount > 0) {
      recommendations.push(
        `Classify ${unclassifiedCount} unclassified judgments (text_status IS NULL) using header inspection.`
      );
    }
    if (identicalParties > 0) {
      recommendations.push(
        `Review and repair ${identicalParties.toLocaleString()} judgments with identical parties (Petitioner = Respondent).`
      );
    }
    if (recommendations.length === 0) {
      recommendations.push("Citation and metadata health is optimal. No action required.");
    }

    const report: CitationAuditReport = {
      timestamp: new Date().toISOString(),
      auditVersion: "1.0.0",
      database: {
        totalJudgments,
        totalCitationLinks,
        totalUnresolvedCitations: totalPendingUnresolved,
      },
      citationLinks: {
        total: totalCitationLinks,
        validCrossLinks,
        selfReferentialLinks,
        orphanedLinks: 0,
        sampleSelfLinks,
      },
      unresolvedCitations: {
        totalPending: totalPendingUnresolved,
        selfCitations,
        resolvableCrossCitations,
        externalOrMalformed,
        sampleResolvableCross,
      },
      textProvenance: {
        total: totalJudgments,
        own: ownCount,
        mislabeled: mislabeledCount,
        unknown: unknownCount,
        unclassified: unclassifiedCount,
      },
      metadataQuality: {
        nullDecisionDates,
        nullCourts,
        nullPetitioners,
        nullRespondents,
        identicalParties,
        sampleIdenticalParties,
      },
      healthScores: {
        citationGraphIntegrity,
        unresolvedCleanliness,
        provenanceClassification,
        metadataCompleteness,
        overallHealthScore,
      },
      recommendations,
    };

    return report;
  } finally {
    if (ownClient && client) {
      await client.end().catch(() => {});
    }
  }
}

/**
 * CLI execution handler.
 */
async function main() {
  console.log("=== Alwakeelo Citation Identity & Metadata Audit ===");
  const report = await runCitationIdentityAudit();

  const reportsDir = path.resolve(process.cwd(), "reports");
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const outputPath = path.join(reportsDir, "citation-audit-report.json");
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), "utf8");

  console.log("\nAudit Findings Summary:");
  console.log("--------------------------------------------------");
  console.log(`Total Judgments                 : ${report.database.totalJudgments.toLocaleString()}`);
  console.log(`Total Citation Links            : ${report.database.totalCitationLinks.toLocaleString()}`);
  console.log(`  - Valid Cross-Links           : ${report.citationLinks.validCrossLinks.toLocaleString()}`);
  console.log(`  - Self-Referential Links      : ${report.citationLinks.selfReferentialLinks.toLocaleString()} [ANOMALY]`);
  console.log(`Total Unresolved Citations      : ${report.unresolvedCitations.totalPending.toLocaleString()}`);
  console.log(`  - Self-Citations in Backlog   : ${report.unresolvedCitations.selfCitations.toLocaleString()} [ANOMALY]`);
  console.log(`  - Resolvable Cross-Citations  : ${report.unresolvedCitations.resolvableCrossCitations}`);
  console.log(`  - External / Unindexed        : ${report.unresolvedCitations.externalOrMalformed.toLocaleString()}`);
  console.log(`Text Provenance:`);
  console.log(`  - 'own'                       : ${report.textProvenance.own.toLocaleString()}`);
  console.log(`  - 'mislabeled'                : ${report.textProvenance.mislabeled.toLocaleString()}`);
  console.log(`  - 'unknown'                   : ${report.textProvenance.unknown.toLocaleString()}`);
  console.log(`  - 'unclassified' (NULL)       : ${report.textProvenance.unclassified.toLocaleString()} [PENDING]`);
  console.log(`Metadata Quality:`);
  console.log(`  - NULL Decision Dates         : ${report.metadataQuality.nullDecisionDates.toLocaleString()}`);
  console.log(`  - NULL Courts                 : ${report.metadataQuality.nullCourts.toLocaleString()}`);
  console.log(`  - Identical Parties (P=R)     : ${report.metadataQuality.identicalParties.toLocaleString()}`);
  console.log("--------------------------------------------------");
  console.log(`Overall Health Score            : ${report.healthScores.overallHealthScore}%`);
  console.log(`Report successfully written to  : ${outputPath}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error("Audit failed:", err);
    process.exit(1);
  });
}
