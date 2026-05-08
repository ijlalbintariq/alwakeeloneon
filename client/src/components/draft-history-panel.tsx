/**
 * DraftHistoryPanel — UI component for viewing and restoring draft snapshots.
 *
 * Displays a timeline of snapshots with:
 *  - Timestamp and title
 *  - Word count and delta
 *  - Preview mode (read-only)
 *  - Diff mode (word-level comparison)
 *  - Restore and delete actions
 */

import { useState } from "react";
import {
  Clock,
  RotateCcw,
  Trash2,
  FileText,
  GitCompareArrows,
  X,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import type { DraftSnapshot, DiffSegment } from "@/hooks/use-draft-history";
import { computeWordDiff } from "@/hooks/use-draft-history";

type DraftHistoryPanelProps = {
  snapshots: DraftSnapshot[];
  currentText: string;
  onRestore: (snapshot: DraftSnapshot) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
};

function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString("en-PK", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function DiffView({ segments }: { segments: DiffSegment[] }) {
  return (
    <div className="text-xs leading-relaxed whitespace-pre-wrap font-mono p-3 rounded-lg bg-background/50 border border-border max-h-[300px] overflow-y-auto">
      {segments.map((seg, i) => {
        if (seg.type === "same") {
          return <span key={i} className="text-foreground/70">{seg.text}</span>;
        }
        if (seg.type === "added") {
          return (
            <span key={i} className="bg-emerald-500/20 text-emerald-400 rounded-sm px-0.5">
              {seg.text}
            </span>
          );
        }
        return (
          <span key={i} className="bg-red-500/20 text-red-400 line-through rounded-sm px-0.5">
            {seg.text}
          </span>
        );
      })}
    </div>
  );
}

export function DraftHistoryPanel({
  snapshots,
  currentText,
  onRestore,
  onDelete,
  onClearAll,
}: DraftHistoryPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [diffId, setDiffId] = useState<string | null>(null);

  if (snapshots.length === 0) {
    return (
      <div className="p-4 text-center">
        <Clock size={28} className="mx-auto mb-3 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground font-medium mb-1">No version history</p>
        <p className="text-[10px] text-muted-foreground/70">
          Snapshots are created automatically when you save your draft.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {/* Header */}
      <div className="flex items-center justify-between px-1 mb-2">
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-primary" />
          <span className="text-xs font-bold text-foreground tracking-tight">VERSION HISTORY</span>
        </div>
        <button
          onClick={onClearAll}
          className="text-[9px] px-2 py-0.5 rounded border border-border text-muted-foreground hover:text-red-400 hover:border-red-500/30"
        >
          Clear All
        </button>
      </div>

      <div className="text-[9px] text-muted-foreground px-1 mb-3">
        {snapshots.length} snapshot{snapshots.length !== 1 ? "s" : ""}
      </div>

      {/* Timeline */}
      <div className="space-y-1.5">
        {snapshots.map((snap, index) => {
          const isExpanded = expandedId === snap.id;
          const isShowingDiff = diffId === snap.id;
          const prevSnap = index < snapshots.length - 1 ? snapshots[index + 1] : null;
          const wordDelta = prevSnap ? snap.wordCount - prevSnap.wordCount : snap.wordCount;

          return (
            <div
              key={snap.id}
              className={`rounded-lg border transition-all ${
                isExpanded
                  ? "border-primary/30 bg-primary/5"
                  : "border-border/60 bg-card/30 hover:border-border"
              }`}
            >
              {/* Snapshot header */}
              <button
                className="w-full text-left px-3 py-2 flex items-center gap-2"
                onClick={() => setExpandedId(isExpanded ? null : snap.id)}
              >
                {isExpanded ? (
                  <ChevronDown size={12} className="text-primary shrink-0" />
                ) : (
                  <ChevronRight size={12} className="text-muted-foreground shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-foreground truncate">
                      {snap.title || "Untitled"}
                    </span>
                    <span className="text-[9px] text-muted-foreground shrink-0">
                      {timeAgo(snap.timestamp)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[9px] text-muted-foreground">
                      {snap.wordCount} words
                    </span>
                    {wordDelta !== 0 && (
                      <span
                        className={`text-[9px] font-medium ${
                          wordDelta > 0 ? "text-emerald-400" : "text-red-400"
                        }`}
                      >
                        {wordDelta > 0 ? `+${wordDelta}` : wordDelta}
                      </span>
                    )}
                    <span className="text-[8px] text-muted-foreground/50">
                      {formatTimestamp(snap.timestamp)}
                    </span>
                  </div>
                </div>
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div className="px-3 pb-3 space-y-2 border-t border-border/40 pt-2">
                  {/* Action buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onRestore(snap)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-primary/30 bg-primary/10 text-[10px] font-bold text-primary hover:bg-primary/20"
                    >
                      <RotateCcw size={10} />
                      Restore
                    </button>
                    <button
                      onClick={() => setDiffId(isShowingDiff ? null : snap.id)}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] font-bold ${
                        isShowingDiff
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:text-foreground hover:border-border"
                      }`}
                    >
                      <GitCompareArrows size={10} />
                      {isShowingDiff ? "Hide Diff" : "Compare"}
                    </button>
                    <button
                      onClick={() => onDelete(snap.id)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-border text-[10px] text-muted-foreground hover:text-red-400 hover:border-red-500/30"
                    >
                      <Trash2 size={10} />
                      Delete
                    </button>
                  </div>

                  {/* Preview */}
                  {!isShowingDiff && (
                    <div className="text-[11px] text-foreground/80 leading-relaxed max-h-[200px] overflow-y-auto bg-background/40 rounded-lg p-2 border border-border/40">
                      {snap.text.slice(0, 1000)}
                      {snap.text.length > 1000 && (
                        <span className="text-muted-foreground"> ... ({snap.wordCount} words total)</span>
                      )}
                    </div>
                  )}

                  {/* Diff view */}
                  {isShowingDiff && (
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                          Changes vs Current
                        </span>
                        <div className="flex items-center gap-2 text-[8px]">
                          <span className="flex items-center gap-0.5">
                            <span className="inline-block w-2 h-2 rounded-sm bg-emerald-500/30" />
                            Added
                          </span>
                          <span className="flex items-center gap-0.5">
                            <span className="inline-block w-2 h-2 rounded-sm bg-red-500/30" />
                            Removed
                          </span>
                        </div>
                      </div>
                      <DiffView segments={computeWordDiff(snap.text, currentText)} />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
