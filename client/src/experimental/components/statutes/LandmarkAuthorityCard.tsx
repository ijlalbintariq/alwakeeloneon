/**
 * ============================================================================
 * LANDMARK AUTHORITY CARD COMPONENT
 * Strictly isolated in client/src/experimental/
 * ============================================================================
 * Renders an authoritative judicial precedent card featuring:
 * 1. Emerald citation pill with law report styling
 * 2. Adversarial case title & Court/Year hierarchy badge
 * 3. Ratio Decidendi quote block with quotation styling
 * 4. Action buttons: "Copy Ratio", "Copy Citation", "Explore Judgment",
 *    and "Insert into Drafting Studio".
 * ============================================================================
 */

import React, { useState } from "react";
import {
  Gavel,
  Scale,
  Landmark,
  Copy,
  Check,
  ExternalLink,
  FileEdit,
  Quote,
  Sparkles,
  BookOpen,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { LandmarkPrecedent } from "../../lib/precedentCache";
import type { LandmarkCitation } from "../../data/statutesCompendiumData";

export interface LandmarkAuthorityCardProps {
  precedent: LandmarkPrecedent | LandmarkCitation;
  statuteTitle?: string;
  sectionNumber?: string;
  onExploreJudgment?: (citation: string, judgmentId?: string) => void;
  onInsertDrafting?: (precedent: LandmarkPrecedent | LandmarkCitation) => void;
  compact?: boolean;
  className?: string;
}

export const LandmarkAuthorityCard: React.FC<LandmarkAuthorityCardProps> = ({
  precedent,
  statuteTitle = "Statute",
  sectionNumber = "",
  onExploreJudgment,
  onInsertDrafting,
  compact = false,
  className,
}) => {
  const { toast } = useToast();
  const [copiedCitation, setCopiedCitation] = useState(false);
  const [copiedRatio, setCopiedRatio] = useState(false);
  const [isInserting, setIsInserting] = useState(false);

  const citation = precedent.citation;
  const title = precedent.title || "Landmark Judicial Authority";
  const court = precedent.court || "Supreme Court of Pakistan";
  const year = precedent.year || 2024;
  const ratio = precedent.ratio || "Holding & legal ratio from reported law report.";
  const bench = precedent.bench;
  const judgmentId = (precedent as LandmarkPrecedent).judgmentId;
  const source = (precedent as LandmarkPrecedent).source || "tier1_curated";

  const isApex =
    court.toLowerCase().includes("supreme court") ||
    court.toLowerCase().includes("apex") ||
    citation.includes("SCMR") ||
    citation.includes("SC");

  // Copy Citation handler
  const handleCopyCitation = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(citation);
    setCopiedCitation(true);
    toast({
      title: "Citation Copied",
      description: `${citation} copied to clipboard.`,
    });
    setTimeout(() => setCopiedCitation(false), 2000);
  };

  // Copy Ratio handler
  const handleCopyRatio = (e: React.MouseEvent) => {
    e.stopPropagation();
    const ratioString = `${citation} (${title}) — "${ratio}"`;
    navigator.clipboard.writeText(ratioString);
    setCopiedRatio(true);
    toast({
      title: "Ratio Decidendi Copied",
      description: `Ratio from ${citation} copied with case title.`,
    });
    setTimeout(() => setCopiedRatio(false), 2000);
  };

  // Explore Judgment handler
  const handleExploreJudgment = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onExploreJudgment) {
      onExploreJudgment(citation, judgmentId);
    } else if (typeof window !== "undefined") {
      // Fallback: trigger custom event or navigation
      window.dispatchEvent(
        new CustomEvent("alwakeelo-explore-precedent", {
          detail: { citation, judgmentId, title, court, year, ratio },
        })
      );
    }
  };

  // Insert into Drafting Studio handler
  const handleInsertDrafting = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsInserting(true);

    const draftingClause = `STATUTORY PROVISION & RELEVANT LAW:\n${sectionNumber ? sectionNumber + " of " : ""}${statuteTitle}\n\nLEGAL GROUNDS & APPLICABLE PRINCIPLES:\nThat as settled by the Honourable ${court} in ${citation} (${title}):\n"${ratio}"\n\nConsequently, the petitioner is entitled to the relief sought in accordance with law.`;

    const payload = {
      statute: statuteTitle,
      section: sectionNumber,
      title: `${title} (${citation})`,
      clause: draftingClause,
      formattedCitation: `${citation} - ${court} (${year})`,
      timestamp: Date.now(),
    };

    try {
      localStorage.setItem("alwakeelo_drafting_insert", JSON.stringify(payload));
      window.dispatchEvent(
        new CustomEvent("alwakeelo-drafting-insert", { detail: payload })
      );

      if (onInsertDrafting) {
        onInsertDrafting(precedent);
      }

      toast({
        title: "Inserted into Drafting Studio",
        description: `Precedent ${citation} affixed to Drafting Studio clipboard.`,
      });
    } catch (err) {
      console.error("Failed to insert precedent into drafting", err);
    } finally {
      setTimeout(() => setIsInserting(false), 1500);
    }
  };

  return (
    <div
      className={cn(
        "group relative rounded-xl border transition-all duration-200",
        isApex
          ? "border-emerald-200/80 bg-gradient-to-br from-emerald-50/40 via-white to-emerald-50/20 shadow-xs hover:border-emerald-300 hover:shadow-md"
          : "border-slate-200 bg-white shadow-xs hover:border-slate-300 hover:shadow-md",
        compact ? "p-3.5" : "p-4.5",
        className
      )}
    >
      {/* Header Section */}
      <div className="flex flex-wrap items-start justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {/* Emerald Citation Pill */}
          <div
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold tracking-tight transition-colors",
              isApex
                ? "bg-emerald-100/90 text-emerald-900 border border-emerald-300/80 group-hover:bg-emerald-200/90"
                : "bg-slate-100 text-slate-800 border border-slate-300 group-hover:bg-slate-200"
            )}
          >
            <Gavel className="h-3.5 w-3.5 text-emerald-700" />
            <span className="font-mono">{citation}</span>
          </div>

          {/* Court & Year Hierarchy Badge */}
          <div className="inline-flex items-center gap-1 text-xs text-slate-600">
            <Landmark className="h-3 w-3 text-slate-400" />
            <span className="font-medium text-slate-700">{court}</span>
            <span className="text-slate-400">•</span>
            <span className="font-semibold text-slate-600">{year}</span>
          </div>

          {/* Tier / Source Badge */}
          {source === "tier1_curated" ? (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
              <Sparkles className="h-2.5 w-2.5" />
              Apex Ruling (0ms)
            </span>
          ) : source === "cached" ? (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 border border-blue-200">
              Cached (0ms)
            </span>
          ) : (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 border border-indigo-200">
              <Layers className="h-2.5 w-2.5" />
              Live DB
            </span>
          )}
        </div>

        {/* Bench Info */}
        {bench && (
          <span className="text-[11px] font-medium text-slate-500 italic">
            Bench: {bench}
          </span>
        )}
      </div>

      {/* Adversarial Case Title */}
      <h4 className="mt-2.5 text-sm font-semibold tracking-tight text-slate-900">
        {title}
      </h4>

      {/* Ratio Decidendi Quote Block */}
      <div className="relative mt-2.5 rounded-lg border-l-3 border-emerald-500 bg-emerald-50/50 p-3 text-xs leading-relaxed text-slate-800">
        <Quote className="absolute right-2.5 top-2.5 h-4 w-4 text-emerald-300 opacity-60" />
        <p className="font-serif italic tracking-wide pr-4">
          &ldquo;{ratio}&rdquo;
        </p>
      </div>

      {/* Action Hub Buttons Toolbar */}
      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2.5 border-t border-slate-100 pt-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Copy Ratio Button */}
          <button
            type="button"
            onClick={handleCopyRatio}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition-all whitespace-nowrap",
              copiedRatio
                ? "bg-emerald-600 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900"
            )}
            title="Copy ratio decidendi text with citation"
          >
            {copiedRatio ? (
              <>
                <Check className="h-4 w-4" />
                <span>Ratio Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                <span>Copy Ratio</span>
              </>
            )}
          </button>

          {/* Copy Citation Button */}
          <button
            type="button"
            onClick={handleCopyCitation}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition-all whitespace-nowrap",
              copiedCitation
                ? "bg-emerald-600 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900"
            )}
            title="Copy legal citation"
          >
            {copiedCitation ? (
              <>
                <Check className="h-4 w-4" />
                <span>Citation Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                <span>Copy Citation</span>
              </>
            )}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Insert into Drafting Studio */}
          <button
            type="button"
            onClick={handleInsertDrafting}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition-all whitespace-nowrap",
              isInserting
                ? "bg-emerald-700 text-white"
                : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
            )}
            title="Insert ratio into Legal Drafting Studio"
          >
            <FileEdit className="h-4 w-4" />
            <span>{isInserting ? "Inserted!" : "Insert into Drafting"}</span>
          </button>

          {/* Explore Judgment */}
          <button
            type="button"
            onClick={handleExploreJudgment}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#1B365D] px-3.5 py-2 text-sm font-medium text-white hover:bg-[#152a48] transition-colors whitespace-nowrap"
            title="Explore full judgment and headnotes"
          >
            <BookOpen className="h-4 w-4" />
            <span>Explore Judgment</span>
            <ExternalLink className="h-3 w-3 opacity-70" />
          </button>
        </div>
      </div>
    </div>
  );
};
