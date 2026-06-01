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

// Excerpt lengths by source: judgment rows have rich headnotes so get more chars
const EXCERPT_CHARS_JUDGMENT = 600;
const EXCERPT_CHARS_EXTRACTED = 300;

function buildVerifiedJudgmentsSection(caseLaw: RetrievedCaseLaw[]): ContextSection | null {
  const lines: string[] = [];

  for (const { row } of caseLaw) {
    const citation = String(row.citation || "").trim();
    if (!citation) continue;

    // Extract metadata based on citation format
    let courtName = String(row.court || "Pakistani Court");
    let reportingType = "";

    const legalCodeMatch = citation.match(/\b(pld|scmr|ylr|mld|clc|plj|nlr|pcrlj|ptcl|ptd|psc|ald|klr|plc|cld|air|lhc|ihc|shc|phc|bhc|ajkhc)\b/i);
    if (legalCodeMatch) {
      const metadata = extractReportingMetadata(legalCodeMatch[0]);
      reportingType = metadata.reportingType;
      if (courtName === "Pakistani Court" || !courtName) {
        courtName = metadata.court;
      }
    } else if (/\b(c\.?a\.?|ca|civil\s+appeal|appeal|petition|writ|r\.?p\.?a\.?)\s*[\d\-a-z]+\s+of\s+\d{4}/i.test(citation)) {
      reportingType = extractCaseType(citation);
    }

    const title = String(row.title || "");
    // Judgment rows store headnotes in summary (set by searchJudgmentsByKeywords).
    // Give them a longer excerpt — headnotes are the most legally precise part of a judgment.
    const excerptLen = row.sourceType === "judgment" ? EXCERPT_CHARS_JUDGMENT : EXCERPT_CHARS_EXTRACTED;
    const summary = row.summary ? ` — ${String(row.summary).slice(0, excerptLen)}` : "";

    const reportingInfo = reportingType ? ` | REPORTING: ${reportingType}` : "";
    // Judgment rows: mark explicitly so AI knows this is from the verified DB
    const sourceTag = row.sourceType === "judgment" ? " | SOURCE: Verified Judgment DB" : "";
    lines.push(`- CITATION: ${citation} | COURT: ${courtName}${reportingInfo}${sourceTag} | TITLE: ${title}${summary}`);
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
    const isJudgment = row.sourceType === "judgment";
    const excerptLen = isJudgment ? EXCERPT_CHARS_JUDGMENT : EXCERPT_CHARS_EXTRACTED;
    const detail = row.summary ? String(row.summary).slice(0, excerptLen) : "";
    // Judgment rows get a clear label so the AI treats them as authoritative
    const rowLabel = isJudgment ? "JUDGMENT" : "CASE";
    lines.push(`- [${rowLabel}] ${citation} (${row.court}): ${row.title}`);
    if (detail) lines.push(`  ${isJudgment ? "Headnotes" : "Excerpt"}: ${detail}${detail.length >= excerptLen ? "..." : ""}`);
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
      const excerpt = doc.content.slice(0, 3000);
      lines.push(`[${doc.title}]\n${excerpt}${doc.content.length > 3000 ? "..." : ""}`);
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

  const statuteFirst = !!intent.statuteRef || intent.type === "statute" || intent.type === "general-legal";

  const judgeSection = buildVerifiedJudgmentsSection(retrieval.caseLaw);
  const statSection  = buildVerifiedStatutesSection(retrieval.statutes);
  const detailSection    = buildCaseLawDetailSection(retrieval.caseLaw);
  const statDetailSection = buildStatutesDetailSection(retrieval.statutes);

  if (statuteFirst) {
    // Statute queries: statutes first so the AI leads with the law, then supporting case law
    if (statSection)       sections.push(statSection);
    if (statDetailSection) sections.push(statDetailSection);
    if (judgeSection)      sections.push(judgeSection);
    if (detailSection)     sections.push(detailSection);
  } else {
    // Default: case law first
    if (judgeSection)      sections.push(judgeSection);
    if (statSection)       sections.push(statSection);
    if (detailSection)     sections.push(detailSection);
    if (statDetailSection) sections.push(statDetailSection);
  }

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

  if (hasStatutes) {
    parts.push("STATUTE RULE (ABSOLUTE — matches CASE LAW citation integrity): ONLY cite statute names AND section/article numbers that appear VERBATIM in the VERIFIED STATUTES section below. Copy each statute name and section number EXACTLY as shown. Do NOT cite any section number from memory or training data. Do NOT guess or infer section numbers. If a statute name appears in the verified list but the specific section you want to cite does NOT, write: 'refer to the relevant provision of [Statute Name]' instead of citing a specific section number. YOUR TRAINING DATA IS NOT A SOURCE FOR SECTION NUMBERS.");
  } else {
    parts.push("STATUTE RULE (ABSOLUTE — NO VERIFIED STATUTES FOUND): No statutes were found in the internal database for this query. CRITICAL: Do NOT cite ANY specific section numbers or article numbers. Do NOT cite section numbers from memory or training data — they are unreliable for Pakistani law. You may mention a statute by its general name only (e.g., 'The Pakistan Penal Code, 1860 addresses this area'). For ANY specific section reference, write: 'refer to the relevant provision of [Statute Name]' or 'consult the statute library for the applicable section'. Direct the user to search the statute library for exact provisions.");
  }
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
