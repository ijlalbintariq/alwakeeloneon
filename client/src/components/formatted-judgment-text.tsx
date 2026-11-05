import React, { useMemo } from "react";
import { Link } from "wouter";
import { buildJudgmentCitationMap, judgmentCitationHref, PAKISTANI_CITATION_REGEX, type JudgmentCitations } from "@shared/judgment-links";
export { buildJudgmentCitationMap, normalizeCitationToken, PAKISTANI_CITATION_REGEX, type CitationItem } from "@shared/judgment-links";

export interface FormattedJudgmentTextProps {
  text: string;
  citations?: JudgmentCitations;
  className?: string;
}

/**
 * Parses a paragraph of judgment text and converts recognized Pakistani citations
 * into clickable <Link href="..."> navigation components.
 */
export function renderTextWithCitationLinks(
  text: string,
  citationMap?: Map<string, string>
): React.ReactNode[] {
  if (!text) return [];

  const elements: React.ReactNode[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(PAKISTANI_CITATION_REGEX)) {
    const matchIndex = match.index ?? 0;
    const matchText = match[0];

    // Push preceding plain text
    if (matchIndex > lastIndex) {
      elements.push(text.slice(lastIndex, matchIndex));
    }

    const clean = matchText.trim().replace(/\s+/g, " ");
    const targetUrl = judgmentCitationHref(clean, citationMap);

    elements.push(
      <Link
        key={`cite-${matchIndex}-${clean}`}
        href={targetUrl}
        className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline underline-offset-2 decoration-blue-500/40 hover:decoration-blue-700 transition-colors inline cursor-pointer"
        title={`View Precedent: ${clean}`}
      >
        {matchText}
      </Link>
    );

    lastIndex = matchIndex + matchText.length;
  }

  // Push remaining text
  if (lastIndex < text.length) {
    elements.push(text.slice(lastIndex));
  }

  return elements.length > 0 ? elements : [text];
}

export function FormattedJudgmentText({ text, citations, className }: FormattedJudgmentTextProps) {
  const citationMap = useMemo(() => buildJudgmentCitationMap(citations), [citations]);

  const paragraphs = useMemo(() => {
    if (!text) return [];
    // 1. Normalize line endings
    let t = text.replace(/\r\n/g, "\n");

    // 2. Consolidate explicit multiple newlines into a standard marker
    t = t.replace(/\n\n+/g, "\n__PARAGRAPH__\n");

    const lines = t.split("\n");
    let result = "";

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line === "__PARAGRAPH__") {
        result += "\n\n";
        continue;
      }
      result += line;

      const nextLine = lines[i + 1] || "";
      // Detect explicit paragraph boundaries
      const isNextLineNewParagraph =
        /^\s*(\d+\.|[A-Z]\.|[ivx]+\.)\s/.test(nextLine) ||
        /^\s*(JUDGMENT|ORDER|BACKGROUND|FACTS|HELD|DECISION|COURT|CASE DETAILS)\b/.test(nextLine) ||
        nextLine === "__PARAGRAPH__";

      // Detect structured metadata headers (so we don't squash them)
      const isNextLineHeader = /^(Date of hearing|Appellant|Complainant|State|Respondent|Petitioner)/i.test(nextLine);
      const isCurrentLineHeader =
        /^(Date of hearing|Appellant|Complainant|State|Respondent|Petitioner|Criminal Appeal|Murder Reference|Civil Appeal|Writ Petition)/i.test(
          line.trim()
        );

      // 33 characters threshold:
      // Short header lines (Court names, Appeal numbers) are usually 20-30 chars and will be preserved.
      // Wrapped body text is usually 50-80 chars and will be joined.
      if (line.trim().length > 33 && !isNextLineNewParagraph && !isNextLineHeader && !isCurrentLineHeader) {
        result += " ";
      } else {
        result += "\n";
      }
    }

    // Split by our restored newlines to generate clean paragraphs
    return result.split("\n").map((p) => p.trim()).filter(Boolean);
  }, [text]);

  if (!text) {
    return <p className="text-muted-foreground">Text is not available.</p>;
  }

  return (
    <div
      className={
        className ||
        "text-foreground font-medium leading-[1.85] text-[14.5px] sm:text-[15.5px] text-left font-serif select-text px-6 md:px-12 py-4"
      }
      style={{
        fontFamily: "'Times New Roman', Times, Georgia, serif",
        letterSpacing: "0.015em",
      }}
    >
      {paragraphs.map((p, idx) => (
        <p key={idx} className="mb-4 last:mb-0 break-words">
          {renderTextWithCitationLinks(p, citationMap)}
        </p>
      ))}
    </div>
  );
}

export default FormattedJudgmentText;
