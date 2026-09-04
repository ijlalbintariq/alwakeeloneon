import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  CalendarDays,
  Gavel,
  Clock,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Loader2,
  Calendar,
  ExternalLink,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { GoogleCalendarButton } from "@/components/google-calendar-button";
import { cn } from "@/lib/utils";

export interface CaseHearingItem {
  id: number;
  caseId: number;
  type: string;
  title: string;
  dueDate: string;
  court?: string | null;
  judge?: string | null;
  status: "pending" | "done" | "missed" | "adjourned";
  notes?: string | null;
}

interface HearingsSchedulerProps {
  caseId: number;
  caseTitle: string;
  caseNumber?: string;
  courtName?: string;
  hearings: CaseHearingItem[];
}

const COMMON_FIXATION_STAGES = [
  "For Arguments on Interim Injunction",
  "For Cross-Examination of Witness",
  "For Framing of Issues",
  "For Notice & Written Statement",
  "For Final Arguments",
  "For Bail Confirmation",
  "For Submission of Report / Record",
  "For Preliminary Hearing / Motion",
  "For Evidence of Plaintiff / Petitioner",
  "For Evidence of Defendant / Respondent",
];

export const HearingsScheduler: React.FC<HearingsSchedulerProps> = ({
  caseId,
  caseTitle,
  caseNumber,
  courtName,
  hearings,
}) => {
  const { toast } = useToast();
  const [title, setTitle] = useState<string>("");
  const [date, setDate] = useState<string>("");
  const [time, setTime] = useState<string>("09:30");
  const [court, setCourt] = useState<string>(courtName || "");
  const [judge, setJudge] = useState<string>("");
  const [type, setType] = useState<string>("hearing");

  const addHearingMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/case-files/${caseId}/compliance`, {
        title: title.trim() || "Next Court Hearing",
        dueDate: date,
        type,
        court: court.trim() || undefined,
        judge: judge.trim() || undefined,
        status: "pending",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/case-files/${caseId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/case-files"] });
      queryClient.invalidateQueries({ queryKey: ["/api/diary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/case-files-compliance/upcoming"] });
      toast({
        title: "Hearing Scheduled",
        description: "Added to case timeline and synchronized with Daily Diary.",
      });
      setTitle("");
      setDate("");
    },
    onError: (err: any) => {
      toast({
        title: "Failed to schedule",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({
      hearingId,
      status,
    }: {
      hearingId: number;
      status: "pending" | "done" | "adjourned";
    }) => {
      return apiRequest("PATCH", `/api/case-files/${caseId}/compliance/${hearingId}`, {
        status,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/case-files/${caseId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/case-files"] });
      queryClient.invalidateQueries({ queryKey: ["/api/diary"] });
      toast({ title: "Hearing status updated" });
    },
    onError: (err: any) => {
      toast({
        title: "Failed to update hearing status",
        description: err?.message || "Could not update hearing status.",
        variant: "destructive",
      });
    },
  });

  const sortedHearings = [...hearings].sort(
    (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  );

  return (
    <div className="space-y-6">
      {/* 1. Quick Set Next Hearing Card */}
      <div className="p-5 rounded-xl bg-[#FAFAF9] border border-[#1A1A1A]/20 dark:border-[#1E2D44] space-y-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gavel className="w-5 h-5 text-[#1A1A1A] dark:text-[#F8FAFC]" />
            <div>
              <h3 className="text-sm font-bold font-serif text-[#1A1A1A] dark:text-[#F8FAFC]">
                Fix Next Hearing Date
              </h3>
              <p className="text-[11px] text-[#666666] dark:text-[#94A3B8] dark:text-[#475569]">
                Auto-syncs with Daily Diary & generates 1-click Google Calendar / .ICS reminders
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#1A1A1A]/10 text-[#1A1A1A] dark:text-[#F8FAFC] border border-[#1A1A1A]/30">
            Auto-Diary Sync
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Fixation Stage / Purpose */}
          <div className="sm:col-span-2 space-y-1">
            <label className="text-[10px] font-mono uppercase text-[#666666] dark:text-[#94A3B8] dark:text-[#475569] block">
              Hearing Purpose / Stage *
            </label>
            <input
              type="text"
              placeholder="e.g. Arguments on Interim Injunction"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              list="common-stages"
              className="w-full bg-white dark:bg-[#131E2E] border border-[#E5E4E2] dark:border-[#1E2D44] rounded-lg px-3 py-2 text-xs text-[#1A1A1A] dark:text-[#F8FAFC] placeholder:text-[#666666] dark:text-[#94A3B8] dark:text-[#475569] outline-none focus:border-[#1A1A1A]/50"
            />
            <datalist id="common-stages">
              {COMMON_FIXATION_STAGES.map((st) => (
                <option key={st} value={st} />
              ))}
            </datalist>
          </div>

          {/* Date */}
          <div className="space-y-1">
            <label className="text-[10px] font-mono uppercase text-[#666666] dark:text-[#94A3B8] dark:text-[#475569] block">
              Hearing Date *
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-white dark:bg-[#131E2E] border border-[#E5E4E2] dark:border-[#1E2D44] rounded-lg px-3 py-2 text-xs text-[#1A1A1A] dark:text-[#F8FAFC] outline-none focus:border-[#1A1A1A]/50"
            />
          </div>

          {/* Court Room */}
          <div className="space-y-1">
            <label className="text-[10px] font-mono uppercase text-[#666666] dark:text-[#94A3B8] dark:text-[#475569] block">
              Court / Room
            </label>
            <input
              type="text"
              placeholder="e.g. Court #04, LHC"
              value={court}
              onChange={(e) => setCourt(e.target.value)}
              className="w-full bg-white dark:bg-[#131E2E] border border-[#E5E4E2] dark:border-[#1E2D44] rounded-lg px-3 py-2 text-xs text-[#1A1A1A] dark:text-[#F8FAFC] placeholder:text-[#666666] dark:text-[#94A3B8] dark:text-[#475569] outline-none focus:border-[#1A1A1A]/50"
            />
          </div>

          {/* Judge / Bench */}
          <div className="space-y-1">
            <label className="text-[10px] font-mono uppercase text-[#666666] dark:text-[#94A3B8] dark:text-[#475569] block">
              Bench / Judge Name
            </label>
            <input
              type="text"
              placeholder="e.g. Hon'ble Justice..."
              value={judge}
              onChange={(e) => setJudge(e.target.value)}
              className="w-full bg-white dark:bg-[#131E2E] border border-[#E5E4E2] dark:border-[#1E2D44] rounded-lg px-3 py-2 text-xs text-[#1A1A1A] dark:text-[#F8FAFC] placeholder:text-[#666666] dark:text-[#94A3B8] dark:text-[#475569] outline-none focus:border-[#1A1A1A]/50"
            />
          </div>

          {/* Type / Submit */}
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <label className="text-[10px] font-mono uppercase text-[#666666] dark:text-[#94A3B8] dark:text-[#475569] block">
                Category
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full bg-white dark:bg-[#131E2E] border border-[#E5E4E2] dark:border-[#1E2D44] rounded-lg px-2.5 py-2 text-xs text-[#2D2D2D] dark:text-[#CBD5E1] outline-none"
              >
                <option value="hearing">Court Hearing</option>
                <option value="filing_deadline">Filing Deadline</option>
                <option value="limitation">Statutory Limitation</option>
              </select>
            </div>

            <button
              onClick={() => addHearingMutation.mutate()}
              disabled={!date || addHearingMutation.isPending}
              className="px-4 py-2 rounded-lg bg-[#1A1A1A] hover:bg-[#2D2D2D] text-white font-bold text-xs transition-colors disabled:opacity-50 flex items-center gap-1.5 shrink-0"
            >
              {addHearingMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Calendar className="w-3.5 h-3.5" />
              )}
              <span>Set Date</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Court Dates & Hearing Timeline */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold font-serif text-[#2D2D2D] dark:text-[#CBD5E1] flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-[#1A1A1A] dark:text-[#F8FAFC]" />
            <span>Hearings & Cause List History ({sortedHearings.length})</span>
          </h3>
        </div>

        {sortedHearings.length === 0 ? (
          <div className="p-8 rounded-2xl bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] text-center space-y-2">
            <Gavel className="w-8 h-8 text-[#94A3B8] dark:text-[#475569] mx-auto" />
            <p className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">
              No hearing dates scheduled for this matter yet.
            </p>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">
              Use the form above to fix the upcoming hearing date.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {sortedHearings.map((h) => {
              const hearingDate = new Date(h.dueDate);
              const isPast =
                hearingDate.getTime() < new Date().setHours(0, 0, 0, 0) &&
                h.status !== "done";
              const isDone = h.status === "done";

              return (
                <div
                  key={h.id}
                  className={cn(
                    "p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3",
                    isPast
                      ? "bg-rose-50/5 dark:bg-rose-500/100 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20"
                      : isDone
                      ? "bg-[#F8FAFC] dark:bg-[#0B131E] border-[#E2E8F0] dark:border-[#1E2D44] opacity-75"
                      : "bg-white dark:bg-[#131E2E] border-[#E2E8F0] dark:border-[#1E2D44] hover:border-[#105B38]/40 shadow-xs"
                  )}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    {/* Calendar Badge */}
                    <div
                      className={cn(
                        "text-center px-3 py-1.5 rounded-xl border shrink-0",
                        isPast
                          ? "bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20 text-rose-700 dark:text-rose-400"
                          : isDone
                          ? "bg-[#F8FAFC] dark:bg-[#0B131E] border-[#E2E8F0] dark:border-[#1E2D44] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]"
                          : "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-[#105B38]"
                      )}
                    >
                      <p className="text-base font-bold font-mono leading-none">
                        {hearingDate.getDate()}
                      </p>
                      <p className="text-xs uppercase font-bold tracking-wider">
                        {hearingDate.toLocaleDateString(undefined, {
                          month: "short",
                        })}
                      </p>
                    </div>

                    {/* Hearing Details */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4
                          className={cn(
                            "text-xs sm:text-sm font-bold",
                            isDone ? "line-through text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]" : "text-[#0F172A] dark:text-[#F8FAFC]"
                          )}
                        >
                          {h.title}
                        </h4>
                        <span className="text-xs font-mono uppercase px-2 py-0.5 rounded-full bg-[#F8FAFC] dark:bg-[#0B131E] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] border border-[#E2E8F0] dark:border-[#1E2D44]">
                          {h.type.replace(/_/g, " ")}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] mt-1 flex-wrap font-mono">
                        {h.court && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-[#105B38]" />
                            {h.court}
                          </span>
                        )}
                        {h.judge && (
                          <span>• Bench: {h.judge}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions & Calendar Sync */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                    <GoogleCalendarButton
                      event={{
                        title: `${caseNumber ? `[${caseNumber}] ` : ""}${h.title}`,
                        caseNumber,
                        caseTitle,
                        court: h.court || courtName,
                        judgeName: h.judge,
                        date: h.dueDate.slice(0, 10),
                        time: "09:30",
                        isRedList: isPast,
                      }}
                      size="sm"
                      variant="outline"
                      className="bg-white dark:bg-[#131E2E] border-[#E2E8F0] dark:border-[#1E2D44] text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F8FAFC] dark:bg-[#0B131E] text-xs font-semibold rounded-xl"
                    />

                    {isDone ? (
                      <button
                        type="button"
                        onClick={() =>
                          updateStatusMutation.mutate({
                            hearingId: h.id,
                            status: "pending",
                          })
                        }
                        className="px-3 py-1.5 rounded-xl text-xs font-mono font-bold bg-emerald-50 dark:bg-emerald-500/10 text-[#105B38] border border-emerald-200 dark:border-emerald-500/20 hover:bg-emerald-100 transition-colors"
                      >
                        Done ✓
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          updateStatusMutation.mutate({
                            hearingId: h.id,
                            status: "done",
                          })
                        }
                        className="px-3 py-1.5 rounded-xl text-xs font-mono font-bold bg-[#F8FAFC] dark:bg-[#0B131E] text-[#0F172A] dark:text-[#F8FAFC] border border-[#E2E8F0] dark:border-[#1E2D44] hover:bg-emerald-50 dark:bg-emerald-500/10 hover:text-[#105B38] hover:border-emerald-200 dark:border-emerald-500/20 transition-all"
                      >
                        Mark Done
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
export default HearingsScheduler;
