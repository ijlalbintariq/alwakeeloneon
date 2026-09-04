import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Briefcase,
  Plus,
  X,
  Loader2,
  Scale,
  ShieldCheck,
  Building,
  Hash,
  AlertTriangle,
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { SIX_PILLARS } from "./SixPillarChecklist";
import { cn } from "@/lib/utils";

interface CreateCaseModalProps {
  onClose: () => void;
  onCreated?: (caseId: number) => void;
}

const CASE_TYPES = [
  { value: "constitutional", label: "Constitutional (Writ / Human Rights)" },
  { value: "criminal", label: "Criminal (Bail / Trial / Appeal)" },
  { value: "civil", label: "Civil (Suit / Injunction / Execution)" },
  { value: "corporate", label: "Corporate / Commercial / Company" },
  { value: "tax", label: "Tax & Customs (FBR / Appellate Tribunal)" },
  { value: "banking", label: "Banking & Financial Recovery" },
  { value: "family", label: "Family & Guardianship" },
  { value: "labor", label: "Labor & Service Law" },
  { value: "property", label: "Property & Revenue / Tenancy" },
  { value: "other", label: "Other Legal Matter" },
];

const PAKISTANI_COURTS = [
  "Supreme Court of Pakistan, Islamabad",
  "Supreme Court Branch Registry, Lahore",
  "Supreme Court Branch Registry, Karachi",
  "Lahore High Court, Principal Seat",
  "Lahore High Court, Rawalpindi Bench",
  "Lahore High Court, Multan Bench",
  "Islamabad High Court, Islamabad",
  "Sindh High Court, Principal Seat Karachi",
  "Peshawar High Court, Peshawar",
  "High Court of Balochistan, Quetta",
  "District & Sessions Court, Lahore",
  "District & Sessions Court, Islamabad",
  "Special Court (Anti-Terrorism)",
  "Banking Court / NAB Court",
  "Civil Court / Family Court",
];

export const CreateCaseModal: React.FC<CreateCaseModalProps> = ({
  onClose,
  onCreated,
}) => {
  const { toast } = useToast();

  const [title, setTitle] = useState<string>("");
  const [caseType, setCaseType] = useState<string>("constitutional");
  const [court, setCourt] = useState<string>("");
  const [caseNumber, setCaseNumber] = useState<string>("");
  const [referenceNo, setReferenceNo] = useState<string>("");
  const [priority, setPriority] = useState<string>("normal");
  const [description, setDescription] = useState<string>("");
  const [initSixPillars, setInitSixPillars] = useState<boolean>(true);

  const createCaseMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/case-files", {
        title: title.trim(),
        caseType,
        court: court.trim() || undefined,
        caseNumber: caseNumber.trim() || undefined,
        referenceNo: referenceNo.trim() || undefined,
        priority,
        description: description.trim() || undefined,
      });
      const createdCase = await res.json();

      // Initialize 6 pillars if requested
      if (initSixPillars && createdCase?.id) {
        const today = new Date().toISOString().slice(0, 10);
        for (const pillar of SIX_PILLARS) {
          try {
            await apiRequest("POST", `/api/case-files/${createdCase.id}/compliance`, {
              type: pillar.key,
              title: pillar.defaultTitle,
              dueDate: today,
              status: "pending",
            });
          } catch (e) {
            console.error("Error auto-initializing pillar:", e);
          }
        }
      }

      return createdCase;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/case-files"] });
      toast({
        title: "Case Dossier Created",
        description: `Matter opened successfully${initSixPillars ? " with 6-Pillar Compliance." : "."}`,
      });
      if (data?.id && onCreated) {
        onCreated(data.id);
      }
      onClose();
    },
    onError: (err: any) => {
      toast({
        title: "Failed to open case file",
        description: err?.message || "An error occurred while creating the case file.",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#131E2E] rounded-2xl border border-[#E2E8F0] dark:border-[#1E2D44] shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0] dark:border-[#1E2D44]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center text-[#105B38]">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                Open New Litigation Case File
              </h2>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">
                Pakistani Legal Matter Architecture with 6-Pillar Compliance
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F8FAFC] dark:bg-[#0B131E] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Title */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] block">
            Case Title / Parties Heading *
          </label>
          <input
            type="text"
            placeholder="e.g. Tariq Mahmood vs. Federation of Pakistan & Others"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] rounded-xl px-3.5 py-2.5 text-xs text-[#0F172A] dark:text-[#F8FAFC] placeholder:text-[#94A3B8] dark:text-[#475569] outline-none focus:border-[#105B38] focus:bg-white dark:bg-[#131E2E] transition-all"
          />
        </div>

        {/* Grid: Case Type & Priority */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] block">
              Jurisdiction / Matter Type
            </label>
            <select
              value={caseType}
              onChange={(e) => setCaseType(e.target.value)}
              className="w-full bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] rounded-xl px-3 py-2.5 text-xs text-[#0F172A] dark:text-[#F8FAFC] outline-none focus:border-[#105B38] focus:bg-white dark:bg-[#131E2E] transition-all"
            >
              {CASE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] block">
              Chambers Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] rounded-xl px-3 py-2.5 text-xs text-[#0F172A] dark:text-[#F8FAFC] outline-none focus:border-[#105B38] focus:bg-white dark:bg-[#131E2E] transition-all"
            >
              <option value="urgent">🚨 Urgent (Red List / Injunction Hearing)</option>
              <option value="high">High Priority</option>
              <option value="normal">Normal</option>
              <option value="low">Low Priority</option>
            </select>
          </div>
        </div>

        {/* Court / Forum */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] block">
            Judicial Forum / Court
          </label>
          <input
            type="text"
            placeholder="e.g. Lahore High Court, Principal Seat"
            value={court}
            onChange={(e) => setCourt(e.target.value)}
            list="courts-list"
            className="w-full bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] rounded-xl px-3.5 py-2.5 text-xs text-[#0F172A] dark:text-[#F8FAFC] placeholder:text-[#94A3B8] dark:text-[#475569] outline-none focus:border-[#105B38] focus:bg-white dark:bg-[#131E2E] transition-all"
          />
          <datalist id="courts-list">
            {PAKISTANI_COURTS.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>

        {/* Grid: Case No & Reference */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] block">
              Court Case / Writ Number
            </label>
            <input
              type="text"
              placeholder="e.g. W.P. No. 4921/2024"
              value={caseNumber}
              onChange={(e) => setCaseNumber(e.target.value)}
              className="w-full bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] rounded-xl px-3 py-2.5 text-xs font-mono text-[#0F172A] dark:text-[#F8FAFC] placeholder:text-[#94A3B8] dark:text-[#475569] outline-none focus:border-[#105B38] focus:bg-white dark:bg-[#131E2E] transition-all"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] block">
              Chambers Internal Ref #
            </label>
            <input
              type="text"
              placeholder="e.g. CH-2024-089"
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
              className="w-full bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] rounded-xl px-3 py-2.5 text-xs font-mono text-[#0F172A] dark:text-[#F8FAFC] placeholder:text-[#94A3B8] dark:text-[#475569] outline-none focus:border-[#105B38] focus:bg-white dark:bg-[#131E2E] transition-all"
            />
          </div>
        </div>

        {/* Description / Summary */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] block">
            Matter Summary / Prayer Relief
          </label>
          <textarea
            placeholder="Brief statement of grievance, impugned order, and legal relief sought..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] rounded-xl px-3.5 py-2.5 text-xs text-[#0F172A] dark:text-[#F8FAFC] placeholder:text-[#94A3B8] dark:text-[#475569] outline-none focus:border-[#105B38] focus:bg-white dark:bg-[#131E2E] resize-none transition-all"
          />
        </div>

        {/* 6-Pillars Toggle */}
        <div className="p-3.5 rounded-2xl bg-emerald-50/5 dark:bg-emerald-500/100 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-[#105B38] shrink-0" />
            <div>
              <p className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                Setup 6-Pillar Compliance Framework
              </p>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">
                Auto-creates CNIC, Wakalatnama, Enquiry, Action Agreed, Care Letter & Conflict Check
              </p>
            </div>
          </div>
          <input
            type="checkbox"
            checked={initSixPillars}
            onChange={(e) => setInitSixPillars(e.target.checked)}
            className="w-4 h-4 rounded text-[#105B38] accent-[#105B38] cursor-pointer"
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#E2E8F0] dark:border-[#1E2D44]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F8FAFC] dark:bg-[#0B131E] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => createCaseMutation.mutate()}
            disabled={!title.trim() || createCaseMutation.isPending}
            className="px-5 py-2 rounded-xl bg-[#105B38] hover:bg-[#0D4A2E] text-white font-bold text-xs transition-colors shadow-xs disabled:opacity-50 flex items-center gap-1.5"
          >
            {createCaseMutation.isPending && (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            )}
            <span>Open Case File</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateCaseModal;
