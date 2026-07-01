import { useMemo } from "react";

export function FormattedJudgmentText({ text }: { text: string }) {
  if (!text) {
    return <p className="text-muted-foreground">Text is not available.</p>;
  }

  return (
    <div 
      className="whitespace-pre-wrap break-words text-foreground font-medium leading-[1.85] text-[14.5px] sm:text-[15.5px] text-left font-serif select-text px-6 md:px-12 py-4"
      style={{ 
        fontFamily: "'Times New Roman', Times, Georgia, serif",
        letterSpacing: "0.015em" 
      }}
    >
      {text}
    </div>
  );
}
