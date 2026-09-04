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
  CalendarDays,
  Clock,
  Briefcase,
  AlertTriangle,
  Sparkles,
  Building,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AddHearingModalProps {
  isOpen: boolean;
  onClose: () => void;
  cases?: any[];
  defaultDate?: string;
}

export const AddHearingModal: React.FC<AddHearingModalProps> = ({
  isOpen,
  onClose,
  cases = [],
  defaultDate,
}) => {
  const { toast } = useToast();
  const today = defaultDate || new Date().toISOString().slice(0, 10);

  const [title, setTitle] = useState<string>("");
  const [date, setDate] = useState<string>(today);
  const [time, setTime] = useState<string>("10:00 AM");
  const [court, setCourt] = useState<string>("Lahore High Court");
  const [caseId, setCaseId] = useState<string>("");
  const [priority, setPriority] = useState<"urgent" | "high" | "normal" | "low">("high");
  const [stage, setStage] = useState<string>("Arguments");
  const [description, setDescription] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleCaseSelect = (selectedId: string) => {
    setCaseId(selectedId);
    if (selectedId) {
      const found = cases.find((c) => String(c.id) === selectedId);
      if (found) {
        if (!title) {
          setTitle(`${found.title} — Hearing`);
        }
        if (found.court) {
          setCourt(found.court);
        }
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date) {
      toast({
        title: "Missing Fields",
        description: "Please enter a hearing title and date.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const fullDescription = [
        court ? `Court: ${court}` : null,
        stage ? `Stage: ${stage}` : null,
        description ? `Notes: ${description}` : null,
      ]
        .filter(Boolean)
        .join(" • ");

      await apiRequest("POST", "/api/diary", {
        title: title.trim(),
        date,
        time: time.trim() || undefined,
        description: fullDescription || undefined,
        caseId: caseId ? Number(caseId) : undefined,
        priority,
      });

      toast({
        title: "Hearing Added to Diary",
        description: `Scheduled "${title}" for ${date} at ${time}.`,
      });

      await queryClient.invalidateQueries({ queryKey: ["/api/diary"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/case-files-compliance/upcoming"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/case-files"] });

      // Reset form & close
      setTitle("");
      setCaseId("");
      setDescription("");
      onClose();
    } catch (err: any) {
      toast({
        title: "Failed to schedule hearing",
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
            <CalendarDays className="w-4 h-4" />
            <span>DAILY DIARY · DOCKET SCHEDULER</span>
          </div>
          <DialogTitle className="text-xl font-bold font-serif text-[#1A1A1A] dark:text-[#F8FAFC]">
            Schedule Court Hearing
          </DialogTitle>
          <DialogDescription className="text-xs text-[#666666] dark:text-[#94A3B8] dark:text-[#475569]">
            Add a scheduled appearance to your chambers cause list (Asia/Karachi PKT).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Linked Case Dropdown */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#4A4A4A] dark:text-[#94A3B8] dark:text-[#475569] flex items-center gap-1">
              <Briefcase className="w-3.5 h-3.5 text-[#1A1A1A] dark:text-[#F8FAFC]" />
              <span>Link to Matter / Case File (optional):</span>
            </label>
            <select
              value={caseId}
              onChange={(e) => handleCaseSelect(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white dark:bg-[#131E2E] border border-[#E5E4E2] dark:border-[#1E2D44] text-[#2D2D2D] dark:text-[#CBD5E1] text-xs focus:outline-none focus:border-[#1A1A1A]"
            >
              <option value="">-- General Hearing / Standalone --</option>
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} {c.court ? `(${c.court})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Hearing Title */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#4A4A4A] dark:text-[#94A3B8] dark:text-[#475569]">
              Hearing / Cause Title:
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. W.P. 5102/2024 — Tariq vs. Federation (Stay Application)"
              className="w-full px-3 py-2 rounded-lg bg-white dark:bg-[#131E2E] border border-[#E5E4E2] dark:border-[#1E2D44] text-[#1A1A1A] dark:text-[#F8FAFC] placeholder-slate-500 text-xs focus:outline-none focus:border-[#1A1A1A]"
              required
            />
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#4A4A4A] dark:text-[#94A3B8] dark:text-[#475569] flex items-center gap-1">
                <CalendarDays className="w-3.5 h-3.5 text-[#1A1A1A] dark:text-[#F8FAFC]" />
                <span>Hearing Date:</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-[#131E2E] border border-[#E5E4E2] dark:border-[#1E2D44] text-[#1A1A1A] dark:text-[#F8FAFC] text-xs font-mono focus:outline-none focus:border-[#1A1A1A]"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#4A4A4A] dark:text-[#94A3B8] dark:text-[#475569] flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-[#1A1A1A] dark:text-[#F8FAFC]" />
                <span>Scheduled Time:</span>
              </label>
              <input
                type="text"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                placeholder="e.g. 10:30 AM"
                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-[#131E2E] border border-[#E5E4E2] dark:border-[#1E2D44] text-[#1A1A1A] dark:text-[#F8FAFC] text-xs focus:outline-none focus:border-[#1A1A1A]"
              />
            </div>
          </div>

          {/* Court Forum and Stage */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#4A4A4A] dark:text-[#94A3B8] dark:text-[#475569] flex items-center gap-1">
                <Building className="w-3.5 h-3.5 text-[#666666] dark:text-[#94A3B8] dark:text-[#475569]" />
                <span>Court / Forum:</span>
              </label>
              <input
                type="text"
                value={court}
                onChange={(e) => setCourt(e.target.value)}
                placeholder="e.g. Lahore High Court, Courtroom 4"
                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-[#131E2E] border border-[#E5E4E2] dark:border-[#1E2D44] text-[#1A1A1A] dark:text-[#F8FAFC] text-xs focus:outline-none focus:border-[#1A1A1A]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#4A4A4A] dark:text-[#94A3B8] dark:text-[#475569]">
                Judicial Stage / Purpose:
              </label>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-[#131E2E] border border-[#E5E4E2] dark:border-[#1E2D44] text-[#2D2D2D] dark:text-[#CBD5E1] text-xs focus:outline-none focus:border-[#1A1A1A]"
              >
                <option value="Motion / Urgent Admission">Motion / Urgent Admission</option>
                <option value="Arguments on Stay">Arguments on Stay</option>
                <option value="Final Arguments">Final Arguments</option>
                <option value="Cross-Examination of PWs">Cross-Examination of PWs</option>
                <option value="Framing of Issues">Framing of Issues</option>
                <option value="Bail Pre-Arrest / Post-Arrest">Bail Pre-Arrest / Post-Arrest</option>
                <option value="Leave to Appeal">Leave to Appeal</option>
                <option value="Notice to Respondents">Notice to Respondents</option>
              </select>
            </div>
          </div>

          {/* Priority */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#4A4A4A] dark:text-[#94A3B8] dark:text-[#475569]">
              Chambers Priority:
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { key: "urgent", label: "Urgent", color: "border-rose-500/50 text-rose-300 bg-rose-500/10" },
                { key: "high", label: "High", color: "border-[#1A1A1A]/50 text-[#1A1A1A] dark:text-[#F8FAFC] bg-[#1A1A1A]/5 dark:bg-[#1A1A1A]/50" },
                { key: "normal", label: "Normal", color: "border-emerald-500/50 text-[#1A1A1A] dark:text-[#F8FAFC] bg-[#F5F4F2] dark:bg-[#0B131E]" },
                { key: "low", label: "Low", color: "border-[#E5E4E2] dark:border-[#1E2D44] text-[#4A4A4A] dark:text-[#94A3B8] dark:text-[#475569] bg-[#F5F4F2] dark:bg-[#0B131E]" },
              ].map((p) => (
                <button
                  type="button"
                  key={p.key}
                  onClick={() => setPriority(p.key as any)}
                  className={`py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    priority === p.key
                      ? `${p.color} ring-1 ring-[#1A1A1A] font-bold`
                      : "border-[#E5E4E2] dark:border-[#1E2D44] bg-white dark:bg-[#131E2E] text-[#666666] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#4A4A4A] dark:text-[#94A3B8] dark:text-[#475569]"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
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
              className="px-4 py-2 rounded-lg bg-[#1A1A1A] hover:bg-[#2D2D2D] text-white font-bold text-xs transition-colors shadow-lg shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? "Scheduling..." : "Add to Daily Diary"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
