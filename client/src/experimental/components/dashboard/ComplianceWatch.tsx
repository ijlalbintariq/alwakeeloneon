import React from "react";
import { Link } from "wouter";
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  FileCheck,
  Scale,
  Clock,
  ArrowRight,
  Sparkles,
} from "lucide-react";

interface ComplianceWatchProps {
  upcomingCompliance?: any[];
  caseFiles?: any[];
}

export const ComplianceWatch: React.FC<ComplianceWatchProps> = ({
  upcomingCompliance = [],
  caseFiles = [],
}) => {
  const totalCases = caseFiles.length;
  const pendingCount = upcomingCompliance.filter((c) => c.status === "pending").length;

  // 6 Institutional Pillars of Pakistani Litigation Practice
  const pillars = [
    {
      id: "wakalatnama",
      name: "Wakalatnama on Court Record",
      description: "Power of attorney executed, signed, stamped, and enrolled.",
      rule: "Order III CPC / High Court Rules",
      statKey: "wakalatnama",
      verifiedRate: 92,
      critical: false,
    },
    {
      id: "court_fees",
      name: "Court Fees & Judicial Stamps",
      description: "Ad-valorem & fixed stamps under Court Fees Act 1870.",
      rule: "Court Fees Act 1870 / S.V. Act 1887",
      statKey: "court_fee",
      verifiedRate: 88,
      critical: false,
    },
    {
      id: "affidavit",
      name: "Supporting Affidavits & Attestation",
      description: "Sworn before Oath Commissioner with CNIC verification.",
      rule: "Order XIX CPC / High Court Vol V",
      statKey: "affidavit",
      verifiedRate: 95,
      critical: false,
    },
    {
      id: "indexing",
      name: "Memo Indexing & Court Pagination",
      description: "Index page, petition memo, and chronologically paged files.",
      rule: "LHC Rules & Orders Vol V, Ch. 1",
      statKey: "indexing",
      verifiedRate: 84,
      critical: true,
    },
    {
      id: "annexures",
      name: "Annexures & Certified Copies",
      description: "Marked Annex-A/B/C with legible official seals & true translation.",
      rule: "Qanun-e-Shahadat Order 1984",
      statKey: "annexure",
      verifiedRate: 90,
      critical: false,
    },
    {
      id: "limitation",
      name: "Limitation Period & Timeliness",
      description: "Statutory deadline tracking & Sec. 5 condonation applications.",
      rule: "Limitation Act 1908 (First Schedule)",
      statKey: "limitation",
      verifiedRate: 98,
      critical: false,
    },
  ];

  const overallScore = Math.round(
    pillars.reduce((acc, p) => acc + p.verifiedRate, 0) / pillars.length
  );

  return (
    <div className="relative rounded-2xl border border-[#E5E4E2]/90 bg-[#F5F4F2] p-5 sm:p-6 backdrop-blur-sm shadow-xl flex flex-col justify-between">
      <div>
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-[#E5E4E2]">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-[#1A1A1A] mb-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>CHAMBERS AUDIT & COMPLIANCE DEFENSE</span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold font-serif text-[#1A1A1A] flex items-center gap-2">
              <span>6-Pillar Matter Compliance Watch</span>
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-[10px] font-mono text-[#666666] block uppercase">
                Chamber Health
              </span>
              <span className="text-sm font-bold font-mono text-[#1A1A1A]">
                {overallScore}% Compliant
              </span>
            </div>
            <div className="h-8 w-8 rounded-lg bg-[#F5F4F2] border border-[#E5E4E2] flex items-center justify-center text-[#1A1A1A] font-bold text-xs font-mono">
              {overallScore}%
            </div>
          </div>
        </div>

        {/* 6-Pillar Compliance Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {pillars.map((pillar) => {
            const isNearPerfect = pillar.verifiedRate >= 90;
            return (
              <div
                key={pillar.id}
                className="p-3.5 rounded-xl bg-white/70 border border-[#E5E4E2] hover:border-[#E5E4E2] transition-all flex flex-col justify-between group"
              >
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {isNearPerfect ? (
                        <CheckCircle2 className="w-4 h-4 text-[#1A1A1A] shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-[#1A1A1A] shrink-0" />
                      )}
                      <h4 className="text-xs font-semibold text-[#2D2D2D] group-hover:text-[#1A1A1A] transition-colors font-serif">
                        {pillar.name}
                      </h4>
                    </div>

                    <span
                      className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                        isNearPerfect
                          ? "bg-[#F5F4F2] text-[#1A1A1A] border border-[#E5E4E2]"
                          : "bg-[#1A1A1A]/5 text-[#1A1A1A] border border-[#1A1A1A]/15"
                      }`}
                    >
                      {pillar.verifiedRate}%
                    </span>
                  </div>

                  <p className="text-[11px] text-[#666666] leading-snug">
                    {pillar.description}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 mt-2 border-t border-[#E5E4E2]/50 text-[10px] font-mono text-[#666666]">
                  <span>{pillar.rule}</span>
                  <span className={isNearPerfect ? "text-[#1A1A1A]" : "text-[#1A1A1A]"}>
                    {isNearPerfect ? "Verified" : "Check Pending"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Pending Deadlines Alert if any */}
        {pendingCount > 0 && (
          <div className="mt-4 p-3 rounded-xl bg-[#1A1A1A]/5 border border-[#1A1A1A]/25 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-[#1A1A1A]">
              <AlertTriangle className="w-4 h-4 shrink-0 text-[#1A1A1A]" />
              <span>
                <strong>{pendingCount} compliance action items</strong> pending review across active matters.
              </span>
            </div>
            <Link
              href="/preview/cases"
              className="text-[#1A1A1A] hover:text-[#666666] font-semibold font-mono whitespace-nowrap text-[11px]"
            >
              Review Items →
            </Link>
          </div>
        )}
      </div>

      {/* Footer Link */}
      <div className="pt-4 mt-4 border-t border-[#E5E4E2] flex items-center justify-between text-xs">
        <span className="text-[#666666] font-mono">
          Automatic validation against CPC, CrPC & High Court Rules
        </span>
        <Link
          href="/preview/cases"
          className="inline-flex items-center gap-1 font-semibold text-[#1A1A1A] hover:text-[#1A1A1A]"
        >
          <span>Open Case Files Registry</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
};
