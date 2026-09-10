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
const EXCERPT_CHARS_JUDGMENT = 2000;
const EXCERPT_CHARS_EXTRACTED = 1000;

function buildVerifiedJudgmentsSection(caseLaw: RetrievedCaseLaw[]): ContextSection | null {
  const lines: string[] = [];

  for (const [rank, { row }] of caseLaw.entries()) {
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
    // Ordinal rank label — the LLM is instructed to prefer lower ranks (higher relevance)
    const rankLabel = rank === 0 ? "[1] HIGHEST RELEVANCE" : `[${rank + 1}] RELEVANCE RANK ${rank + 1}`;
    lines.push(`- ${rankLabel} | CITATION: ${citation} | COURT: ${courtName}${reportingInfo}${sourceTag}${summary}`);
  }

  if (lines.length === 0) return null;

  return {
    id: "verified-judgments",
    heading: "=== VERIFIED JUDGMENTS FROM INTERNAL DATABASE ===",
    lines: [
      "Use ONLY these citations. Copy each CITATION string EXACTLY. Format: **[CITATION STRING]** — explanation.",
      "STRICT RULE: Cite ONLY the formal citation string (e.g. **[2024 SCMR 142]**). DO NOT write party names, case titles, or 'vs' anywhere in your text.",
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
    return `- STATUTE: ${fullTitle} | SECTION: ${s.section} | VERBATIM TEXT: "${s.description}"${punishmentPart}${openRef}`;
  });
  return {
    id: "verified-statutes",
    heading: "=== VERIFIED STATUTES FROM INTERNAL DATABASE ===",
    lines: [
      "Cite these statute names and sections exactly as shown. Show the full statute name, not the abbreviation.",
      "When referencing a section, tell the user they can open the full statute document from the statute library.",
      "DOMAIN RELEVANCE OMISSION RULE: Check the legal domain of every statutory section listed below. Only discuss statutory sections that directly apply to the user's primary legal topic (e.g., criminal law, PPC, CrPC, bail, family law). You MUST IGNORE and COMPLETELY OMIT any statutory section whose legal domain does not match the user's primary case type (for example, omit civil, transport, or commercial regulatory acts like Tramways Act, Railways Act, Companies Act, etc., when answering criminal or family law queries).",
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
    lines.push(`- [${rowLabel}] ${citation} (${row.court})`);
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
  return `[SYSTEM NOTE: Focus your response on statutory analysis and practical legal guidance. Do NOT output a 'Leading Case Law' section or any negative disclaimer such as 'No relevant judgments found'.]`;
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
    // Statute queries: concise citations first (both statutes + case law),
    // then verbose detail sections. This ordering ensures case law citations
    // survive token-budget truncation — the detail sections are large and
    // were previously pushing case law off the end of the context window.
    if (statSection)       sections.push(statSection);
    if (judgeSection)      sections.push(judgeSection);
    if (statDetailSection) sections.push(statDetailSection);
    if (detailSection)     sections.push(detailSection);
  } else {
    // Judgment queries: judgments first
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
    parts.push(`CASE LAW RULE (MANDATORY): You must structure your response using the IRAC method. Use exactly these markdown headers:
### Issue
Identify the core legal issue.
### Rule
State the law and cite the highest-ranked judgments from the VERIFIED JUDGMENTS section below. For EVERY citation, you MUST include a direct 1-2 sentence quote from the provided judgment snippet to prove your point. If the snippet is too short or garbled to quote accurately, cite the case but note 'full text not available in context'. Do not pick cases lower in the list merely because they are more famous; the FIRST entries are computed as the most directly on point.${hasStatutes ? "\nSTATUTORY TEXT MANDATE: Under '### Rule', you MUST FIRST present the verbatim statutory text of the provision in a markdown blockquote (> ...) with the exact section and full statute title, BEFORE presenting any case law. Do not paraphrase or alter the statutory wording." : ""}
### Application
Apply the rule to the user's specific facts.
### Conclusion
Directly answer the user's question.

If the provided judgments do not contain a strong match for the user's issue, you must state: 'No strong precedent found in the verified database' and rely on statutory law. Never invent or recall citations from training data.

For EACH cited case, provide a FULL SHORT SUMMARY using this EXACT format:

**[CITATION STRING]** — *Court Name*
**Facts:** Brief facts of the case.
**Issue:** The legal question the court addressed.
**Held:** What the court decided and a direct quote establishing the principle.
**Relevance:** How this case applies to the user's specific question.`);
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

// ---------------------------------------------------------------------------
// Verbatim Quote Grounding — verify LLM quotes against retrieved sources
// ---------------------------------------------------------------------------

export interface QuoteVerificationResult {
  verifiedQuotes: string[];
  unverifiedQuotes: string[];
}

const STOP_WORDS = new Set([
  "a","an","the","and","or","but","if","then","else","when","at","by","for",
  "in","of","on","to","from","with","as","is","was","are","were","been",
  "be","have","has","had","do","does","did","it","its","this","that",
  "these","those","i","you","he","she","we","they","me","him","her",
  "us","them","my","your","his","our","their","no","not","so","very",
  "can","will","just","about","into","over","also","than","them","which",
  "what","who","how","all","each","every","both","few","more","most",
  "other","some","such","only","own","same","too","would","could","should",
  "may","might","shall","must","need","must","there","here","where","why",
]);

function meaningfulWords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

function wordOverlapRatio(quoteText: string, sourceText: string): number {
  const quoteWords = meaningfulWords(quoteText);
  const sourceWords = new Set(meaningfulWords(sourceText));

  if (quoteWords.length === 0) return 1; 

  const matched = quoteWords.filter((w) => sourceWords.has(w)).length;
  return matched / quoteWords.length;
}

function extractQuotes(text: string): string[] {
  const quotes: string[] = [];
  const lines = text.split("\n");
  let currentBlock: string[] = [];

  const flushBlock = () => {
    if (currentBlock.length > 0) {
      const joined = currentBlock.join(" ").trim();
      if (joined.length > 0) quotes.push(joined);
      currentBlock = [];
    }
  };

  for (const line of lines) {
    const m = line.match(/^>\s*(?:["\u201C\u201D])?(.*?)(?:["\u201C\u201D])?\s*$/);
    if (m) {
      const content = m[1].trim();
      if (content.length > 0) currentBlock.push(content);
    } else {
      flushBlock();
    }
  }
  flushBlock();

  const inlineRe = /["\u201C\u201D]([^"\n\u201C\u201D]{15,500})["\u201C\u201D]/g;
  let m: RegExpExecArray | null;
  while ((m = inlineRe.exec(text)) !== null) {
    quotes.push(m[1].trim());
  }

  return [...new Set(quotes)];
}

export function verifyQuotesAgainstSources(
  response: string,
  sources: { contextExcerpt?: string; fullText?: string }[]
): QuoteVerificationResult {
  const quotes = extractQuotes(response);
  const verifiedQuotes: string[] = [];
  const unverifiedQuotes: string[] = [];

  if (quotes.length === 0) {
    return { verifiedQuotes, unverifiedQuotes };
  }

  // Combine all sources into a single corpus string
  const sourceMaterial = sources.map(s => (s.contextExcerpt || "") + " " + (s.fullText || "")).join("\n");

  for (const rawQuote of quotes) {
    // Skip very short quotes
    if (rawQuote.split(/\s+/).filter(Boolean).length < 4) {
      continue; 
    }

    const similarity = wordOverlapRatio(rawQuote, sourceMaterial);
    
    if (similarity >= 0.8) {
      verifiedQuotes.push(rawQuote);
    } else {
      unverifiedQuotes.push(rawQuote);
    }
  }

  return { verifiedQuotes, unverifiedQuotes };
}
