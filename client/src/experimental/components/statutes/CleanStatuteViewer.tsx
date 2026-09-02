/**
 * ============================================================================
 * CLEAN STATUTE VIEWER COMPONENT
 * Strictly isolated in client/src/experimental/
 * ============================================================================
 * Visual statutory workstation presenting pure, official legislative text
 * segmented into distinct visual cards:
 * 1. Verbatim Enactment Card (High-legibility typography, sub-sections, provisos)
 * 2. Statutory Punishment Card (Rose/crimson with Gavel icon)
 * 3. Illustrations Card (Amber/gold with BookOpen icon and illustration chips)
 * 4. Judicial Guidance & Case Law Notes Card (Blue/slate with Scale icon)
 * 5. Legislative History Accordion (Collapsible amendment history)
 * 6. Landmark Authority Precedents (Authoritative Supreme Court & High Court rulings)
 * ============================================================================
 */

import React, { useState } from "react";
import {
  BookOpen,
  Scale,
  Gavel,
  FileText,
  Copy,
  Check,
  FileEdit,
  History,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ShieldAlert,
  Info,
  Database,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  sanitizeStatuteText,
  type SanitizedStatutorySection,
} from "../../lib/statuteSanitizer";
import {
  useSectionPrecedents,
  type UseSectionPrecedentsOptions,
} from "../../hooks/useSectionPrecedents";
import { LandmarkAuthorityCard } from "./LandmarkAuthorityCard";
import type { LandmarkPrecedent } from "../../lib/precedentCache";

export interface CleanStatuteViewerProps {
  statuteName: string;
  sectionNumber: string;
  rawTitle?: string;
  rawDescription: string;
  rawPunishment?: string | null;
  category?: string;
  isLiveDb?: boolean;
  onExploreJudgment?: (citation: string, judgmentId?: string) => void;
  onInsertDrafting?: (payload: any) => void;
  className?: string;
}

export const CleanStatuteViewer: React.FC<CleanStatuteViewerProps> = ({
  statuteName,
  sectionNumber,
  rawTitle = "",
  rawDescription,
  rawPunishment = null,
  category = "civil",
  isLiveDb = false,
  onExploreJudgment,
  onInsertDrafting,
  className,
}) => {
  const { toast } = useToast();
  const [copiedCitation, setCopiedCitation] = useState(false);
  const [copiedClause, setCopiedClause] = useState(false);
  const [isInsertingDrafting, setIsInsertingDrafting] = useState(false);
  const [showLegislativeHistory, setShowLegislativeHistory] = useState(false);

  // Run pure text sanitization & AST segmentation pipeline
  const sanitized: SanitizedStatutorySection = sanitizeStatuteText(
    rawDescription,
    statuteName,
    sectionNumber,
    rawTitle
  );

  const displayPunishment = rawPunishment || sanitized.punishment;

  // Resolve landmark precedents seamlessly with zero-401 fallback
  const {
    precedents,
    isLoading: isLoadingPrecedents,
    source: precedentSource,
  } = useSectionPrecedents(statuteName, sectionNumber, {
    title: rawTitle,
    category,
    autoFetch: true,
  });

  // Action: Copy Section & Citation
  const handleCopyCitation = () => {
    const formattedCitation = `${sanitized.cleanSection}, ${statuteName}`;
    navigator.clipboard.writeText(formattedCitation);
    setCopiedCitation(true);
    toast({
      title: "Citation Copied",
      description: `${formattedCitation} copied to clipboard.`,
    });
    setTimeout(() => setCopiedCitation(false), 2000);
  };

  // Action: Copy Clause (Pure operative text without gazette clutter)
  const handleCopyClause = () => {
    const cleanClauseText = sanitized.cleanText.replace(/\n+/g, " ").trim();
    const clauseGround = `STATUTORY PROVISION & RELEVANT LAW:\n${sanitized.cleanSection} of ${statuteName} (${sanitized.cleanTitle})\n\n"${cleanClauseText}"\n\nLEGAL GROUNDS & APPLICABLE PRINCIPLES:\nThat under ${sanitized.cleanSection} of the ${statuteName}, the statutory requirements are fully satisfied on behalf of the petitioner/plaintiff.`;

    navigator.clipboard.writeText(clauseGround);
    setCopiedClause(true);
    toast({
      title: "Statutory Clause Copied",
      description: "Clean statutory grounds copied to clipboard.",
    });
    setTimeout(() => setCopiedClause(false), 2000);
  };

  // Action: Insert into Legal Drafting Studio
  const handleInsertIntoDrafting = () => {
    setIsInsertingDrafting(true);
    const cleanClauseText = sanitized.cleanText.replace(/\n+/g, " ").trim();
    const clauseGround = `STATUTORY PROVISION & RELEVANT LAW:\n${sanitized.cleanSection} of ${statuteName} (${sanitized.cleanTitle})\n\n"${cleanClauseText}"\n\nLEGAL GROUNDS & APPLICABLE PRINCIPLES:\nThat under the provisions of ${sanitized.cleanSection} of ${statuteName}, the petitioner is entitled to the relief claimed in accordance with established law.`;

    const payload = {
      statute: statuteName,
      section: sanitized.cleanSection,
      title: sanitized.cleanTitle,
      clause: clauseGround,
      formattedCitation: `${sanitized.cleanSection}, ${statuteName}`,
      timestamp: Date.now(),
    };

    try {
      localStorage.setItem("alwakeelo_drafting_insert", JSON.stringify(payload));
      window.dispatchEvent(
        new CustomEvent("alwakeelo-drafting-insert", { detail: payload })
      );

      if (onInsertDrafting) {
        onInsertDrafting(payload);
      }

      toast({
        title: "Inserted into Drafting Studio",
        description: `${sanitized.cleanSection} transferred to Legal Drafting Studio canvas.`,
      });
    } catch (err) {
      console.error("Failed to transfer clause to drafting", err);
    } finally {
      setTimeout(() => setIsInsertingDrafting(false), 1500);
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* 1. Main Verbatim Statutory Enactment Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs">
        {/* Top Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            {/* Section Pill */}
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#105B38]/10 px-3 py-1 text-xs font-bold text-[#105B38] border border-[#105B38]/20 font-mono">
              <FileText className="h-3.5 w-3.5" />
              {sanitized.cleanSection}
            </span>

            {/* Statute Short Title */}
            <span className="text-xs font-semibold text-slate-700">
              {statuteName}
            </span>

            {/* Category / Domain Badge */}
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-600 uppercase tracking-wide">
              {category}
            </span>

            {/* Live DB Indicator */}
            {isLiveDb && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 border border-blue-200">
                <Database className="h-2.5 w-2.5" />
                Live DB
              </span>
            )}
          </div>

          {/* Action Hub Quick Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopyCitation}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition-all whitespace-nowrap",
                copiedCitation
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              )}
              title="Copy Citation"
            >
              {copiedCitation ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              <span>{copiedCitation ? "Copied!" : "Copy Citation"}</span>
            </button>

            <button
              type="button"
              onClick={handleCopyClause}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition-all whitespace-nowrap",
                copiedClause
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              )}
              title="Copy pure statutory clause for pleadings"
            >
              {copiedClause ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              <span>{copiedClause ? "Clause Copied!" : "Copy Clause"}</span>
            </button>

            <button
              type="button"
              onClick={handleInsertIntoDrafting}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold transition-all shadow-xs whitespace-nowrap",
                isInsertingDrafting
                  ? "bg-emerald-700 text-white"
                  : "bg-[#105B38] text-white hover:bg-[#0D4A2E]"
              )}
              title="Insert pure statutory clause into Legal Drafting Studio"
            >
              <FileEdit className="h-4 w-4" />
              <span>{isInsertingDrafting ? "Inserted!" : "Insert into Drafting"}</span>
            </button>
          </div>
        </div>

        {/* Section Title */}
        <h3 className="mt-4 text-lg font-bold text-slate-900 tracking-tight">
          {sanitized.cleanTitle || rawTitle || sanitized.cleanSection}
        </h3>

        {/* Pure Verbatim Statutory Law Body */}
        <div className="mt-3.5 text-sm leading-relaxed text-slate-800 font-serif whitespace-pre-line tracking-normal">
          {sanitized.cleanText || "No statutory text recorded."}
        </div>
      </div>

      {/* 2. Statutory Punishment & Penalty Card (Conditional) */}
      {displayPunishment && (
        <div className="rounded-xl border border-rose-200 bg-gradient-to-r from-rose-50 via-rose-50/70 to-white p-4.5 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-rose-100 p-2 text-rose-700 shrink-0">
              <Gavel className="h-4 w-4" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-rose-900">
                  Statutory Punishment & Penalty
                </span>
                <span className="rounded-full bg-rose-200/80 px-2 py-0.2 text-[10px] font-semibold text-rose-800">
                  Penal Consequence
                </span>
              </div>
              <p className="text-xs font-medium text-rose-950 leading-relaxed font-serif">
                {displayPunishment}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 3. Statutory Illustrations Card (Conditional) */}
      {sanitized.illustrations.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4.5 shadow-xs">
          <div className="flex items-center gap-2 border-b border-amber-200/60 pb-2.5 mb-3">
            <BookOpen className="h-4 w-4 text-amber-700" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900">
              Statutory Illustrations ({sanitized.illustrations.length})
            </h4>
          </div>

          <div className="space-y-2.5">
            {sanitized.illustrations.map((ill, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2.5 rounded-lg border border-amber-200/80 bg-white p-3 text-xs leading-relaxed text-slate-800 shadow-2xs font-serif"
              >
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[11px] font-bold text-amber-900">
                  {ill.match(/^\([a-z]\)/i)?.[0]?.replace(/[\(\)]/g, "") || idx + 1}
                </span>
                <p className="pt-0.5">
                  {ill.replace(/^\([a-z]\)\s*/i, "")}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Judicial Guidance & Case Law Notes Card (Conditional) */}
      {sanitized.proceduralNotes.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4.5 shadow-xs">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2.5 mb-3">
            <Scale className="h-4 w-4 text-slate-700" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Judicial Notes & Procedural Doctrines ({sanitized.proceduralNotes.length})
            </h4>
          </div>

          <div className="space-y-2">
            {sanitized.proceduralNotes.map((note, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-slate-200 bg-white p-3 text-xs leading-relaxed text-slate-700 font-serif"
              >
                <p>{note}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Legislative History & Amendments Accordion (Conditional) */}
      {sanitized.amendmentNotes.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          <button
            type="button"
            onClick={() => setShowLegislativeHistory(!showLegislativeHistory)}
            className="w-full flex items-center justify-between p-3.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <History className="h-3.5 w-3.5 text-slate-500" />
              <span>Legislative History & Footnote Amendments ({sanitized.amendmentNotes.length})</span>
            </div>
            {showLegislativeHistory ? (
              <ChevronUp className="h-4 w-4 text-slate-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-slate-400" />
            )}
          </button>

          {showLegislativeHistory && (
            <div className="p-3.5 border-t border-slate-200 space-y-2 bg-slate-50/40 text-[11px] text-slate-600 font-mono">
              {sanitized.amendmentNotes.map((an, idx) => (
                <div key={idx} className="flex items-start gap-1.5">
                  <span className="text-slate-400">•</span>
                  <span>{an}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 6. Landmark Authority Precedents Section */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-[#105B38]" />
            <h4 className="text-sm font-bold text-slate-900 tracking-tight">
              Landmark Judicial Authorities & Precedents
            </h4>
          </div>

          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 border border-emerald-200">
            <Sparkles className="h-2.5 w-2.5" />
            Supreme Court & High Court Ratios
          </span>
        </div>

        {isLoadingPrecedents ? (
          <div className="p-4 text-center text-xs text-slate-500 animate-pulse bg-slate-50 rounded-xl border border-slate-200">
            Resolving authoritative precedent ratios...
          </div>
        ) : precedents.length > 0 ? (
          <div className="space-y-3">
            {precedents.map((prec, idx) => (
              <LandmarkAuthorityCard
                key={idx}
                precedent={prec}
                statuteTitle={statuteName}
                sectionNumber={sanitized.cleanSection}
                onExploreJudgment={onExploreJudgment}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
};
