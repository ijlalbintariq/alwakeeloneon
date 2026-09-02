import React, { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  Plus,
  X,
  Loader2,
  Clock,
  Briefcase,
  AlertTriangle,
  Gavel,
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AddDiaryEntryModalProps {
  initialDate?: string;
  onClose: () => void;
}

export const AddDiaryEntryModal: React.FC<AddDiaryEntryModalProps> = ({
  initialDate,
  onClose,
}) => {
  const { toast } = useToast();

  const [title, setTitle] = useState<string>("");
  const [date, setDate] = useState<string>(
    initialDate || new Date().toISOString().slice(0, 10)
  );
  const [time, setTime] = useState<string>("09:30");
  const [caseId, setCaseId] = useState<number | "">("");
  const [priority, setPriority] = useState<"urgent" | "high" | "normal" | "low">("normal");
  const [description, setDescription] = useState<string>("");

  const { data: cases = [] } = useQuery<Array<{ id: number; title: string; caseNumber?: string }>>({
    queryKey: ["/api/case-files"],
  });

  const addEntryMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/diary", {
        title: title.trim(),
        date,
        time: time || undefined,
        caseId: caseId || undefined,
        priority,
        description: description.trim() || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/diary"] });
      toast({
        title: "Hearing Entry Added",
        description: `Scheduled for ${date} at ${time || "09:30 PKT"}.`,
      });
      onClose();
    },
    onError: (err: any) => {
      toast({
        title: "Failed to schedule",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" />

      <div
        className="relative bg-white border border-[#E2E8F0] rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#105B38]/10 border border-[#105B38]/20 flex items-center justify-center text-[#105B38]">
              <CalendarDays className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#0F172A]">
                Schedule Court Hearing / Diary Event
              </h2>
              <p className="text-[11px] text-[#64748B]">
                Asia/Karachi timezone with automated Google Calendar sync
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

        {/* Title */}
        <div className="space-y-1">
          <label className="text-[10px] font-mono uppercase text-[#64748B] block font-bold">
            Hearing Title / Cause List Stage *
          </label>
          <input
            type="text"
            placeholder="e.g. Arguments on Injunction / Evidence of IO"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-xs text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#105B38] focus:ring-1 focus:ring-[#105B38] shadow-xs"
          />
        </div>

        {/* Date & Time */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-mono uppercase text-[#64748B] block font-bold">
              Hearing Date *
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:border-[#105B38] focus:ring-1 focus:ring-[#105B38] shadow-xs"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-mono uppercase text-[#64748B] block font-bold">
              Court Call Time (PKT)
            </label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:border-[#105B38] focus:ring-1 focus:ring-[#105B38] font-mono shadow-xs"
            />
          </div>
        </div>

        {/* Linked Case File & Priority */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-mono uppercase text-[#64748B] block font-bold">
              Link to Case File (Optional)
            </label>
            <select
              value={caseId}
              onChange={(e) => setCaseId(e.target.value ? Number(e.target.value) : "")}
              className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:border-[#105B38] focus:ring-1 focus:ring-[#105B38] shadow-xs"
            >
              <option value="">No case file linked</option>
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.caseNumber ? `[${c.caseNumber}] ` : ""}
                  {c.title}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-mono uppercase text-[#64748B] block font-bold">
              Hearing Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as any)}
              className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:border-[#105B38] focus:ring-1 focus:ring-[#105B38] font-mono shadow-xs"
            >
              <option value="urgent">🚨 Red List / Urgent Motion</option>
              <option value="high">High Priority</option>
              <option value="normal">Normal</option>
              <option value="low">Low Priority</option>
            </select>
          </div>
        </div>

        {/* Description / Instructions */}
        <div className="space-y-1">
          <label className="text-[10px] font-mono uppercase text-[#64748B] block font-bold">
            Chambers Instructions & Court Room Notes
          </label>
          <textarea
            placeholder="e.g. Court #04 LHC before Hon'ble Justice Ali Baqar Najafi. Bring certified copies of stay order."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3.5 py-2 text-xs text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#105B38] focus:ring-1 focus:ring-[#105B38] resize-none shadow-xs"
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E2E8F0]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => addEntryMutation.mutate()}
            disabled={!title.trim() || !date || addEntryMutation.isPending}
            className="px-5 py-2 rounded-xl bg-[#105B38] hover:bg-[#0D4A2E] text-white font-bold text-xs transition-all disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
          >
            {addEntryMutation.isPending && (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            )}
            <span>Add to Diary</span>
          </button>
        </div>
      </div>
    </div>
  );
};
export default AddDiaryEntryModal;
