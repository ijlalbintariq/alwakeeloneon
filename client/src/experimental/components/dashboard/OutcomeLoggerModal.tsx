import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  CheckCircle2,
  Calendar,
  Clock,
  Gavel,
  FileText,
  AlertCircle,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export interface DiaryEntryItem {
  id: string | number;
  source?: string;
  date: string;
  time?: string | null;
  title: string;
  description?: string;
  caseId?: number;
  caseTitle?: string;
  court?: string;
  priority?: string;
  completed?: boolean;
  status?: string;
  type?: string;
  outcome?: string;
  nextDate?: string;
}

interface OutcomeLoggerModalProps {
  entry: DiaryEntryItem | null;
  isOpen: boolean;
  onClose: () => void;
  todayStr: string;
}

const COMMON_OUTCOMES = [
  "Adjourned — Next Date Fixed",
  "Stay Order Extended",
  "Arguments Concluded — Judgment Reserved",
  "Notice Issued to AGP / State",
  "Ad-interim Injunction Granted",
  "Bail Application Allowed",
  "Bail Application Dismissed",
  "Issues Framed — Next for Evidence",
  "Cross-Examination Concluded",
  "Suit Decreed in Favor of Client",
  "Matter Withdrawn with Liberty",
  "Referred to ADR / Chamber Settlement",
];

export const OutcomeLoggerModal: React.FC<OutcomeLoggerModalProps> = ({
  entry,
  isOpen,
  onClose,
  todayStr,
}) => {
  const { toast } = useToast();
  const [outcome, setOutcome] = useState<string>(entry?.outcome || "");
  const [nextDate, setNextDate] = useState<string>(
    entry?.nextDate ||
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10)
  );
  const [completed, setCompleted] = useState<boolean>(entry?.completed ?? true);
  const [notes, setNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  React.useEffect(() => {
    if (entry) {
      setOutcome(entry.outcome || "");
      setCompleted(entry.completed ?? true);
      if (entry.nextDate) {
        setNextDate(entry.nextDate);
      }
    }
  }, [entry]);

  if (!entry) return null;

  const isComplianceSource =
    typeof entry.id === "string" && entry.id.startsWith("comp-");
  const rawId = isComplianceSource
    ? Number(String(entry.id).replace("comp-", ""))
    : Number(entry.id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!outcome.trim()) {
      toast({
        title: "Outcome required",
        description: "Please select or enter the hearing outcome.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      if (isComplianceSource) {
        // If it's a compliance entry, create a manual diary entry or update compliance status
        // Create corresponding diary entry with outcome
        await apiRequest("POST", "/api/diary", {
          title: `[Outcome] ${entry.title}`,
          description: `${outcome}${notes ? ` — ${notes}` : ""}`,
          date: todayStr,
          time: entry.time || "10:00 AM",
          caseId: entry.caseId,
          priority: entry.priority || "normal",
          outcome,
          nextDate: nextDate || undefined,
        });
      } else {
        await apiRequest("PATCH", `/api/diary/${rawId}`, {
          outcome,
          completed,
          nextDate: nextDate || undefined,
          description: notes
            ? `${entry.description || ""}\nNotes: ${notes}`.trim()
            : entry.description,
        });

        // If nextDate was provided, also auto-create next diary entry
        if (nextDate && nextDate !== entry.date) {
          await apiRequest("POST", "/api/diary", {
            title: `Next Hearing: ${entry.title}`,
            description: `Chained from ${entry.date} hearing. Previous outcome: ${outcome}`,
            date: nextDate,
            time: entry.time || "09:30 AM",
            caseId: entry.caseId,
            priority: entry.priority || "normal",
          }).catch(() => {
            // non-fatal if duplicate
          });
        }
      }

      toast({
        title: "Hearing Outcome Logged",
        description: `Outcome for "${entry.title}" saved successfully. Next date chained: ${nextDate || "None"}.`,
      });

      await queryClient.invalidateQueries({ queryKey: ["/api/diary"] });
      await queryClient.invalidateQueries({
        queryKey: ["/api/case-files-compliance/upcoming"],
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/case-files"] });

      onClose();
    } catch (err: any) {
      toast({
        title: "Failed to log outcome",
        description: err.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg bg-white dark:bg-[#131E2E] border-[#E5E4E2] dark:border-[#1E2D44] text-[#1A1A1A] dark:text-[#F8FAFC] p-6 shadow-lg">
        <DialogHeader>
          <div className="flex items-center gap-2 text-[#1A1A1A] dark:text-[#F8FAFC] font-mono text-xs mb-1">
            <Gavel className="w-4 h-4" />
            <span>COURT HEARING OUTCOME LOGGER</span>
          </div>
          <DialogTitle className="text-xl font-bold font-serif text-[#1A1A1A] dark:text-[#F8FAFC]">
            {entry.title}
          </DialogTitle>
          <DialogDescription className="text-xs text-[#666666] dark:text-[#94A3B8] dark:text-[#475569]">
            {entry.court || "High Court / District Court"} ·{" "}
            {entry.caseTitle || "Litigation Matter"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Quick Outcome Preset Chips */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#4A4A4A] dark:text-[#94A3B8] dark:text-[#475569]">
              Select Standard Court Outcome:
            </label>
            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
              {COMMON_OUTCOMES.map((item) => (
                <button
                  type="button"
                  key={item}
                  onClick={() => setOutcome(item)}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all text-left ${
                    outcome === item
                      ? "bg-[#1A1A1A]/10 text-[#1A1A1A] dark:text-[#F8FAFC] border-[#1A1A1A]/60 font-semibold"
                      : "bg-white dark:bg-[#131E2E] text-[#666666] dark:text-[#94A3B8] dark:text-[#475569] border-[#E5E4E2] dark:border-[#1E2D44] hover:border-[#E5E4E2] dark:border-[#1E2D44] hover:text-[#2D2D2D] dark:text-[#CBD5E1]"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Outcome Textarea / Input */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#4A4A4A] dark:text-[#94A3B8] dark:text-[#475569]">
              Judicial Order / Outcome Summary:
            </label>
            <input
              type="text"
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              placeholder="e.g. Adjourned on request of AGP, interim stay continued"
              className="w-full px-3 py-2 rounded-lg bg-white dark:bg-[#131E2E] border border-[#E5E4E2] dark:border-[#1E2D44] text-[#1A1A1A] dark:text-[#F8FAFC] placeholder-slate-500 text-xs focus:outline-none focus:border-[#1A1A1A]"
              required
            />
          </div>

          {/* Next Date Chaining */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#4A4A4A] dark:text-[#94A3B8] dark:text-[#475569] flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#1A1A1A] dark:text-[#F8FAFC]" />
                <span>Next Hearing Date:</span>
              </label>
              <input
                type="date"
                value={nextDate}
                onChange={(e) => setNextDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-[#131E2E] border border-[#E5E4E2] dark:border-[#1E2D44] text-[#1A1A1A] dark:text-[#F8FAFC] text-xs font-mono focus:outline-none focus:border-[#1A1A1A]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#4A4A4A] dark:text-[#94A3B8] dark:text-[#475569] flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#1A1A1A] dark:text-[#F8FAFC]" />
                <span>Hearing Status:</span>
              </label>
              <div className="flex items-center gap-2 h-9 px-3 rounded-lg bg-white dark:bg-[#131E2E] border border-[#E5E4E2] dark:border-[#1E2D44] text-xs">
                <input
                  type="checkbox"
                  id="hearing-complete"
                  checked={completed}
                  onChange={(e) => setCompleted(e.target.checked)}
                  className="rounded border-[#E5E4E2] dark:border-[#1E2D44] text-[#1A1A1A] dark:text-[#F8FAFC] focus:ring-[#1A1A1A]"
                />
                <label
                  htmlFor="hearing-complete"
                  className="text-[#4A4A4A] dark:text-[#94A3B8] dark:text-[#475569] cursor-pointer"
                >
                  Mark hearing completed
                </label>
              </div>
            </div>
          </div>

          {/* Chamber Notes */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#4A4A4A] dark:text-[#94A3B8] dark:text-[#475569]">
              Chambers Internal Notes (optional):
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Instructions for junior counsel, missing affidavits, or required citation preparation..."
              className="w-full px-3 py-2 rounded-lg bg-white dark:bg-[#131E2E] border border-[#E5E4E2] dark:border-[#1E2D44] text-[#1A1A1A] dark:text-[#F8FAFC] placeholder-slate-500 text-xs focus:outline-none focus:border-[#1A1A1A] resize-none"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-[#E5E4E2] dark:border-[#1E2D44]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-[#F5F4F2] dark:bg-[#0B131E] hover:bg-[#EBEBEB] dark:bg-[#1E2D44] text-[#4A4A4A] dark:text-[#94A3B8] dark:text-[#475569] text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1A1A1A] hover:bg-[#2D2D2D] text-white font-bold text-xs transition-colors shadow-lg shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Recording...</span>
              ) : (
                <>
                  <span>Save Outcome & Chain Next Date</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
