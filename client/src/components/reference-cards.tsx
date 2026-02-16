import { BookOpen, Gavel, ChevronRight } from "lucide-react";
import { useLocation } from "wouter";

interface LawReference {
  name: string;
  section: string;
  description: string;
}

interface JudgmentReference {
  citation: string;
  court: string;
  description: string;
}

interface ParsedReferences {
  laws: LawReference[];
  judgments: JudgmentReference[];
}

export function parseReferences(content: string): { cleanContent: string; references: ParsedReferences | null } {
  const refPattern = /```references\s*\n?([\s\S]*?)\n?```/g;
  let lastMatch: RegExpExecArray | null = null;
  let match: RegExpExecArray | null;
  while ((match = refPattern.exec(content)) !== null) {
    lastMatch = match;
  }
  if (!lastMatch) {
    return { cleanContent: content, references: null };
  }
  const cleanContent = content.slice(0, lastMatch.index).trimEnd() +
    content.slice(lastMatch.index + lastMatch[0].length).trimEnd();
  try {
    const jsonStr = lastMatch[1].trim();
    const parsed = JSON.parse(jsonStr);
    const refs: ParsedReferences = {
      laws: Array.isArray(parsed.laws) ? parsed.laws.filter((l: any) => l.name) : [],
      judgments: Array.isArray(parsed.judgments) ? parsed.judgments.filter((j: any) => j.citation) : [],
    };
    if (refs.laws.length === 0 && refs.judgments.length === 0) return { cleanContent, references: null };
    return { cleanContent, references: refs };
  } catch {
    return { cleanContent, references: null };
  }
}

export function ReferenceCards({ references }: { references: ParsedReferences }) {
  const [, navigate] = useLocation();

  return (
    <div className="mt-4 pt-4 border-t border-slate-700/50 space-y-3" data-testid="reference-cards-container">
      {references.laws.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <BookOpen size={13} className="text-amber-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-500/80" data-testid="text-relevant-laws-label">Relevant Laws</span>
            <ChevronRight size={12} className="text-slate-600" />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {references.laws.map((law, i) => (
              <button
                key={i}
                onClick={() => navigate(`/statute-search?q=${encodeURIComponent(law.name)}`)}
                className="flex-shrink-0 bg-slate-800/80 border border-slate-700/50 rounded-xl p-3 text-left max-w-[260px] transition-all hover-elevate active-elevate-2 overflow-visible"
                data-testid={`card-law-${i}`}
              >
                <p className="text-xs font-bold text-white truncate" data-testid={`text-law-name-${i}`}>
                  {law.name}
                </p>
                {law.section && (
                  <p className="text-[10px] text-amber-500/70 font-semibold mt-0.5" data-testid={`text-law-section-${i}`}>{law.section}</p>
                )}
                <p className="text-[10px] text-slate-400 mt-1 line-clamp-2 leading-relaxed" data-testid={`text-law-description-${i}`}>
                  {law.description}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {references.judgments.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Gavel size={13} className="text-amber-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-500/80" data-testid="text-relevant-judgments-label">Relevant Judgments</span>
            <ChevronRight size={12} className="text-slate-600" />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {references.judgments.map((judgment, i) => (
              <button
                key={i}
                onClick={() => navigate(`/judgment-search?q=${encodeURIComponent(judgment.citation)}`)}
                className="flex-shrink-0 bg-slate-800/80 border border-slate-700/50 rounded-xl p-3 text-left max-w-[260px] transition-all hover-elevate active-elevate-2 overflow-visible"
                data-testid={`card-judgment-${i}`}
              >
                <p className="text-xs font-bold text-white truncate" data-testid={`text-judgment-citation-${i}`}>
                  {judgment.citation}
                </p>
                <p className="text-[10px] text-amber-500/70 font-semibold mt-0.5" data-testid={`text-judgment-court-${i}`}>{judgment.court}</p>
                <p className="text-[10px] text-slate-400 mt-1 line-clamp-2 leading-relaxed" data-testid={`text-judgment-description-${i}`}>
                  {judgment.description}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
