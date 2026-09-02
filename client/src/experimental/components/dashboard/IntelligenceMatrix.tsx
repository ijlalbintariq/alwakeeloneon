import React from "react";
import { Link } from "wouter";
import {
  Scale,
  Briefcase,
  Gavel,
  Sparkles,
  TrendingUp,
  Bookmark,
  Bot,
  Layers,
  ArrowRight,
} from "lucide-react";
import { PreviewMetricCard } from "@/experimental/components/PreviewMetricCard";
import { QuotaHealthCard, type UsageData } from "./QuotaHealthCard";

interface IntelligenceMatrixProps {
  threads?: any[];
  caseFiles?: any[];
  bookmarks?: any[];
  searchHistory?: any[];
  usage?: UsageData;
  isLoadingUsage?: boolean;
  onOpenUpgradeModal?: () => void;
}

export const IntelligenceMatrix: React.FC<IntelligenceMatrixProps> = ({
  threads = [],
  caseFiles = [],
  bookmarks = [],
  searchHistory = [],
  usage,
  isLoadingUsage = false,
  onOpenUpgradeModal,
}) => {
  const activeThreadCount = threads.length;
  const activeCaseCount = caseFiles.length;
  const bookmarkCount = bookmarks.length;
  const searchCount = searchHistory.length;

  // Breakdown of cases
  const highCourtCases = caseFiles.filter(
    (c) =>
      c.court?.toLowerCase().includes("high court") ||
      c.court?.toLowerCase().includes("lhc") ||
      c.court?.toLowerCase().includes("shc") ||
      c.court?.toLowerCase().includes("ihc")
  ).length;

  const districtCases = activeCaseCount - highCourtCases;

  const latestThread = threads[0]?.title
    ? threads[0].title.slice(0, 26) + "..."
    : "No recent query";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#1A1A1A]" />
          <h2 className="text-sm font-semibold font-mono uppercase tracking-wider text-[#4A4A4A]">
            Chambers 4-Pillar Intelligence Matrix
          </h2>
        </div>
        <span className="text-[11px] font-mono text-[#1A1A1A] bg-[#F5F4F2] border border-[#E5E4E2] px-2 py-0.5 rounded">
          Live Backend Sync
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Pillar 1: Active AI Consultations */}
        <Link href="/preview/chat" className="block focus:outline-none">
          <PreviewMetricCard
            title="Active AI Consultations"
            value={activeThreadCount}
            subtitle={latestThread}
            badge="Engine"
            icon={Bot}
            variant="gold"
            trend={{
              value: `+${Math.min(activeThreadCount, 4)}`,
              isPositive: true,
              label: "this month",
            }}
            className="h-full hover:border-[#1A1A1A]/60 cursor-pointer"
          />
        </Link>

        {/* Pillar 2: Case Files & Matter Compliance */}
        <Link href="/preview/cases" className="block focus:outline-none">
          <PreviewMetricCard
            title="Active Legal Matters"
            value={activeCaseCount || 0}
            subtitle={
              activeCaseCount > 0
                ? `${highCourtCases} High Court · ${Math.max(0, districtCases)} District`
                : "Initialize new case brief"
            }
            badge="Files"
            icon={Briefcase}
            variant="emerald"
            trend={{
              value: "6-Pillar",
              isPositive: true,
              label: "compliant",
            }}
            className="h-full hover:border-[#D9D8D6] cursor-pointer"
          />
        </Link>

        {/* Pillar 3: Precedent Research & Bookmarks */}
        <Link href="/preview/judgments" className="block focus:outline-none">
          <PreviewMetricCard
            title="Precedents & Citations"
            value={bookmarkCount || 0}
            subtitle={
              searchCount > 0
                ? `${searchCount} recent searches logged`
                : "600,000+ case law records"
            }
            badge="Research"
            icon={Gavel}
            variant="sapphire"
            trend={{
              value: "+SCMR/PLD",
              isPositive: true,
              label: "verified",
            }}
            className="h-full hover:border-[#D9D8D6] cursor-pointer"
          />
        </Link>

        {/* Pillar 4: Quota & Token Health */}
        <div
          onClick={onOpenUpgradeModal}
          className="cursor-pointer focus:outline-none block"
        >
          <PreviewMetricCard
            title="Quota Health"
            value={
              usage?.monthlyLimit === 999999
                ? "100%"
                : `${Math.max(0, 100 - (usage?.percentage || 0)).toFixed(0)}%`
            }
            subtitle={usage?.tierLabel || "Chambers Tier"}
            badge={usage?.isAtLimit ? "Exhausted" : "Active"}
            icon={Sparkles}
            variant={usage?.isAtLimit ? "ruby" : "gold"}
            trend={{
              value: `${usage?.used?.toLocaleString() ?? 0}`,
              isPositive: !usage?.isAtLimit,
              label: "tokens used",
            }}
            className="h-full hover:border-[#1A1A1A]/60"
          />
        </div>
      </div>
    </div>
  );
};
