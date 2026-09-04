import React, { useState, useEffect, useMemo } from "react";
import {
  Search,
  CheckCircle2,
  Sparkles,
  SlidersHorizontal,
  Bookmark,
  Gavel,
  BookOpen,
  ArrowRight,
  HelpCircle,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface ParsedCitationTokens {
  year: number;
  journal: string;
  page: number;
  court?: string;
  isValid: boolean;
  raw: string;
}

interface PinpointCitationParserProps {
  onSearchCitation: (params: { year: number; journal?: string; page: number; court?: string }) => void;
  loading?: boolean;
}

const COMMON_CITATION_EXAMPLES = [
  { label: "2024 SCMR 1085", raw: "2024 SCMR 1085", desc: "Supreme Court of Pakistan" },
  { label: "2024 SCMR 457", raw: "2024 SCMR 457", desc: "Customs & Fiscal Jurisprudence (Supreme Court)" },
  { label: "2024 PLJ 379", raw: "2024 PLJ 379", desc: "Supreme Court of Pakistan" },
  { label: "2026 LHC 2169", raw: "2026 LHC 2169", desc: "Lahore High Court" },
  { label: "2026 CLD 569", raw: "2026 CLD 569", desc: "Banking & Corporate Law (Sindh High Court)" },
  { label: "2026 PLC 153", raw: "2026 PLC 153", desc: "Labor & Service Law (Sindh High Court)" },
  { label: "2026 PTD 770", raw: "2026 PTD 770", desc: "Taxation & Revenue (High Court of Sindh)" },
  { label: "2026 LHC 1868", raw: "2026 LHC 1868", desc: "Criminal Law (Lahore High Court)" },
  { label: "2026 LHC 3378", raw: "2026 LHC 3378", desc: "Administrative Law (Lahore High Court)" },
];

export function parsePakistaniCitation(input: string): ParsedCitationTokens | null {
  const raw = String(input || "").trim();
  if (!raw) return null;

  // Pre-cleaning: normalize spaced dot acronyms and standard Pakistani law journal/court abbreviations
  const preCleaned = raw
    .replace(/\bP\s*\.\s*Cr\s*\.\s*L\s*\.\s*J\.?(?=\s|$|[^a-zA-Z0-9])/gi, "PCRLJ")
    .replace(/\bP\s*\.\s*Cr\s*L\s*J\.?(?=\s|$|[^a-zA-Z0-9])/gi, "PCRLJ")
    .replace(/\bP\s*Cr\s*L\s*J(?=\s|$|[^a-zA-Z0-9])/gi, "PCRLJ")
    .replace(/\bP\s*\.\s*L\s*\.\s*D\.?(?=\s|$|[^a-zA-Z0-9])/gi, "PLD")
    .replace(/\bS\s*\.\s*C\s*\.\s*M\s*\.\s*R\.?(?=\s|$|[^a-zA-Z0-9])/gi, "SCMR")
    .replace(/\bC\s*\.\s*L\s*\.\s*C\.?(?=\s|$|[^a-zA-Z0-9])/gi, "CLC")
    .replace(/\bY\s*\.\s*L\s*\.\s*R\.?(?=\s|$|[^a-zA-Z0-9])/gi, "YLR")
    .replace(/\bC\s*\.\s*L\s*\.\s*D\.?(?=\s|$|[^a-zA-Z0-9])/gi, "CLD")
    .replace(/\bP\s*\.\s*T\s*\.\s*D\.?(?=\s|$|[^a-zA-Z0-9])/gi, "PTD")
    .replace(/\bP\s*\.\s*L\s*\.\s*C\.?(?=\s|$|[^a-zA-Z0-9])/gi, "PLC")
    .replace(/\bM\s*\.\s*L\s*\.\s*D\.?(?=\s|$|[^a-zA-Z0-9])/gi, "MLD")
    .replace(/\bL\s*\.\s*H\s*\.\s*C\.?(?=\s|$|[^a-zA-Z0-9])/gi, "LHC")
    .replace(/\bS\s*\.\s*H\s*\.\s*C\.?(?=\s|$|[^a-zA-Z0-9])/gi, "SHC")
    .replace(/\bI\s*\.\s*H\s*\.\s*C\.?(?=\s|$|[^a-zA-Z0-9])/gi, "IHC")
    .replace(/\bP\s*\.\s*H\s*\.\s*C\.?(?=\s|$|[^a-zA-Z0-9])/gi, "PHC")
    .replace(/\bB\s*\.\s*H\s*\.\s*C\.?(?=\s|$|[^a-zA-Z0-9])/gi, "BHC")
    .replace(/\bF\s*\.\s*S\s*\.\s*C\.?(?=\s|$|[^a-zA-Z0-9])/gi, "FSC")
    .replace(/\bS\s*\.\s*C\.?(?=\s|$|[^a-zA-Z0-9])/gi, "SC")
    .replace(/\bF\s*\.\s*C\.?(?=\s|$|[^a-zA-Z0-9])/gi, "FC");

  const normalized = preCleaned
    .replace(/[()[\]{}<>,;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const normalizeJournal = (j: string): string => {
    const clean = String(j || "")
      .replace(/\bP\.?\s*Cr\.?\s*L\.?\s*J\b/gi, "PCRLJ")
      .replace(/[^A-Za-z0-9]/g, "")
      .toUpperCase();
    return clean;
  };

  // 1. Journal first: PLD 2023 SC 451, PLD 1955 FC 240, or PLD 2020 Lahore 120
  const journalFirst = normalized.match(
    /\b([A-Za-z][A-Za-z0-9.]{0,12})\s+((?:19|20)\d{2})\s+(?:(SC|Supreme\s*Court|FC|Federal\s*Court|Lahore|LHC|Karachi|SHC|Peshawar|PHC|Quetta|BHC|Islamabad|IHC|FSC)\s+)?(\d{1,6})\b/i
  );
  if (journalFirst) {
    const journal = normalizeJournal(journalFirst[1]);
    const year = Number(journalFirst[2]);
    const court = journalFirst[3] ? journalFirst[3].trim() : undefined;
    const page = Number(journalFirst[4]);
    if (year >= 1947 && page >= 1) {
      return { year, journal, page, court, isValid: true, raw };
    }
  }

  // 2. Compact Neutral: 2025 LHC 639, 2024 IHC 120, 2023 SHC 45
  const compactNeutral = normalized.match(
    /\b((?:19|20)\d{2})\s*(LHC|IHC|SHC|PHC|BHC|AJKHC|SC|FSC|FC)\s*(\d{1,6})\b/i
  );
  if (compactNeutral) {
    const year = Number(compactNeutral[1]);
    const journal = normalizeJournal(compactNeutral[2]);
    const page = Number(compactNeutral[3]);
    if (year >= 1947 && page >= 1) {
      return { year, journal, page, court: journal, isValid: true, raw };
    }
  }

  // 3. Year first: 2024 SCMR 892, 2023 CLC 1204, 2021 YLR 880, 2022 CLD 780
  const yearFirst = normalized.match(
    /\b((?:19|20)\d{2})\s+([A-Za-z][A-Za-z0-9.]{0,12}(?:\s+[A-Za-z][A-Za-z0-9.]{0,12}){0,3})\s+(\d{1,6})\b/i
  );
  if (yearFirst) {
    const year = Number(yearFirst[1]);
    const journal = normalizeJournal(yearFirst[2]);
    const page = Number(yearFirst[3]);
    if (year >= 1947 && page >= 1) {
      return { year, journal, page, isValid: true, raw };
    }
  }

  return null;
}

export const PinpointCitationParser: React.FC<PinpointCitationParserProps> = ({
  onSearchCitation,
  loading = false,
}) => {
  const [citationText, setCitationText] = useState<string>("");
  const [manualYear, setManualYear] = useState<number>(2024);
  const [manualJournal, setManualJournal] = useState<string>("SCMR");
  const [manualPage, setManualPage] = useState<string>("892");
  const [manualCourt, setManualCourt] = useState<string>("");
  const [mode, setMode] = useState<"smart" | "manual">("smart");
  const [journals, setJournals] = useState<Array<{ id: number; code: string; name: string }>>([]);
  const [loadingJournals, setLoadingJournals] = useState<boolean>(true);

  useEffect(() => {
    async function loadJournals() {
      setLoadingJournals(true);
      try {
        const res = await fetch("/api/journals", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setJournals(data);
        }
      } catch (err) {
        console.error("Failed to load journals", err);
      } finally {
        setLoadingJournals(false);
      }
    }
    loadJournals();
  }, []);
  const parsedTokens = useMemo(() => {
    return parsePakistaniCitation(citationText);
  }, [citationText]);

  const handleExecuteSmartSearch = () => {
    if (parsedTokens?.isValid) {
      onSearchCitation({
        year: parsedTokens.year,
        journal: parsedTokens.journal,
        page: parsedTokens.page,
        court: parsedTokens.court,
      });
    }
  };

  const handleExecuteManualSearch = () => {
    const pageNum = Number(manualPage);
    if (!manualYear || isNaN(pageNum) || pageNum < 1) return;
    onSearchCitation({
      year: manualYear,
      journal: manualJournal === "ALL" ? undefined : manualJournal,
      page: pageNum,
      court: manualCourt || undefined,
    });
  };

  return (
    <div className="rounded-2xl border border-[#E2E8F0] dark:border-[#1E2D44] bg-white dark:bg-[#131E2E] p-5 sm:p-6 shadow-xs space-y-4">
      {/* Header & Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E2E8F0] dark:border-[#1E2D44] pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-[#105B38] shadow-xs">
            <Search className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-2">
              <span>Pinpoint Citation Lookup</span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-[#105B38] border border-emerald-200 dark:border-emerald-500/20">
                Regex Engine
              </span>
            </h3>
            <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">
              Direct volume & page resolver across reported Pakistani Law Journals (PLD, SCMR, CLC, PCrLJ, YLR, MLD, CLD, PTD, PLC, LHC)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-[#F8FAFC] dark:bg-[#0B131E] p-1 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D44] text-xs">
          <button
            type="button"
            onClick={() => setMode("smart")}
            className={cn(
              "px-3 py-1.5 rounded-lg transition-all text-xs font-semibold",
              mode === "smart"
                ? "bg-white dark:bg-[#131E2E] text-[#105B38] font-bold shadow-xs"
                : "text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC]"
            )}
          >
            Smart Parser
          </button>
          <button
            type="button"
            onClick={() => setMode("manual")}
            className={cn(
              "px-3 py-1.5 rounded-lg transition-all text-xs font-semibold",
              mode === "manual"
                ? "bg-white dark:bg-[#131E2E] text-[#105B38] font-bold shadow-xs"
                : "text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC]"
            )}
          >
            Field Matrix
          </button>
        </div>
      </div>

      {mode === "smart" ? (
        <div className="space-y-4">
          {/* Smart Input Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="flex-1 flex items-center px-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] focus-within:border-[#105B38] focus-within:bg-white dark:bg-[#131E2E] shadow-xs transition-all">
              <BookOpen className="w-4 h-4 text-[#94A3B8] dark:text-[#475569] mr-2.5 flex-shrink-0" />
              <input
                type="text"
                value={citationText}
                onChange={(e) => setCitationText(e.target.value)}
                placeholder="Type citation (e.g. 2024 SCMR 1085, 2026 LHC 2169, 2026 CLD 569, 2024 PLJ 379)..."
                className="w-full h-11 bg-transparent text-xs sm:text-sm text-[#0F172A] dark:text-[#F8FAFC] placeholder:text-[#94A3B8] dark:text-[#475569] focus:outline-none font-mono font-medium"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && parsedTokens?.isValid) {
                    handleExecuteSmartSearch();
                  }
                }}
              />
              {citationText && (
                <button
                  type="button"
                  onClick={() => setCitationText("")}
                  className="p-1 text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC]"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={handleExecuteSmartSearch}
              disabled={loading || !parsedTokens?.isValid}
              className="px-6 py-3 rounded-xl bg-[#105B38] hover:bg-[#0D4A2E] text-white font-bold text-xs transition-all shadow-xs disabled:opacity-40 flex items-center justify-center gap-2 shrink-0"
            >
              <span>Locate Judgment</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Live Regex Token Feedback Chips */}
          {citationText && (
            <div className="p-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] flex flex-wrap items-center justify-between gap-2 text-xs">
              {parsedTokens?.isValid ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex items-center gap-1 text-[11px] font-mono text-[#105B38] bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-2.5 py-0.5 rounded-md font-bold">
                    <CheckCircle2 className="w-3 h-3" /> Valid Citation Syntax
                  </span>
                  <span className="font-mono text-[#0F172A] dark:text-[#F8FAFC] bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] px-2.5 py-0.5 rounded-md shadow-xs">
                    Year: <strong>{parsedTokens.year}</strong>
                  </span>
                  <span className="font-mono text-[#0F172A] dark:text-[#F8FAFC] bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] px-2.5 py-0.5 rounded-md shadow-xs">
                    Journal: <strong>{parsedTokens.journal}</strong>
                  </span>
                  <span className="font-mono text-[#0F172A] dark:text-[#F8FAFC] bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] px-2.5 py-0.5 rounded-md shadow-xs">
                    Page: <strong>{parsedTokens.page}</strong>
                  </span>
                  {parsedTokens.court && (
                    <span className="font-mono text-[#0F172A] dark:text-[#F8FAFC] bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] px-2.5 py-0.5 rounded-md shadow-xs">
                      Court: <strong>{parsedTokens.court}</strong>
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-[11px] font-mono text-[#94A3B8] dark:text-[#475569]">
                  Awaiting complete citation pattern (e.g. &quot;2024 SCMR 1085&quot; or &quot;2026 LHC 2169&quot;)...
                </span>
              )}
            </div>
          )}

          {/* Common Landmark Citation Shortcuts */}
          <div className="space-y-2 pt-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] font-bold block">
              Quick Pinpoint Benchmark Chips:
            </span>
            <div className="flex flex-wrap gap-2">
              {COMMON_CITATION_EXAMPLES.map((ex) => (
                <button
                  type="button"
                  key={ex.label}
                  onClick={() => {
                    setCitationText(ex.raw);
                    const tokens = parsePakistaniCitation(ex.raw);
                    if (tokens) {
                      onSearchCitation({
                        year: tokens.year,
                        journal: tokens.journal,
                        page: tokens.page,
                        court: tokens.court,
                      });
                    }
                  }}
                  className="px-3 py-1.5 rounded-xl bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] hover:border-[#105B38] hover:bg-emerald-50/5 dark:bg-emerald-500/100 dark:bg-emerald-500/10 text-[#334155] dark:text-[#CBD5E1] hover:text-[#105B38] text-[11px] font-mono font-medium transition-all shadow-xs"
                  title={ex.desc}
                >
                  {ex.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Manual Structured Fields Matrix */
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="text-[10px] font-mono font-bold text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] block mb-1">Journal Reporter</label>
              <select
                value={manualJournal}
                onChange={(e) => setManualJournal(e.target.value)}
                disabled={loadingJournals}
                className="w-full h-10 px-3 rounded-xl bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:border-[#105B38] focus:bg-white dark:bg-[#131E2E] font-mono text-xs font-medium disabled:opacity-50"
              >
                {journals.length > 0 ? <option value="ALL">All Journals</option> : <option value="ALL">Loading...</option>}
                {journals.map((j) => (
                  <option key={j.id} value={j.code}>
                    {j.code} ({j.name})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-mono font-bold text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] block mb-1">Year (1947–2026)</label>
              <input
                type="number"
                min={1947}
                max={2026}
                value={manualYear}
                onChange={(e) => setManualYear(Number(e.target.value))}
                className="w-full h-10 px-3 rounded-xl bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:border-[#105B38] focus:bg-white dark:bg-[#131E2E] font-mono text-xs font-medium"
              />
            </div>

            <div>
              <label className="text-[10px] font-mono font-bold text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] block mb-1">Page Number</label>
              <input
                type="number"
                min={1}
                value={manualPage}
                onChange={(e) => setManualPage(e.target.value)}
                placeholder="e.g. 451"
                className="w-full h-10 px-3 rounded-xl bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:border-[#105B38] focus:bg-white dark:bg-[#131E2E] font-mono text-xs font-medium"
              />
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={handleExecuteManualSearch}
                disabled={loading}
                className="w-full h-10 rounded-xl bg-[#105B38] hover:bg-[#0D4A2E] text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 shadow-xs"
              >
                <span>Search Citation</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
