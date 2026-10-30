import React from "react";
import { getCitationTreatment, getPrecedentTarget } from "@/experimental/lib/judgmentApiClient";
import { AlertTriangle, ShieldAlert, ArrowUpRight, ExternalLink, HelpCircle, Scale } from "lucide-react";

export interface PrecedentCitationItem {
  id: number | string;
  citationType: "relied_upon" | "referred_to" | "distinguished" | "overruled" | string;
  contextExcerpt: string | null;
  citationText: string;
  linkedJudgmentId: string | null;
  linkedCitation: string | null;
  linkedTitle: string | null;
  court?: string;
  year?: number;
  decisionDate?: string;
  bench?: string;
}

interface OverruledAlertBannerProps {
  overrulingCases: PrecedentCitationItem[];
  distinguishedCases?: PrecedentCitationItem[];
  onSelectJudgment?: (judgmentId: string) => void;
}

export const OverruledAlertBanner: React.FC<OverruledAlertBannerProps> = ({
  overrulingCases,
  distinguishedCases = [],
  onSelectJudgment,
}) => {
  const isOverruled = overrulingCases.length > 0;
  const isDistinguished = !isOverruled && distinguishedCases.length > 0;

  if (!isOverruled && !isDistinguished) return null;

  return (
    <div
      role="alert"
      className={`rounded-2xl border p-4 sm:p-5 relative overflow-hidden backdrop-blur-sm shadow-md transition-all ${
        isOverruled
          ? "bg-rose-50/9 dark:bg-rose-500/100 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20 text-rose-900"
          : "bg-amber-50/9 dark:bg-amber-500/100 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 text-amber-900 dark:text-amber-300"
      }`}
    >
      {/* Background Accent Glow */}
      <div
        className={`absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 rounded-full blur-3xl opacity-20 pointer-events-none ${
          isOverruled ? "bg-rose-500" : "bg-amber-500"
        }`}
      />

      <div className="flex items-start gap-3.5 relative z-10">
        <div
          className={`p-2.5 rounded-xl border flex-shrink-0 ${
            isOverruled
              ? "bg-rose-100 border-rose-300 dark:border-rose-500/30 text-rose-700 dark:text-rose-400"
              : "bg-amber-100 border-amber-300 dark:border-amber-500/30 text-amber-700 dark:text-amber-400"
          }`}
        >
          {isOverruled ? (
            <ShieldAlert className="w-6 h-6 animate-pulse" />
          ) : (
            <AlertTriangle className="w-6 h-6" />
          )}
        </div>

        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span
                className={`text-xs uppercase font-mono font-bold tracking-wider px-2.5 py-0.5 rounded-full border ${
                  isOverruled
                    ? "bg-rose-200/80 border-rose-300 dark:border-rose-500/30 text-rose-900"
                    : "bg-amber-200/80 border-amber-300 dark:border-amber-500/30 text-amber-900 dark:text-amber-300"
                }`}
              >
                {isOverruled ? "NEGATIVE PRECEDENT TREATMENT" : "CAUTION: SUBSEQUENT PRECEDENT TREATMENT"}
              </span>
              <span className="text-[11px] font-mono text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] flex items-center gap-1">
                <Scale className="w-3 h-3" />
                Recorded Precedent Treatment
              </span>
            </div>
            <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] italic">
              Review the citing judgments and their recorded context.
            </span>
          </div>

          <p className="text-xs sm:text-sm text-[#334155] dark:text-[#CBD5E1] leading-relaxed font-sans">
            {isOverruled ? (
              <>
                The following judgments record negative treatment of this authority. Review each treatment and excerpt before relying on it.
              </>
            ) : (
              <>
                The following judgments distinguish or explain this authority. Review their recorded treatment and context.
              </>
            )}
          </p>

          {/* List of overruling / distinguishing judgments */}
          <div className="pt-2 space-y-2">
            {(isOverruled ? overrulingCases : distinguishedCases).map((item, idx) => (
              <div
                key={item.id || idx}
                className="p-3 rounded-xl bg-white dark:bg-[#131E2E]/95 border border-[#E2E8F0] dark:border-[#1E2D44] hover:border-[#CBD5E1] transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                      {item.linkedCitation || item.citationText}
                    </span>
                    <span
                      className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border ${
                        getCitationTreatment(item.citationType) === "overruled"
                          ? "bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20 text-rose-700 dark:text-rose-400 font-bold"
                          : "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 text-amber-800 dark:text-amber-400 font-bold"
                      }`}
                    >
                      {String(item.citationType || "referred_to").replace(/[_-]+/g, " ")}
                    </span>
                    {item.court && (
                      <span className="text-[10px] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] font-medium">
                        · {item.court}
                      </span>
                    )}
                  </div>
                  {item.linkedTitle && (
                    <p className="text-xs text-[#1E293B] font-semibold">{item.linkedTitle}</p>
                  )}
                  {item.contextExcerpt && (
                    <p className="text-[11px] text-[#475569] italic font-serif line-clamp-2">
                      &quot;{item.contextExcerpt}&quot;
                    </p>
                  )}
                </div>

                {getPrecedentTarget(item) && onSelectJudgment && (
                  <button
                    type="button"
                    onClick={() => onSelectJudgment(getPrecedentTarget(item))}
                    className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-[#F1F5F9] dark:bg-[#1E2D44] hover:bg-[#E2E8F0] text-[#0F172A] dark:text-[#F8FAFC] border border-[#CBD5E1] transition-all self-start sm:self-center flex-shrink-0 cursor-pointer"
                  >
                    <span>View Citing Case</span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-[#105B38]" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
