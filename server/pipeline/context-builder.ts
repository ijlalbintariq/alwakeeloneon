/**
 * Context Builder
 *
 * Responsibility: Format retrieval results into structured context blocks
 *                 that the LLM can reliably use.
 *
 * Input  : RetrievalResult from retrieval-engine
 * Output : ContextOutput — the final string injected into the system prompt
 *          plus structured metadata for logging and the frontend
 *
 * Design rules:
 *  - Pure function: no I/O, no DB calls
 *  - One section per source type, clearly labeled
 *  - LLM instructions are co-located with the data they govern
 *  - Empty sections are omitted entirely — no ghost headings
 *  - Token budget is managed by the caller via trimTextToTokenBudget;
 *    this module does not truncate.
 */

import type { RetrievalResult, RetrievedCaseLaw, RetrievedStatute, RetrievedDoc } from "./retrieval-engine";
import { extractReportingMetadata, extractCaseType } from "./retrieval-engine";
import type { QueryIntent } from "./intent-classifier";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ContextSection {
  id: string;
  heading: string;
  lines: string[];
}

export interface ContextOutput {
  /** Final string to append to the system prompt */
  contextString: string;
  /** Sections included (for diagnostics) */
  sections: ContextSection[];
  /** Whether any DB-backed citations were found */
  hasCaseLawCitations: boolean;
  /** Whether any statutes were found */
  hasStatutes: boolean;
}

// ---------------------------------------------------------------------------
// Section builders
// ---------------------------------------------------------------------------

const EXCERPT_CHARS = 700;

function buildVerifiedJudgmentsSection(caseLaw: RetrievedCaseLaw[]): ContextSection | null {
  const lines: string[] = [];

  for (const { row } of caseLaw) {
    const citation = String(row.citation || "").trim();
    if (!citation) continue; // belt-and-suspenders: should be filtered upstream

    // Extract metadata based on citation format
    let courtName = String(row.court || "Pakistani Court");
    let reportingType = "";

    // If citation contains a legal code (PLD, SCMR, YLR, etc.), extract reporting type
    const legalCodeMatch = citation.match(/\b(pld|scmr|ylr|mld|clc|plj|nlr|pcrlj|ptcl|ptd|psc|ald|klr|plc|cld|air|lhc|ihc|shc|phc|bhc|ajkhc)\b/i);
    if (legalCodeMatch) {
      const metadata = extractReportingMetadata(legalCodeMatch[0]);
      reportingType = metadata.reportingType;
      // Use extracted court if row.court is generic
      if (courtName === "Pakistani Court" || !courtName) {
        courtName = metadata.court;
      }
    }
    // If citation is a case number, extract case type
    else if (/\b(c\.?a\.?|ca|civil\s+appeal|appeal|petition|writ|r\.?p\.?a\.?)\s*[\d\-a-z]+\s+of\s+\d{4}/i.test(citation)) {
      reportingType = extractCaseType(citation);
    }

    const title = String(row.title || "");
    const summary = row.summary ? ` — ${String(row.summary).slice(0, 250)}` : "";

    const reportingInfo = reportingType ? ` | REPORTING: ${reportingType}` : "";
    lines.push(`- CITATION: ${citation} | COURT: ${courtName}${reportingInfo} | TITLE: ${title}${summary}`);
  }

  if (lines.length === 0) return null;

  return {
    id: "verified-judgments",
    heading: "=== VERIFIED JUDGMENTS FROM INTERNAL DATABASE ===",
    lines: [
      "Use ONLY these citations. Copy each CITATION string EXACTLY. Format: **[CITATION STRING]** — explanation.",
      "FORBIDDEN: Do NOT use [I] [II] [A] (1) (2) placeholder notation. Every citation must be a real string from this list.",
      ...lines,
    ],
  };
}

function buildVerifiedStatutesSection(statutes: RetrievedStatute[]): ContextSection | null {
  if (statutes.length === 0) return null;
  const lines = statutes.map((s) => {
    const fullTitle = s.statuteDocumentTitle || s.shortTitle;
    const punishmentPart = s.punishment ? ` | PUNISHMENT: ${s.punishment}` : "";
    const openRef = fullTitle ? ` | [Open full statute: "${fullTitle}"]` : "";
    return `- STATUTE: ${fullTitle} | SECTION: ${s.section} | ${s.description}${punishmentPart}${openRef}`;
  });
  return {
    id: "verified-statutes",
    heading: "=== VERIFIED STATUTES FROM INTERNAL DATABASE ===",
    lines: [
      "Cite these statute names and sections exactly as shown. Show the full statute name, not the abbreviation.",
      "When referencing a section, tell the user they can open the full statute document from the statute library.",
      ...lines,
    ],
  };
}

function buildCaseLawDetailSection(caseLaw: RetrievedCaseLaw[]): ContextSection | null {
  if (caseLaw.length === 0) return null;
  const lines: string[] = [];
  for (const { row } of caseLaw) {
    const citation = String(row.citation || "").trim();
    if (!citation) continue;
    const excerptParts: string[] = [];
    if (row.summary) excerptParts.push(String(row.summary).slice(0, EXCERPT_CHARS));
    const detail = excerptParts.join(" ").trim();
    lines.push(`- ${citation} (${row.court}): ${row.title}`);
    if (detail) lines.push(`  Excerpt: ${detail}${detail.length >= EXCERPT_CHARS ? "..." : ""}`);
  }
  if (lines.length === 0) return null;
  return {
    id: "caselaw-detail",
    heading: "=== INTERNAL KNOWLEDGE VAULT: CASE LAW ===",
    lines,
  };
}

function buildStatutesDetailSection(statutes: RetrievedStatute[]): ContextSection | null {
  if (statutes.length === 0) return null;
  const lines = statutes.map(
    (s) => `- ${s.shortTitle} (Section ${s.section}): ${s.description}. Punishment: ${s.punishment}`,
  );
  return {
    id: "statutes-detail",
    heading: "=== INTERNAL KNOWLEDGE VAULT: STATUTES ===",
    lines,
  };
}

function buildAdminDocsSection(docs: RetrievedDoc[]): ContextSection | null {
  if (docs.length === 0) return null;
  const bySource: Record<string, RetrievedDoc[]> = {};
  for (const doc of docs) {
    (bySource[doc.source] = bySource[doc.source] || []).push(doc);
  }
  const lines: string[] = [];
  for (const [src, srcDocs] of Object.entries(bySource)) {
    const label =
      src === "github" ? "CHAMBERS LEGAL LIBRARY" :
      src === "org"    ? "ORGANIZATION KNOWLEDGE BASE" :
                         "CHAMBERS KNOWLEDGE VAULT (ADMIN)";
    lines.push(`--- ${label} ---`);
    for (const doc of srcDocs) {
      const excerpt = doc.content.slice(0, 1200);
      lines.push(`[${doc.title}]\n${excerpt}${doc.content.length > 1200 ? "..." : ""}`);
    }
  }
  if (lines.length === 0) return null;
  return {
    id: "admin-docs",
    heading: "=== SUPPLEMENTARY KNOWLEDGE ===",
    lines,
  };
}

// ---------------------------------------------------------------------------
// No-results message
// ---------------------------------------------------------------------------

function buildNoCaseLawMessage(intent: QueryIntent): string {
  const topicLabel = intent.topics.length > 0
    ? `"${intent.topics[0].label}"`
    : `this query`;
  return `[SYSTEM NOTE: No relevant case law found in the internal database for ${topicLabel}. Do NOT cite any cases. Write: "No relevant judgments are currently available in the internal database for this query."]`;
}

// ---------------------------------------------------------------------------
// Main builder
// ---------------------------------------------------------------------------

export function buildContext(
  intent: QueryIntent,
  retrieval: RetrievalResult,
): ContextOutput {
  const sections: ContextSection[] = [];

  // 1. Verified citations block (highest priority — comes first in prompt)
  const judgeSection = buildVerifiedJudgmentsSection(retrieval.caseLaw);
  if (judgeSection) sections.push(judgeSection);

  // 2. Verified statutes block
  const statSection = buildVerifiedStatutesSection(retrieval.statutes);
  if (statSection) sections.push(statSection);

  // 3. Case law detail block (excerpts)
  const detailSection = buildCaseLawDetailSection(retrieval.caseLaw);
  if (detailSection) sections.push(detailSection);

  // 4. Statutes detail
  const statDetailSection = buildStatutesDetailSection(retrieval.statutes);
  if (statDetailSection) sections.push(statDetailSection);

  // 5. Admin / Github / Org docs
  const adminSection = buildAdminDocsSection(retrieval.adminDocs);
  if (adminSection) sections.push(adminSection);

  const hasCaseLawCitations = !!judgeSection;
  const hasStatutes = !!statSection;

  // Build the context string
  const parts: string[] = [];

  // Preamble with instructions
  parts.push("REFERENCE MATERIALS:");
  parts.push("");

  if (hasCaseLawCitations) {
    parts.push("CASE LAW RULE: Only cite judgments listed in the VERIFIED JUDGMENTS section. Copy CITATION strings verbatim. Never invent citations.");
  } else if (intent.needsCaseLaw) {
    // No results — inject explicit instruction to prevent hallucination
    parts.push(buildNoCaseLawMessage(intent));
  }

  parts.push("STATUTE RULE: For well-known Pakistani statutes (PPC, CPC, Constitution, Family Courts Act, etc.) you may also cite from your training knowledge using full formal names.");
  parts.push("");

  for (const section of sections) {
    parts.push(section.heading);
    parts.push(...section.lines);
    parts.push("");
  }

  const contextString = parts.join("\n").trimEnd();

  return {
    contextString: contextString ? `\n\n${contextString}` : "",
    sections,
    hasCaseLawCitations,
    hasStatutes,
  };
}
