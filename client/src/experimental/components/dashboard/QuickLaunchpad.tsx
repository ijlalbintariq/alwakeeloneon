import React from "react";
import { Link } from "wouter";
import {
  Bot,
  FileSignature,
  Scroll,
  Gavel,
  Briefcase,
  CalendarDays,
  ArrowRight,
  Sparkles,
  ExternalLink,
} from "lucide-react";

export const QuickLaunchpad: React.FC = () => {
  const launchItems = [
    {
      id: "ai-engine",
      title: "Al Wakeelo Legal AI Engine",
      subtitle: "Multi-turn RAG reasoning on Pakistani statutes, CPC/CrPC rules, and verified case precedents.",
      badge: "SSE Streaming",
      badgeColor: "emerald",
      href: "/preview/chat",
      icon: Bot,
      iconBg: "bg-[#1A1A1A]/5 text-[#1A1A1A] border-[#1A1A1A]/20",
      borderHover: "hover:border-[#1A1A1A]/50",
      actionLabel: "Launch Consultation",
      tag: "Apex / Turbo",
    },
    {
      id: "litigation-drafting",
      title: "Litigation Drafting Studio",
      subtitle: "Draft Art. 199 Writs, Bail Petitions, Plaints, and Written Statements with Pakistani Court Legal sizing.",
      badge: "Times New Roman 13pt",
      badgeColor: "blue",
      href: "/preview/drafting",
      icon: FileSignature,
      iconBg: "bg-[#F5F4F2] text-[#666666] border-[#E5E4E2]",
      borderHover: "hover:border-[#D9D8D6]",
      actionLabel: "Draft Court Petition",
      tag: "Tiptap Engine",
    },
    {
      id: "contract-studio",
      title: "Commercial Contract Studio",
      subtitle: "Draft NDAs, Partnership Deeds, Commercial Leases, and Service Agreements with automated risk scoring.",
      badge: "19+ Templates",
      badgeColor: "purple",
      href: "/preview/drafting",
      icon: Scroll,
      iconBg: "bg-[#F5F4F2] text-[#666666] border-[#E5E4E2]",
      borderHover: "hover:border-[#D9D8D6]",
      actionLabel: "Draft Agreement",
      tag: "Clause Library",
    },
    {
      id: "judgment-research",
      title: "Judgment Research & Graphs",
      subtitle: "Search 600,000+ Pakistani Supreme Court & High Court judgments with precedent treatment graphs.",
      badge: "600,000+ Records",
      badgeColor: "gold",
      href: "/preview/judgments",
      icon: Gavel,
      iconBg: "bg-[#1A1A1A]/5 text-[#1A1A1A] border-[#1A1A1A]/20",
      borderHover: "hover:border-[#1A1A1A]/50",
      actionLabel: "Search Precedents",
      tag: "PLD · SCMR · CLC",
    },
    {
      id: "case-files",
      title: "Case Files & Matter Management",
      subtitle: "Manage client files, parties, CNIC records, power of attorney filings, and 6-pillar compliance status.",
      badge: "6-Pillar Audit",
      badgeColor: "emerald",
      href: "/preview/cases",
      icon: Briefcase,
      iconBg: "bg-[#F5F4F2] text-[#1A1A1A] border-[#E5E4E2]",
      borderHover: "hover:border-[#D9D8D6]",
      actionLabel: "Open Case Registry",
      tag: "Court Dossiers",
    },
    {
      id: "daily-diary",
      title: "Daily Diary & Hearing Docket",
      subtitle: "Timezone-aware cause list scheduler (Asia/Karachi) with post-hearing outcome chaining & calendar sync.",
      badge: "Asia/Karachi PKT",
      badgeColor: "gold",
      href: "/preview/diary",
      icon: CalendarDays,
      iconBg: "bg-[#1A1A1A]/5 text-[#1A1A1A] border-[#1A1A1A]/20",
      borderHover: "hover:border-[#1A1A1A]/50",
      actionLabel: "Open Hearing Docket",
      tag: "Dual Calendar Sync",
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#1A1A1A]" />
          <h2 className="text-sm font-semibold font-mono uppercase tracking-wider text-[#4A4A4A]">
            Workspace Quick Launchpad
          </h2>
        </div>
        <span className="text-xs text-[#666666] hidden sm:inline font-mono">
          6 Dedicated Chambers Studios
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {launchItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`group relative flex flex-col justify-between rounded-xl p-5 bg-white border border-[#E5E4E2]/90 backdrop-blur-sm shadow-lg transition-all duration-300 hover:-translate-y-1 ${item.borderHover} hover:shadow-sm`}
            >
              <div className="space-y-3">
                {/* Header: Icon + Badge */}
                <div className="flex items-center justify-between">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-transform group-hover:scale-105 ${item.iconBg}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-[#F5F4F2] text-[#4A4A4A] border border-[#E5E4E2]">
                      {item.tag}
                    </span>
                    <span
                      className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full ${
                        item.badgeColor === "emerald"
                          ? "bg-[#F5F4F2] text-[#1A1A1A] border border-[#E5E4E2]"
                          : item.badgeColor === "blue"
                          ? "bg-[#F5F4F2] text-[#666666] border border-[#E5E4E2]"
                          : item.badgeColor === "purple"
                          ? "bg-[#F5F4F2] text-[#666666] border border-[#E5E4E2]"
                          : "bg-[#1A1A1A]/5 text-[#1A1A1A] border border-[#1A1A1A]/20"
                      }`}
                    >
                      {item.badge}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div>
                  <h3 className="font-semibold text-[#1A1A1A] text-sm group-hover:text-[#1A1A1A] transition-colors font-serif">
                    {item.title}
                  </h3>
                  <p className="text-xs text-[#666666] mt-1.5 leading-relaxed line-clamp-2">
                    {item.subtitle}
                  </p>
                </div>
              </div>

              {/* Footer CTA */}
              <div className="flex items-center justify-between pt-3 mt-4 border-t border-[#E5E4E2]/70 text-xs font-semibold text-[#1A1A1A]/90 group-hover:text-[#1A1A1A]">
                <span>{item.actionLabel}</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1.5 transition-transform text-[#1A1A1A]" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
};
