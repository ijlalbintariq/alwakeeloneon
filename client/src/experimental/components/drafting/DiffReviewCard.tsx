import React, { useState, useMemo } from "react";
import {
  Check,
  X,
  Copy,
  Scale,
  Sparkles,
  ArrowRight,
  Eye,
  GitCommit,
  RefreshCw,
  CornerDownLeft,
} from "lucide-react";
import { computeWordDiff, type DiffResult } from "@/experimental/lib/text-diff";
import { cn } from "@/lib/utils";

export interface DiffReviewCardProps {
  originalText: string;
  revisedText: string;
  targetLabel?: string;
  isWholeDocument?: boolean;
  isInsertion?: boolean;
  onAccept: (revisedText: string) => void;
  onReject: () => void;
  onRevise?: (revisionPrompt: string) => void;
  isRevising?: boolean;
}

export const DiffReviewCard: React.FC<DiffReviewCardProps> = ({
  originalText,
  revisedText,
  targetLabel = "Proposed Revision",
  isWholeDocument = false,
  isInsertion = false,
  onAccept,
  onReject,
  onRevise,
  isRevising = false,
}) => {
  const [viewMode, setViewMode] = useState<"diff" | "preview" | "original">("diff");
  const [copied, setCopied] = useState(false);
  const [revisionInput, setRevisionInput] = useState("");
  const [showRevisionInput, setShowRevisionInput] = useState(false);

  const diffResult: DiffResult = useMemo(() => {
    return computeWordDiff(originalText || "", revisedText || "");
  }, [originalText, revisedText]);

  const handleCopy = () => {
    const fallbackCopy = () => {
      try {
        const el = document.createElement("textarea");
        el.value = revisedText;
        el.style.position = "fixed";
        el.style.opacity = "0";
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Ignored
      }
    };

    try {
      if (navigator?.clipboard?.writeText) {
        navigator.clipboard
          .writeText(revisedText)
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          })
          .catch(() => fallbackCopy());
      } else {
        fallbackCopy();
      }
    } catch {
      fallbackCopy();
    }
  };

  const handleSendRevision = (promptText?: string) => {
    const text = (promptText || revisionInput).trim();
    if (!text || isRevising) return;
    onRevise?.(text);
    setRevisionInput("");
    setShowRevisionInput(false);
  };

  return (
    <div className="mt-2.5 rounded-xl border border-[#105B38]/30 dark:border-emerald-600/30 bg-[#FBFDFB] dark:bg-[#0E1A16] shadow-sm overflow-hidden animate-in fade-in-50 duration-200">
      {/* ── Top Header Bar ─────────────────────────────────────────── */}
      <div className="px-3 py-2 bg-[#F1F7F3] dark:bg-[#13231D] border-b border-[#105B38]/20 dark:border-emerald-700/20 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="p-1 rounded-md bg-[#105B38]/10 text-[#105B38] dark:text-emerald-400 shrink-0">
            <Sparkles className="w-3.5 h-3.5" />
          </span>
          <span className="text-[11px] font-bold text-[#0F172A] dark:text-[#F8FAFC] truncate">
            {targetLabel}
          </span>
          {isWholeDocument ? (
            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
              Whole Pleading
            </span>
          ) : (
            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
              {isInsertion ? "New Clause" : "Surgical Selection"}
            </span>
          )}
        </div>

        {/* View Mode Toggle: Diff / Clean / Original */}
        <div className="flex items-center p-0.5 rounded-lg bg-white/80 dark:bg-[#0B131E]/80 border border-slate-200 dark:border-slate-800 text-[10px] font-medium">
          <button
            type="button"
            onClick={() => setViewMode("diff")}
            className={cn(
              "px-2 py-0.5 rounded-md transition-colors",
              viewMode === "diff"
                ? "bg-[#105B38] text-white font-bold shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            )}
            title="View additions and deletions"
          >
            Diff
          </button>
          <button
            type="button"
            onClick={() => setViewMode("preview")}
            className={cn(
              "px-2 py-0.5 rounded-md transition-colors",
              viewMode === "preview"
                ? "bg-[#105B38] text-white font-bold shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            )}
            title="Preview clean updated text"
          >
            Preview
          </button>
          {originalText && (
            <button
              type="button"
              onClick={() => setViewMode("original")}
              className={cn(
                "px-2 py-0.5 rounded-md transition-colors",
                viewMode === "original"
                  ? "bg-[#105B38] text-white font-bold shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              )}
              title="View original text before edit"
            >
              Original
            </button>
          )}
        </div>
      </div>

      {/* ── Changes Stats Badge ─────────────────────────────────────── */}
      <div className="px-3 py-1 bg-white/50 dark:bg-black/20 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-2">
          {diffResult.additionsCount > 0 && (
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
              +{diffResult.additionsCount} words added
            </span>
          )}
          {diffResult.deletionsCount > 0 && (
            <span className="text-rose-600 dark:text-rose-400 font-semibold">
              -{diffResult.deletionsCount} words removed
            </span>
          )}
          {!diffResult.hasChanges && <span>No wording differences detected</span>}
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1 transition-colors"
          title="Copy revised text"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>

      {/* ── Diff Canvas Viewport ────────────────────────────────────── */}
      <div className="p-3 max-h-56 overflow-y-auto custom-scrollbar font-serif text-[11.5px] leading-relaxed text-slate-800 dark:text-slate-200 bg-white dark:bg-[#0D161A] select-text">
        {viewMode === "diff" && (
          <div className="whitespace-pre-wrap">
            {diffResult.tokens.map((token, idx) => {
              if (token.type === "add") {
                return (
                  <span
                    key={idx}
                    className="bg-emerald-100/90 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 font-medium px-0.5 rounded-xs mx-0.5 border-b border-emerald-500/50"
                  >
                    {token.value}
                  </span>
                );
              }
              if (token.type === "del") {
                return (
                  <span
                    key={idx}
                    className="bg-rose-100/90 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 line-through decoration-rose-500 px-0.5 rounded-xs mx-0.5 opacity-80"
                  >
                    {token.value}
                  </span>
                );
              }
              return <span key={idx}>{token.value}</span>;
            })}
          </div>
        )}

        {viewMode === "preview" && (
          <div className="whitespace-pre-wrap text-slate-900 dark:text-slate-100 font-medium">
            {revisedText}
          </div>
        )}

        {viewMode === "original" && (
          <div className="whitespace-pre-wrap text-slate-600 dark:text-slate-400 italic">
            {originalText || "No previous text recorded."}
          </div>
        )}
      </div>

      {/* ── Follow-Up Revision Input (Collapsible) ───────────────────── */}
      {showRevisionInput && (
        <div className="p-2.5 bg-slate-50 dark:bg-[#131F2A] border-t border-slate-200 dark:border-slate-800 animate-in slide-in-from-top-1 duration-150">
          <div className="text-[10px] font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
            <span>Request Further Revision</span>
            <button
              type="button"
              onClick={() => setShowRevisionInput(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          <div className="flex gap-1.5">
            <input
              type="text"
              value={revisionInput}
              onChange={(e) => setRevisionInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendRevision();
                }
              }}
              placeholder="e.g. 'Make it shorter and cite Order 39 CPC'..."
              disabled={isRevising}
              className="flex-1 px-2.5 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-black/40 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#105B38]"
            />
            <button
              type="button"
              onClick={() => handleSendRevision()}
              disabled={!revisionInput.trim() || isRevising}
              className="px-2.5 py-1 rounded-lg bg-[#105B38] hover:bg-[#0D4A2E] text-white text-xs font-bold transition-colors disabled:opacity-50 flex items-center gap-1"
            >
              <CornerDownLeft className="w-3 h-3" />
            </button>
          </div>
          {/* Quick Revision Chips */}
          <div className="flex flex-wrap gap-1 mt-1.5">
            {[
              "More concise",
              "More assertive court tone",
              "Add statutory citation",
              "Separate into numbered paras",
            ].map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => handleSendRevision(chip)}
                disabled={isRevising}
                className="text-[9px] px-2 py-0.5 rounded-md bg-white dark:bg-[#1A2634] border border-slate-200 dark:border-slate-700 hover:border-[#105B38] hover:text-[#105B38] text-slate-600 dark:text-slate-300 transition-colors"
              >
                + {chip}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Primary Action Footer: Accept, Reject, Revise ─────────────── */}
      <div className="p-2.5 bg-[#F8FAFC] dark:bg-[#0B131E] border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onReject}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131E2E] hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors"
            title="Discard this revision and keep original text"
          >
            <X className="w-3.5 h-3.5 text-rose-500" />
            <span>Reject</span>
          </button>

          {onRevise && (
            <button
              type="button"
              onClick={() => setShowRevisionInput((prev) => !prev)}
              className={cn(
                "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors",
                showRevisionInput
                  ? "bg-[#105B38]/10 text-[#105B38] border-[#105B38]/30"
                  : "bg-white dark:bg-[#131E2E] border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
              )}
              title="Ask AI for another variation"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", isRevising && "animate-spin")} />
              <span>Revise</span>
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => onAccept(revisedText)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#105B38] hover:bg-[#0D4A2E] text-white text-xs font-bold shadow-xs hover:shadow-sm transition-all"
          title={isWholeDocument ? "Apply changes to entire document" : isInsertion ? "Insert the proposed clause" : "Surgically replace selected text"}
        >
          <Check className="w-3.5 h-3.5" />
          <span>{isWholeDocument ? "Accept & Apply All" : isInsertion ? "Accept & Insert" : "Accept & Replace"}</span>
        </button>
      </div>
    </div>
  );
};
