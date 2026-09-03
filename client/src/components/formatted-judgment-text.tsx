import { useMemo } from "react";

export function FormattedJudgmentText({ text }: { text: string }) {
  if (!text) {
    return <p className="text-muted-foreground">Text is not available.</p>;
  }

  const paragraphs = useMemo(() => {
    // 1. Normalize line endings
    let t = text.replace(/\r\n/g, '\n');
    
    // 2. Consolidate explicit multiple newlines into a standard marker
    t = t.replace(/\n\n+/g, '\n__PARAGRAPH__\n');
    
    const lines = t.split('\n');
    let result = "";

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line === '__PARAGRAPH__') {
        result += "\n\n";
        continue;
      }
      result += line;
      
      const nextLine = lines[i+1] || "";
      // Detect explicit paragraph boundaries
      const isNextLineNewParagraph = /^\s*(\d+\.|[A-Z]\.|[ivx]+\.)\s/.test(nextLine) || /^\s*(JUDGMENT|ORDER|BACKGROUND|FACTS|HELD|DECISION|COURT|CASE DETAILS)\b/.test(nextLine) || nextLine === '__PARAGRAPH__';
      
      // Detect structured metadata headers (so we don't squash them)
      const isNextLineHeader = /^(Date of hearing|Appellant|Complainant|State|Respondent|Petitioner)/i.test(nextLine);
      const isCurrentLineHeader = /^(Date of hearing|Appellant|Complainant|State|Respondent|Petitioner|Criminal Appeal|Murder Reference|Civil Appeal|Writ Petition)/i.test(line.trim());

      // 33 characters threshold:
      // Short header lines (Court names, Appeal numbers) are usually 20-30 chars and will be preserved.
      // Wrapped body text is usually 50-80 chars and will be joined.
      if (line.trim().length > 33 && !isNextLineNewParagraph && !isNextLineHeader && !isCurrentLineHeader) {
        result += " ";
      } else {
        result += "\n";
      }
    }
    
    // Split by our restored newlines to generate perfect HTML <p> tags
    return result.split('\n').map(p => p.trim()).filter(Boolean);
  }, [text]);

  return (
    <div 
      className="text-foreground font-medium leading-[1.85] text-[14.5px] sm:text-[15.5px] text-left font-serif select-text px-6 md:px-12 py-4"
      style={{ 
        fontFamily: "'Times New Roman', Times, Georgia, serif",
        letterSpacing: "0.015em" 
      }}
    >
      {paragraphs.map((p, idx) => (
        <p key={idx} className="mb-4 last:mb-0 break-words">
          {p}
        </p>
      ))}
    </div>
  );
}
