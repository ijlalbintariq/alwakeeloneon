import React, { useState, useEffect } from "react";
import {
  Sparkles,
  CheckCircle2,
  Bookmark,
  FileCheck,
  Scale,
  Loader2,
  RefreshCw,
  Lightbulb,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";

export interface JudgmentSummaryData {
  result: string;
  legalPrinciples: string[];
  keyFindings: string[];
  significance: string;
}

interface RatioDecidendiCardProps {
  judgmentId: string;
  headnotes?: string | null;
  ratioDecidendi?: JudgmentSummaryData | null;
}

export const RatioDecidendiCard: React.FC<RatioDecidendiCardProps> = ({
  judgmentId,
  headnotes,
  ratioDecidendi,
}) => {
  const [summary, setSummary] = useState<JudgmentSummaryData | null>(ratioDecidendi || null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = async () => {
    if (!judgmentId) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/judgments/${encodeURIComponent(judgmentId)}/summary`, {
        credentials: "include",
      });
      if (!res.ok) {
        const errPayload = await res.json().catch(() => ({}));
        throw new Error(errPayload.message || `Server returned ${res.status}`);
      }
      const data = (await res.json()) as JudgmentSummaryData;
      setSummary(data);
    } catch (err: any) {
      console.warn("Ratio decidendi fetch failed:", err);
      setError(err?.message || "Failed to load Ratio Decidendi summary.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ratioDecidendi) {
      setSummary(ratioDecidendi);
    } else {
      fetchSummary();
    }
  }, [judgmentId, ratioDecidendi]);

  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 sm:p-6 shadow-xs relative overflow-hidden space-y-4">
      {/* Subtle Background Accent */}
      <div className="absolute top-0 right-0 -mr-12 -mt-12 w-36 h-36 bg-emerald-50 rounded-full blur-2xl pointer-events-none" />

      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-[#105B38] shadow-xs">
            <Scale className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
              <span>Ratio Decidendi & Legal Principles</span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-[#105B38] border border-emerald-200">
                AI Synthesis
              </span>
            </h3>
            <p className="text-[11px] text-[#64748B]">
              Core judicial ruling, statutory interpretations & binding jurisprudence
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchSummary}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#475569] hover:text-[#0F172A] text-xs font-semibold border border-[#E2E8F0] transition-colors disabled:opacity-50"
          title="Refresh Ratio Decidendi extraction"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[#105B38]" : ""}`} />
          <span className="text-xs">Re-extract</span>
        </button>
      </div>

      {loading && !summary ? (
        <div className="py-8 flex flex-col items-center justify-center gap-2 text-[#64748B] font-mono text-xs">
          <Loader2 className="w-5 h-5 text-[#105B38] animate-spin" />
          <span>Synthesizing Ratio Decidendi & Key Holdings...</span>
        </div>
      ) : error && !summary ? (
        <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#64748B] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[#0F172A]">
            <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchSummary}
            className="px-3 py-1 rounded-lg bg-[#105B38] text-white text-xs font-bold hover:bg-[#0D4A2E] transition-colors"
          >
            Retry
          </button>
        </div>
      ) : summary ? (
        <div className="space-y-4 text-xs sm:text-sm">
          {/* Outcome / Result */}
          {summary.result && (
            <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200/80 space-y-1.5">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#105B38] font-bold flex items-center gap-1.5">
                <Lightbulb className="w-3.5 h-3.5" />
                Judicial Outcome & Relief Granted
              </span>
              <p className="text-[#0F172A] leading-relaxed font-sans text-xs sm:text-sm font-medium">
                {summary.result}
              </p>
            </div>
          )}

          {/* Legal Principles */}
          {summary.legalPrinciples && summary.legalPrinciples.length > 0 && (
            <div className="space-y-2">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#475569] font-bold flex items-center gap-1.5">
                <FileCheck className="w-3.5 h-3.5 text-[#105B38]" />
                Key Legal Principles (Ratio Decidendi)
              </span>
              <div className="grid grid-cols-1 gap-2">
                {summary.legalPrinciples.map((principle, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] hover:border-[#CBD5E1] transition-all flex items-start gap-2.5 text-xs text-[#1E293B] leading-relaxed"
                  >
                    <CheckCircle2 className="w-4 h-4 text-[#105B38] flex-shrink-0 mt-0.5" />
                    <span className="flex-1 font-sans">{principle}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Key Findings */}
          {summary.keyFindings && summary.keyFindings.length > 0 && (
            <div className="space-y-2">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#475569] font-bold flex items-center gap-1.5">
                <Bookmark className="w-3.5 h-3.5 text-[#64748B]" />
                Bench Findings & Statutory Interpretation
              </span>
              <ul className="space-y-1.5 list-none pl-0">
                {summary.keyFindings.map((finding, idx) => (
                  <li
                    key={idx}
                    className="text-xs text-[#475569] leading-relaxed flex items-start gap-2 pl-1"
                  >
                    <span className="text-[#105B38] font-bold">•</span>
                    <span className="font-sans">{finding}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Significance */}
          {summary.significance && (
            <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#475569] leading-relaxed font-sans">
              <strong className="text-[#0F172A] font-bold block mb-1 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#105B38]" />
                Constitutional & Jurisprudential Significance:
              </strong>
              {summary.significance}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};
