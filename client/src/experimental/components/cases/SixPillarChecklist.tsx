import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  FileCheck,
  UserCheck,
  FileSignature,
  Scale,
  Plus,
  Loader2,
  Calendar,
  Sparkles,
  Info,
  Check,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export interface ComplianceItem {
  id: number;
  caseId: number;
  type: string;
  pillar?: string | null;
  title: string;
  dueDate: string;
  court?: string | null;
  judge?: string | null;
  status: "pending" | "done" | "missed" | "adjourned" | "verified";
  notes?: string | null;
  documentId?: number | null;
  createdAt?: string;
}

interface SixPillarChecklistProps {
  caseId: number;
  complianceList: ComplianceItem[];
}

export interface PillarDefinition {
  key: string;
  pillarNumber: number;
  title: string;
  urduTitle: string;
  description: string;
  regulatoryBasis: string;
  defaultTitle: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const SIX_PILLARS: PillarDefinition[] = [
  {
    key: "identity",
    pillarNumber: 1,
    title: "Client Identification & CNIC Verification",
    urduTitle: "شناخت اور نادرا شناختی کارڈ تصدیق",
    description: "Verified copy of NADRA CNIC / Passport, biometric or physical verification on record.",
    regulatoryBasis: "Anti-Money Laundering Act 2010 & Bar Council Rules",
    defaultTitle: "NADRA CNIC Verification & Proof of Residence",
    icon: UserCheck,
  },
  {
    key: "letter_of_authority",
    pillarNumber: 2,
    title: "Wakalatnama / Letter of Authority",
    urduTitle: "وکالت نامہ اور مختار نامہ",
    description: "High Court or District Bar Vakalatnama signed, stamped, attested with advocate license number.",
    regulatoryBasis: "Code of Civil Procedure 1908 (Order III, Rule 4) & Legal Practitioners Act",
    defaultTitle: "Wakalatnama High Court / Trial Court Execution",
    icon: FileSignature,
  },
  {
    key: "client_matter_enquiry",
    pillarNumber: 3,
    title: "Client Matter Enquiry & Fact Sheet",
    urduTitle: "مقدمہ انکوائری اور بنیادی حقائق فارم",
    description: "Detailed chronological facts, list of dates & events, opponent details, and intake questionnaire.",
    regulatoryBasis: "Standard Chambers Practice & High Court Rules & Orders (Vol V)",
    defaultTitle: "Client Intake Questionnaire & Facts Chronology",
    icon: FileCheck,
  },
  {
    key: "action_agreed_form",
    pillarNumber: 4,
    title: "Action Agreed Form & Scope of Remedy",
    urduTitle: "متفقہ قانونی لائحہ عمل فارم",
    description: "Formal agreement on chosen legal remedy (Writ / Suit / Bail / Appeal), forum hierarchy & milestones.",
    regulatoryBasis: "Pakistan Bar Council Canons of Professional Conduct (Rule 134)",
    defaultTitle: "Agreed Forum & Remedy Scope Document",
    icon: Scale,
  },
  {
    key: "client_care_letter",
    pillarNumber: 5,
    title: "Client Care Letter & Chambers Terms",
    urduTitle: "کلائنٹ کیئر لیٹر اور فیس شرائط",
    description: "Chambers engagement letter outlining fee schedule, communication terms, and litigation risk notice.",
    regulatoryBasis: "Bar Council Standards & Fee Agreements Protocol",
    defaultTitle: "Chambers Engagement & Client Care Letter",
    icon: ShieldCheck,
  },
  {
    key: "conflict_check",
    pillarNumber: 6,
    title: "Chambers Conflict of Interest Clearance",
    urduTitle: "عدم تصادم مفادات تصدیق",
    description: "Systematic search against chambers active and past client database to verify zero conflict.",
    regulatoryBasis: "Pakistan Bar Council Canons of Professional Conduct (Rule 145)",
    defaultTitle: "Chambers Opponent & Party Conflict Check",
    icon: Sparkles,
  },
];

export const SixPillarChecklist: React.FC<SixPillarChecklistProps> = ({
  caseId,
  complianceList,
}) => {
  const { toast } = useToast();
  const [expandedPillar, setExpandedPillar] = useState<string | null>(null);

  // Toggle compliance item status between done and pending
  const updateStatusMutation = useMutation({
    mutationFn: async ({
      compId,
      status,
    }: {
      compId: number;
      status: "pending" | "done";
    }) => {
      return apiRequest("PATCH", `/api/case-files/${caseId}/compliance/${compId}`, {
        status,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/case-files/${caseId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/case-files"] });
      toast({ title: "Compliance Status Updated" });
    },
    onError: (err: any) => {
      toast({
        title: "Failed to update compliance status",
        description: err?.message || "Could not update status.",
        variant: "destructive",
      });
    },
  });

  // Create compliance item
  const createComplianceMutation = useMutation({
    mutationFn: async ({
      type,
      title,
      dueDate,
      status,
    }: {
      type: string;
      title: string;
      dueDate: string;
      status?: "pending" | "done";
    }) => {
      return apiRequest("POST", `/api/case-files/${caseId}/compliance`, {
        type,
        title,
        dueDate,
        status: status || "pending",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/case-files/${caseId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/case-files"] });
      toast({ title: "Compliance Check Initialized" });
    },
    onError: (err: any) => {
      toast({
        title: "Failed to initialize compliance check",
        description: err?.message || "Could not initialize compliance checkpoint.",
        variant: "destructive",
      });
    },
  });

  // Initialize all missing pillars with 1 click
  const initializeAllPillarsMutation = useMutation({
    mutationFn: async () => {
      const existingTypes = new Set(complianceList.map((c) => c.type));
      const today = new Date().toISOString().slice(0, 10);
      const missing = SIX_PILLARS.filter((p) => !existingTypes.has(p.key));

      for (const pillar of missing) {
        await apiRequest("POST", `/api/case-files/${caseId}/compliance`, {
          type: pillar.key,
          title: pillar.defaultTitle,
          dueDate: today,
          status: "pending",
        });
      }
      return missing.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: [`/api/case-files/${caseId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/case-files"] });
      toast({
        title: "6-Pillars Initialized",
        description: `Added ${count} compliance checkpoints.`,
      });
    },
    onError: (err: any) => {
      toast({
        title: "Failed to initialize 6-pillars",
        description: err?.message || "Could not initialize all compliance checkpoints.",
        variant: "destructive",
      });
    },
  });

  // Calculate 6-pillar stats
  const pillarStatusMap = SIX_PILLARS.map((p) => {
    const matched = complianceList.find((c) => c.type === p.key || c.pillar?.toLowerCase().includes(p.key));
    const isDone = matched?.status === "done" || matched?.status === "verified";
    return {
      pillar: p,
      item: matched || null,
      isDone: !!isDone,
      isExists: !!matched,
    };
  });

  const verifiedCount = pillarStatusMap.filter((p) => p.isDone).length;
  const compliancePercentage = Math.round((verifiedCount / 6) * 100);

  return (
    <div className="space-y-6">
      {/* 1. Header & Segmented Compliance Meter */}
      <div className="p-5 rounded-2xl bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#105B38]" />
              <h2 className="text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                6-Pillar Matter Compliance Architecture
              </h2>
            </div>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">
              Mandatory procedural safeguards and client care protocol for Pakistani legal practice.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-xl font-bold font-mono text-[#0F172A] dark:text-[#F8FAFC]">
                {compliancePercentage}%
              </span>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">
                {verifiedCount} of 6 Verified
              </p>
            </div>

            {verifiedCount < 6 && (
              <button
                type="button"
                onClick={() => initializeAllPillarsMutation.mutate()}
                disabled={initializeAllPillarsMutation.isPending}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#105B38] hover:bg-[#0D4A2E] text-white text-xs font-bold transition-all shadow-xs disabled:opacity-50"
              >
                {initializeAllPillarsMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                <span>Auto-Setup 6 Pillars</span>
              </button>
            )}
          </div>
        </div>

        {/* Segmented 6-Block Progress Bar with Tick Marks & Labels */}
        <div className="space-y-2 pt-2 border-t border-[#E2E8F0] dark:border-[#1E2D44]">
          <div className="grid grid-cols-6 gap-1.5">
            {pillarStatusMap.map(({ pillar, isDone }, idx) => (
              <div key={pillar.key} className="space-y-1">
                <div
                  className={cn(
                    "h-2 rounded-full transition-all duration-300",
                    isDone
                      ? "bg-[#105B38]"
                      : "bg-[#E2E8F0]"
                  )}
                  title={`Pillar ${idx + 1}: ${pillar.title} (${isDone ? "Verified" : "Pending"})`}
                />
                <p className="text-[11px] font-mono text-center truncate text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">
                  P{idx + 1}
                </p>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] pt-1">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#105B38]" />
              <span>Verified ({verifiedCount})</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#E2E8F0]" />
              <span>Pending ({6 - verifiedCount})</span>
            </span>
          </div>
        </div>
      </div>

      {/* 2. The 6 Pillars Interactive Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {pillarStatusMap.map(({ pillar, item, isDone, isExists }) => {
          const Icon = pillar.icon;
          const isExpanded = expandedPillar === pillar.key;

          return (
            <div
              key={pillar.key}
              className={cn(
                "rounded-2xl border transition-all p-4 space-y-3",
                isDone
                  ? "bg-white dark:bg-[#131E2E] border-[#E2E8F0] dark:border-[#1E2D44] shadow-xs"
                  : isExists
                  ? "bg-white dark:bg-[#131E2E] border-amber-200 dark:border-amber-500/20 shadow-xs"
                  : "bg-[#F8FAFC] dark:bg-[#0B131E] border-[#E2E8F0] dark:border-[#1E2D44]"
              )}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5">
                  <div
                    className={cn(
                      "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border",
                      isDone
                        ? "bg-emerald-50 dark:bg-emerald-500/10 text-[#105B38] border-emerald-200 dark:border-emerald-500/20"
                        : isExists
                        ? "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20"
                        : "bg-white dark:bg-[#131E2E] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] border-[#E2E8F0] dark:border-[#1E2D44]"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-[#105B38]">
                        Pillar #{pillar.pillarNumber}
                      </span>
                      <span className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">
                        {pillar.urduTitle}
                      </span>
                    </div>
                    <h3 className="text-xs sm:text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC] mt-0.5">
                      {pillar.title}
                    </h3>
                  </div>
                </div>

                {/* Status Toggle Button */}
                <div className="shrink-0">
                  {isDone ? (
                    <button
                      type="button"
                      onClick={() =>
                        item &&
                        updateStatusMutation.mutate({
                          compId: item.id,
                          status: "pending",
                        })
                      }
                      title="Click to mark pending"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-[#105B38] border border-emerald-200 dark:border-emerald-500/20 text-xs font-bold hover:bg-emerald-100 transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Verified</span>
                    </button>
                  ) : isExists ? (
                    <button
                      type="button"
                      onClick={() =>
                        item &&
                        updateStatusMutation.mutate({
                          compId: item.id,
                          status: "done",
                        })
                      }
                      title="Click to mark verified"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 text-xs font-bold hover:bg-amber-100 transition-colors"
                    >
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>Pending</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        createComplianceMutation.mutate({
                          type: pillar.key,
                          title: pillar.defaultTitle,
                          dueDate: new Date().toISOString().slice(0, 10),
                          status: "done",
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#131E2E] hover:bg-[#F8FAFC] dark:bg-[#0B131E] text-[#0F172A] dark:text-[#F8FAFC] border border-[#E2E8F0] dark:border-[#1E2D44] text-xs font-bold transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Initialize</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Description */}
              <p className="text-xs text-[#334155] dark:text-[#CBD5E1] leading-relaxed">
                {pillar.description}
              </p>

              {/* Regulatory Basis & Details Toggle */}
              <div className="pt-2 border-t border-[#E2E8F0] dark:border-[#1E2D44] flex items-center justify-between text-xs">
                <span className="text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] truncate max-w-[240px]">
                  Basis: {pillar.regulatoryBasis}
                </span>
                <button
                  type="button"
                  onClick={() => setExpandedPillar(isExpanded ? null : pillar.key)}
                  className="text-[#105B38] font-semibold hover:underline flex items-center gap-0.5"
                >
                  <span>{isExpanded ? "Less" : "Details"}</span>
                  {isExpanded ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="pt-2.5 space-y-2 text-xs bg-[#F8FAFC] dark:bg-[#0B131E] p-3 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D44]">
                  <div className="flex items-center justify-between">
                    <span className="text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">Record Title:</span>
                    <span className="font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                      {item?.title || pillar.defaultTitle}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">Regulatory Authority:</span>
                    <span className="text-[#334155] dark:text-[#CBD5E1] font-mono text-[11px]">
                      {pillar.regulatoryBasis}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SixPillarChecklist;
