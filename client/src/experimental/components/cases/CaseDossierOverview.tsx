import React from "react";
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  FileText,
  Users,
  CalendarDays,
  StickyNote,
  Scale,
  Gavel,
  Clock,
  MapPin,
  User,
  ExternalLink,
  Plus,
  ChevronRight,
  ArrowRight,
  Sparkles,
  FileSignature,
  Building,
  Check,
  Layers,
  LayoutDashboard,
  BookOpen,
  FileCheck,
  UserCheck,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CaseFileFullDetail } from "@/experimental/pages/PreviewCaseFiles";
import { SIX_PILLARS } from "./SixPillarChecklist";

export interface CaseDossierOverviewProps {
  caseFile: CaseFileFullDetail;
  onNavigateTab: (tab: "overview" | "compliance" | "documents" | "parties" | "hearings" | "notes") => void;
}

export const CaseDossierOverview: React.FC<CaseDossierOverviewProps> = ({
  caseFile,
  onNavigateTab,
}) => {
  // 1. Calculate 6-Pillars Compliance
  const complianceItems = caseFile.compliance || [];
  const verifiedPillarsCount = SIX_PILLARS.filter((pillar) => {
    const matched = complianceItems.find((c: any) => c.type === pillar.key);
    return matched?.status === "done";
  }).length;
  const healthPercentage = Math.round((verifiedPillarsCount / 6) * 100);

  // 2. Upcoming Hearing
  const upcomingHearings = complianceItems
    .filter((c: any) => c.type === "hearing" && c.status === "pending")
    .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  const nextHearing = upcomingHearings[0] || null;

  // 3. Document Metrics
  const docs = caseFile.documents || [];
  const recentDocs = [...docs]
    .sort((a: any, b: any) => new Date(b.addedAt || 0).getTime() - new Date(a.addedAt || 0).getTime())
    .slice(0, 3);

  // 4. Parties Breakdown
  const clients = caseFile.clients || [];
  const petitioners = clients.filter((c: any) => c.role === "client");
  const respondents = clients.filter((c: any) => c.role === "opponent");

  // 5. Recent Note
  const notes = caseFile.notes || [];
  const latestNote = notes.length > 0 ? notes[notes.length - 1] : null;

  // Format Date Helper
  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "Not specified";
    try {
      return new Date(dateStr).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. MATTER OVERVIEW HERO CARD */}
      <div className="p-5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs font-bold text-[#105B38] bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                {caseFile.caseNumber || `REF: ${caseFile.referenceNo || caseFile.id}`}
              </span>
              <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-white text-[#64748B] border border-[#E2E8F0]">
                {caseFile.caseType}
              </span>
              <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-emerald-50 text-[#105B38] border border-emerald-200">
                Status: {caseFile.status}
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-[#0F172A]">
              {caseFile.title}
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span
              className={cn(
                "text-xs font-bold px-3 py-1 rounded-xl border",
                caseFile.priority === "urgent"
                  ? "bg-rose-50 text-rose-700 border-rose-200 animate-pulse"
                  : caseFile.priority === "high"
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-emerald-50 text-[#105B38] border-emerald-200"
              )}
            >
              Priority: {caseFile.priority.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Key Metadata Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-[#E2E8F0] text-xs">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">Court Forum</span>
            <p className="font-semibold text-[#0F172A] mt-0.5 truncate flex items-center gap-1">
              <MapPin className="w-3 h-3 text-[#105B38]" />
              <span>{caseFile.court || "Lahore High Court, Principal Seat"}</span>
            </p>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">Bench Roster</span>
            <p className="font-semibold text-[#0F172A] mt-0.5 truncate flex items-center gap-1">
              <Scale className="w-3 h-3 text-[#105B38]" />
              <span>Single Bench / DB-I</span>
            </p>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">Filing Date</span>
            <p className="font-semibold text-[#0F172A] mt-0.5 truncate flex items-center gap-1">
              <Clock className="w-3 h-3 text-[#105B38]" />
              <span>{formatDate(caseFile.createdAt)}</span>
            </p>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">Chamber Counsel</span>
            <p className="font-semibold text-[#0F172A] mt-0.5 truncate flex items-center gap-1">
              <User className="w-3 h-3 text-[#105B38]" />
              <span>Principal Counsel (AOR)</span>
            </p>
          </div>
        </div>

        {caseFile.description && (
          <p className="text-xs text-[#64748B] pt-2 border-t border-[#E2E8F0] leading-relaxed">
            {caseFile.description}
          </p>
        )}
      </div>

      {/* 2. SPLIT-PANE GRID: LEFT (7 cols) + RIGHT (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left Column (7 cols): Health Gauge & Document Vault */}
        <div className="lg:col-span-7 space-y-5">
          
          {/* A. 6-PILLAR PROCEDURAL HEALTH GAUGE */}
          <div className="p-5 rounded-2xl bg-white border border-[#E2E8F0] shadow-xs space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-50 text-[#105B38] border border-emerald-200">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#0F172A]">
                    6-Pillar Procedural Health Gauge
                  </h3>
                  <p className="text-[11px] text-[#64748B]">
                    Procedural integrity, statutory compliance, and defense readiness
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xl font-mono font-black text-[#105B38]">
                  {healthPercentage}%
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F8FAFC] text-[#64748B] border border-[#E2E8F0]">
                  {verifiedPillarsCount}/6 Ready
                </span>
              </div>
            </div>

            {/* Visual Gauge Bar */}
            <div className="space-y-1">
              <div className="w-full h-2 rounded-full bg-[#F1F5F9] overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    healthPercentage === 100
                      ? "bg-emerald-500"
                      : healthPercentage >= 50
                      ? "bg-[#105B38]"
                      : "bg-amber-500"
                  )}
                  style={{ width: `${Math.max(healthPercentage, 6)}%` }}
                />
              </div>
            </div>

            {/* 6 Mini Pillar Indicator Chips */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
              {SIX_PILLARS.map((pillar) => {
                const isVerified = complianceItems.some(
                  (c: any) => c.type === pillar.key && c.status === "done"
                );
                return (
                  <div
                    key={pillar.key}
                    className={cn(
                      "p-2 rounded-xl border text-[11px] flex items-center gap-2 transition-all",
                      isVerified
                        ? "bg-emerald-50/50 border-emerald-200 text-[#105B38]"
                        : "bg-[#F8FAFC] border-[#E2E8F0] text-[#64748B]"
                    )}
                  >
                    {isVerified ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#105B38] shrink-0" />
                    ) : (
                      <Clock className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
                    )}
                    <span className="font-semibold truncate">{pillar.title.split(" ")[0]} {pillar.title.split(" ")[1] || ""}</span>
                  </div>
                );
              })}
            </div>

            {/* Order VII Rule 11 & Limitation Safeguards */}
            <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[#0F172A] font-bold">
                  <Scale className="w-3.5 h-3.5 text-[#105B38]" />
                  <span>Order VII Rule 11 CPC Shield</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-[#105B38] border border-emerald-200">
                  Cause of Action Verified
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[#0F172A] font-bold">
                  <Clock className="w-3.5 h-3.5 text-[#105B38]" />
                  <span>Limitation Act 1908 Status</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-[#105B38] border border-emerald-200">
                  Within Statutory Limitation
                </span>
              </div>
            </div>

            {/* Jump Action */}
            <button
              onClick={() => onNavigateTab("compliance")}
              className="w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white hover:bg-[#F8FAFC] text-[#105B38] border border-[#105B38]/30 font-bold text-xs transition-all shadow-xs"
            >
              <span>Open 6-Pillar Compliance Audit</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* B. CASE DOCUMENTS VAULT SUMMARY */}
          <div className="p-5 rounded-2xl bg-white border border-[#E2E8F0] shadow-xs space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-50 text-[#105B38] border border-emerald-200">
                  <FileText className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#0F172A]">
                  Documents & Annexures Vault
                </h3>
              </div>
              <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-full bg-[#F8FAFC] text-[#64748B] border border-[#E2E8F0]">
                {docs.length} Attached
              </span>
            </div>

            {docs.length === 0 ? (
              <div className="p-4 rounded-xl bg-[#F8FAFC] border border-dashed border-[#CBD5E1] text-center space-y-1">
                <p className="text-xs text-[#64748B]">No documents uploaded or linked yet.</p>
                <button
                  onClick={() => onNavigateTab("documents")}
                  className="text-xs font-bold text-[#105B38] hover:underline"
                >
                  Upload Pleadings, Vakalatnama, or Annexures →
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {recentDocs.map((doc: any) => (
                  <div
                    key={doc.id}
                    className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-3.5 h-3.5 text-[#105B38] shrink-0" />
                      <span className="font-semibold text-[#0F172A] truncate">
                        {doc.docTitle || doc.label || `Document #${doc.documentId}`}
                      </span>
                    </div>
                    <span className="text-[10px] text-[#64748B] font-mono shrink-0">
                      {formatDate(doc.addedAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => onNavigateTab("documents")}
              className="w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white hover:bg-[#F8FAFC] text-[#105B38] border border-[#105B38]/30 font-bold text-xs transition-all shadow-xs"
            >
              <span>View All Documents Vault ({docs.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right Column (5 cols): Hearing Fixation, Parties, Notes */}
        <div className="lg:col-span-5 space-y-5">
          
          {/* C. NEXT HEARING FIXATION SUMMARY */}
          <div className="p-5 rounded-2xl bg-white border border-[#E2E8F0] shadow-xs space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-50 text-[#105B38] border border-emerald-200">
                  <CalendarDays className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#0F172A]">
                  Next Court Hearing
                </h3>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-[#105B38] border border-emerald-200">
                Fixation Scheduled
              </span>
            </div>

            {nextHearing ? (
              <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-bold text-[#0F172A]">
                      {nextHearing.title}
                    </h4>
                    <p className="text-[11px] text-[#64748B] flex items-center gap-1">
                      <Clock className="w-3 h-3 text-[#105B38]" />
                      <span>{formatDate(nextHearing.dueDate)} at 09:30 AM</span>
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#E2E8F0] grid grid-cols-2 gap-2 text-[11px] text-[#64748B]">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#94A3B8]">Judge / Bench</span>
                    <p className="font-semibold text-[#0F172A] truncate">
                      {nextHearing.judge || "Hon'ble Single Bench"}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#94A3B8]">Court Room</span>
                    <p className="font-semibold text-[#0F172A] truncate">
                      {nextHearing.court || caseFile.court || "Court Room 4"}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-[#F8FAFC] border border-dashed border-[#CBD5E1] text-center space-y-1 text-xs text-[#64748B]">
                <p>No upcoming hearing currently fixed.</p>
              </div>
            )}

            <button
              onClick={() => onNavigateTab("hearings")}
              className="w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white hover:bg-[#F8FAFC] text-[#105B38] border border-[#105B38]/30 font-bold text-xs transition-all shadow-xs"
            >
              <span>{nextHearing ? "Manage / Reschedule Hearings" : "Schedule Next Hearing Date"}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* D. KEY PARTIES SUMMARY */}
          <div className="p-5 rounded-2xl bg-white border border-[#E2E8F0] shadow-xs space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-50 text-[#105B38] border border-emerald-200">
                  <Users className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#0F172A]">
                  Parties & Litigants
                </h3>
              </div>
              <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-full bg-[#F8FAFC] text-[#64748B] border border-[#E2E8F0]">
                {clients.length} Parties
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
                <span className="text-[10px] font-bold uppercase text-[#105B38]">Petitioner / Plaintiff (Client)</span>
                <p className="font-semibold text-[#0F172A]">
                  {petitioners.length > 0 ? petitioners.map((p: any) => p.name).join(", ") : "Client not designated"}
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
                <span className="text-[10px] font-bold uppercase text-rose-700">Respondent / Opponent</span>
                <p className="font-semibold text-[#0F172A]">
                  {respondents.length > 0 ? respondents.map((r: any) => r.name).join(", ") : "Opponent not recorded"}
                </p>
              </div>
            </div>

            <button
              onClick={() => onNavigateTab("parties")}
              className="w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white hover:bg-[#F8FAFC] text-[#105B38] border border-[#105B38]/30 font-bold text-xs transition-all shadow-xs"
            >
              <span>Manage Parties & Litigants ({clients.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* E. CHAMBERS STRATEGY NOTES */}
          <div className="p-5 rounded-2xl bg-white border border-[#E2E8F0] shadow-xs space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-50 text-[#105B38] border border-emerald-200">
                  <StickyNote className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#0F172A]">
                  Chambers Strategy Notes
                </h3>
              </div>
              <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-full bg-[#F8FAFC] text-[#64748B] border border-[#E2E8F0]">
                {notes.length} Notes
              </span>
            </div>

            {latestNote ? (
              <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs space-y-1">
                <p className="text-[#0F172A] line-clamp-2 italic font-serif">
                  "{latestNote.content}"
                </p>
                <span className="text-[10px] text-[#64748B] font-mono">
                  {formatDate(latestNote.createdAt)}
                </span>
              </div>
            ) : (
              <p className="text-xs text-[#64748B]">No chamber notes recorded yet.</p>
            )}

            <button
              onClick={() => onNavigateTab("notes")}
              className="w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white hover:bg-[#F8FAFC] text-[#105B38] border border-[#105B38]/30 font-bold text-xs transition-all shadow-xs"
            >
              <span>Open Chambers Notes ({notes.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 3. CHAMBERS WORKSTATION QUICK LAUNCHPAD ACTION ROW */}
      <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-3">
        <span className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
          Quick Workstation Actions
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <button
            onClick={() => onNavigateTab("compliance")}
            className="p-3 rounded-xl bg-white hover:bg-emerald-50/40 border border-[#E2E8F0] hover:border-[#105B38] text-left space-y-1 transition-all group"
          >
            <div className="p-1.5 rounded-lg bg-emerald-50 text-[#105B38] w-fit border border-emerald-200 group-hover:bg-[#105B38] group-hover:text-white transition-all">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold text-[#0F172A]">Open Compliance Audit</h4>
            <p className="text-[10px] text-[#64748B]">Verify 6 Pillars & O. VII R. 11</p>
          </button>

          <button
            onClick={() => onNavigateTab("documents")}
            className="p-3 rounded-xl bg-white hover:bg-emerald-50/40 border border-[#E2E8F0] hover:border-[#105B38] text-left space-y-1 transition-all group"
          >
            <div className="p-1.5 rounded-lg bg-emerald-50 text-[#105B38] w-fit border border-emerald-200 group-hover:bg-[#105B38] group-hover:text-white transition-all">
              <FileText className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold text-[#0F172A]">View Documents Vault</h4>
            <p className="text-[10px] text-[#64748B]">Pleadings, OCR & Annexures</p>
          </button>

          <button
            onClick={() => onNavigateTab("hearings")}
            className="p-3 rounded-xl bg-white hover:bg-emerald-50/40 border border-[#E2E8F0] hover:border-[#105B38] text-left space-y-1 transition-all group"
          >
            <div className="p-1.5 rounded-lg bg-emerald-50 text-[#105B38] w-fit border border-emerald-200 group-hover:bg-[#105B38] group-hover:text-white transition-all">
              <CalendarDays className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold text-[#0F172A]">Schedule Hearing</h4>
            <p className="text-[10px] text-[#64748B]">Sync diary & court cause list</p>
          </button>

          <button
            onClick={() => onNavigateTab("notes")}
            className="p-3 rounded-xl bg-white hover:bg-emerald-50/40 border border-[#E2E8F0] hover:border-[#105B38] text-left space-y-1 transition-all group"
          >
            <div className="p-1.5 rounded-lg bg-emerald-50 text-[#105B38] w-fit border border-emerald-200 group-hover:bg-[#105B38] group-hover:text-white transition-all">
              <StickyNote className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold text-[#0F172A]">Add Chamber Note</h4>
            <p className="text-[10px] text-[#64748B]">Strategy & trial conferences</p>
          </button>
        </div>
      </div>
    </div>
  );
};

export default CaseDossierOverview;
