import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Gavel,
  Calendar,
  Clock,
  ArrowRight,
  Save,
  X,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Sparkles,
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export interface DiaryHearingItem {
  id: number | string;
  source: "manual" | "compliance";
  date: string;
  time?: string | null;
  title: string;
  description?: string | null;
  caseId?: number | null;
  caseTitle?: string | null;
  priority: string;
  completed: boolean;
  type?: string;
  status?: string;
  outcome?: string | null;
  nextDate?: string | null;
}

interface PostHearingOutcomeModalProps {
  item: DiaryHearingItem;
  onClose: () => void;
}

export const PAKISTANI_OUTCOMES = [
  {
    value: "arguments",
    label: "Arguments Heard / Concluded",
    urdu: "دلائل سنے گئے",
    color: "bg-slate-50 text-[#0F172A] border-slate-200",
    description: "Counsel advanced arguments on merits; further hearing or order reserved.",
  },
  {
    value: "evidence",
    label: "Evidence Recorded / Cross-Exam",
    urdu: "شہادت ریکارڈ ہوئی",
    color: "bg-blue-50 text-blue-700 border-blue-200",
    description: "Witness statement examined or cross-examination conducted.",
  },
  {
    value: "instruction",
    label: "For Instructions / Notice Issued",
    urdu: "ہدایات / نوٹس جاری",
    color: "bg-indigo-50 text-indigo-700 border-indigo-200",
    description: "Notice issued to respondent; standing counsel directed to seek instructions.",
  },
  {
    value: "order_passed",
    label: "Order Passed / Interim Relief Granted",
    urdu: "حکم جاری / حکم امتناعی منظور",
    color: "bg-emerald-50 text-[#105B38] border-emerald-200",
    description: "Court granted stay order, interim injunction, or bail relief.",
  },
  {
    value: "adjourned",
    label: "Adjourned / Adjournment Granted",
    urdu: "التواء دیا گیا",
    color: "bg-amber-50 text-amber-800 border-amber-200",
    description: "Adjourned on request of counsel, non-availability of bench, or time for reply.",
  },
  {
    value: "reserved",
    label: "Judgment / Order Reserved",
    urdu: "فیصلہ محفوظ",
    color: "bg-purple-50 text-purple-800 border-purple-200",
    description: "Arguments completed; judgment or short order reserved by bench.",
  },
  {
    value: "allowed",
    label: "Allowed / Petition Accepted",
    urdu: "درخواست منظور",
    color: "bg-emerald-50 text-emerald-800 border-emerald-200",
    description: "Petition or suit allowed in terms of prayer.",
  },
  {
    value: "partly_allowed",
    label: "Partly Allowed",
    urdu: "جزوی منظور",
    color: "bg-teal-50 text-teal-800 border-teal-200",
    description: "Relief granted partially; remaining claim declined.",
  },
  {
    value: "disposed_off",
    label: "Disposed Off / Settled",
    urdu: "مقدمہ نمٹایا گیا",
    color: "bg-slate-50 text-slate-700 border-slate-200",
    description: "Matter finalized with directions to relevant statutory authority.",
  },
  {
    value: "dnp",
    label: "DNP (Dismissed for Non-Prosecution)",
    urdu: "عدم پیروی خارج",
    color: "bg-rose-50 text-rose-700 border-rose-200",
    description: "Dismissed due to absence of petitioner or counsel when called.",
  },
  {
    value: "dismissed",
    label: "Dismissed on Merits",
    urdu: "خارج بر بنائے استحقاق",
    color: "bg-rose-50 text-rose-700 border-rose-200",
    description: "Petition or suit dismissed after hearing arguments.",
  },
  {
    value: "other",
    label: "Other Proceeding / Direction",
    urdu: "دیگر کارروائی",
    color: "bg-slate-50 text-slate-700 border-slate-200",
    description: "Miscellaneous court orders, commission appointment, or report submission.",
  },
];

export const PostHearingOutcomeModal: React.FC<PostHearingOutcomeModalProps> = ({
  item,
  onClose,
}) => {
  const { toast } = useToast();

  const [outcome, setOutcome] = useState<string>(item.outcome || "arguments");
  const [nextDate, setNextDate] = useState<string>(item.nextDate || "");
  const [nextTime, setNextTime] = useState<string>("09:30");
  const [nextStage, setNextStage] = useState<string>("");
  const [orderNotes, setOrderNotes] = useState<string>(item.description || "");
  const [autoChainNextDate, setAutoChainNextDate] = useState<boolean>(true);

  // Update current hearing outcome and optionally auto-create next chained date
  const saveOutcomeMutation = useMutation({
    mutationFn: async () => {
      if (item.source === "manual" && typeof item.id === "number") {
        await apiRequest("PATCH", `/api/diary/${item.id}`, {
          outcome,
          nextDate: nextDate || null,
          description: orderNotes || null,
          completed: true,
        });
      } else if (item.source === "compliance") {
        const compId = Number(String(item.id).replace("comp-", ""));
        if (item.caseId && compId) {
          await apiRequest("PATCH", `/api/case-files/${item.caseId}/compliance/${compId}`, {
            status: "done",
            notes: orderNotes ? `Outcome: ${outcome} — ${orderNotes}` : `Outcome: ${outcome}`,
          });
        }
      }

      // Auto-create next chained hearing date if set
      if (nextDate && autoChainNextDate) {
        const nextTitle =
          nextStage.trim() ||
          (outcome === "arguments"
            ? "Final Arguments"
            : outcome === "evidence"
            ? "Cross-Examination / Further Evidence"
            : outcome === "instruction"
            ? "Arguments / Compliance of Notice"
            : outcome === "adjourned"
            ? "Adjourned Hearing"
            : "Next Court Hearing");

        await apiRequest("POST", "/api/diary", {
          date: nextDate,
          time: nextTime || "09:30",
          title: nextTitle,
          description: `Chained from hearing on ${item.date} (${outcome})`,
          caseId: item.caseId || undefined,
          priority: item.priority || "normal",
        });

        // Also add compliance item to case if linked
        if (item.caseId) {
          try {
            await apiRequest("POST", `/api/case-files/${item.caseId}/compliance`, {
              type: "hearing",
              title: nextTitle,
              dueDate: nextDate,
              status: "pending",
            });
          } catch (e) {
            console.error("Error creating case compliance item:", e);
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/diary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/case-files"] });
      if (item.caseId) {
        queryClient.invalidateQueries({ queryKey: [`/api/case-files/${item.caseId}`] });
      }
      toast({
        title: "Hearing Outcome Recorded",
        description: nextDate
          ? `Recorded result and automatically scheduled next hearing for ${nextDate}.`
          : "Hearing marked completed with outcome.",
      });
      onClose();
    },
    onError: (err: any) => {
      toast({
        title: "Failed to record outcome",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const selectedOutcomeCfg =
    PAKISTANI_OUTCOMES.find((o) => o.value === outcome) || PAKISTANI_OUTCOMES[0];

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" />

      <div
        className="relative bg-white border border-[#E2E8F0] rounded-2xl shadow-2xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#105B38]/10 border border-[#105B38]/20 flex items-center justify-center text-[#105B38]">
              <Gavel className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#0F172A]">
                Log Post-Hearing Outcome & Order
              </h2>
              <p className="text-[11px] text-[#64748B]">
                Record Pakistani court proceedings, interim orders, and chain next date
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current Hearing Context */}
        <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-[#0F172A]">{item.title}</span>
            <span className="font-mono text-[10px] text-[#105B38] font-bold">
              {item.date} {item.time ? `• ${item.time}` : ""}
            </span>
          </div>
          {item.caseTitle && (
            <p className="text-[11px] text-[#64748B]">
              Matter: {item.caseTitle}
            </p>
          )}
        </div>

        {/* Outcome Selector */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-mono uppercase text-[#64748B] block font-bold">
            Court Proceeding Outcome / Order *
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {PAKISTANI_OUTCOMES.map((o) => {
              const isSelected = outcome === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setOutcome(o.value)}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    isSelected
                      ? "bg-emerald-50 border-[#105B38] text-[#105B38] ring-1 ring-[#105B38] shadow-xs font-bold"
                      : "bg-white border-[#E2E8F0] text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC] hover:border-[#CBD5E1]"
                  }`}
                >
                  <p className="text-xs font-bold leading-tight">{o.label}</p>
                  <p className="text-[10px] opacity-70 mt-0.5 font-sans">{o.urdu}</p>
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-[#64748B] italic pt-1">
            {selectedOutcomeCfg.description}
          </p>
        </div>

        {/* Next Hearing Chaining Section */}
        <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#105B38]" />
              <h4 className="text-xs font-bold text-[#0F172A]">
                Next Hearing Fixation (Automated Chaining)
              </h4>
            </div>
            <label className="flex items-center gap-1.5 text-[11px] text-[#0F172A] font-mono cursor-pointer">
              <input
                type="checkbox"
                checked={autoChainNextDate}
                onChange={(e) => setAutoChainNextDate(e.target.checked)}
                className="w-3.5 h-3.5 rounded text-[#105B38] accent-[#105B38] bg-white border-[#E2E8F0]"
              />
              <span>Auto-create diary entry</span>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase text-[#64748B] block font-bold">
                Next Hearing Date
              </label>
              <input
                type="date"
                value={nextDate}
                onChange={(e) => setNextDate(e.target.value)}
                className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:border-[#105B38] focus:ring-1 focus:ring-[#105B38] shadow-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase text-[#64748B] block font-bold">
                Next Stage / Fixation Purpose
              </label>
              <input
                type="text"
                placeholder="e.g. For Final Arguments / Written Arguments"
                value={nextStage}
                onChange={(e) => setNextStage(e.target.value)}
                className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#105B38] focus:ring-1 focus:ring-[#105B38] shadow-xs"
              />
            </div>
          </div>
        </div>

        {/* Court Order & Directions Summary */}
        <div className="space-y-1">
          <label className="text-[10px] font-mono uppercase text-[#64748B] block font-bold">
            Order Notes, Judge Directions & Advocate Instructions
          </label>
          <textarea
            placeholder="Summarize the court's verbal remarks, short order, time granted for rejoinder, or documents required before next date..."
            value={orderNotes}
            onChange={(e) => setOrderNotes(e.target.value)}
            rows={3}
            className="w-full bg-white border border-[#E2E8F0] rounded-xl p-3 text-xs text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#105B38] focus:ring-1 focus:ring-[#105B38] resize-none leading-relaxed shadow-xs"
          />
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E2E8F0]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => saveOutcomeMutation.mutate()}
            disabled={saveOutcomeMutation.isPending}
            className="px-5 py-2 rounded-xl bg-[#105B38] hover:bg-[#0D4A2E] text-white font-bold text-xs transition-all disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
          >
            {saveOutcomeMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>Save Outcome & Update Diary</span>
          </button>
        </div>
      </div>
    </div>
  );
};
export default PostHearingOutcomeModal;
