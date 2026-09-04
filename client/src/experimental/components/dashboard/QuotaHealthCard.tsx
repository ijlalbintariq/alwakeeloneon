import React, { useState } from "react";
import {
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
  AlertTriangle,
  Zap,
  TrendingUp,
  CreditCard,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { getUpgradeActionLabel, getUpgradeCheckoutPath } from "@/lib/upgrade-path";
import { SUBSCRIPTION_PLANS, getPlanCyclePricing, getSubscriptionPlanByKey } from "@/lib/subscription-plans";

export interface UsageData {
  tier: string;
  tierLabel: string;
  tierDescription: string;
  subscriptionCycle?: "monthly" | "quarterly" | "yearly" | string;
  subscriptionStartAt?: string | null;
  subscriptionEndAt?: string | null;
  monthlyLimit: number;
  used: number;
  remaining: number;
  percentage: number;
  todayUsed?: number;
  todayLimit?: number;
  todayPercentage?: number;
  isAtLimit?: boolean;
  isNearLimit?: boolean;
}

interface QuotaHealthCardProps {
  usage?: UsageData;
  isLoading?: boolean;
  onOpenUpgradeModal?: () => void;
}

export const QuotaHealthCard: React.FC<QuotaHealthCardProps> = ({
  usage,
  isLoading = false,
  onOpenUpgradeModal,
}) => {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-[#E5E4E2] dark:border-[#1E2D44] bg-[#F5F4F2] dark:bg-[#0B131E] p-5 animate-pulse space-y-4">
        <div className="h-5 w-32 bg-[#F5F4F2] dark:bg-[#0B131E] rounded" />
        <div className="h-8 w-48 bg-[#F5F4F2] dark:bg-[#0B131E] rounded" />
        <div className="h-2 w-full bg-[#F5F4F2] dark:bg-[#0B131E] rounded" />
      </div>
    );
  }

  const usagePercentage =
    usage?.monthlyLimit === 999999 ? 0 : usage?.percentage ?? 0;
  const isAtLimit =
    usage?.isAtLimit !== undefined
      ? usage.isAtLimit
      : usagePercentage >= 100;
  const isNearLimit =
    usage?.isNearLimit !== undefined
      ? usage.isNearLimit
      : usagePercentage >= 80;

  const cycleLabelRaw = String(
    usage?.subscriptionCycle || "monthly"
  ).toLowerCase();
  const cycleLabel =
    cycleLabelRaw === "yearly"
      ? "Yearly Plan"
      : cycleLabelRaw === "quarterly"
      ? "3-Month Retainer"
      : "Monthly Retainer";

  const renewalLabel = usage?.subscriptionEndAt
    ? new Date(usage.subscriptionEndAt).toLocaleDateString("en-PK", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "Active (Auto-Renew)";

  const tierKey = String(usage?.tier || "standard").toLowerCase();
  const planInfo = getSubscriptionPlanByKey(tierKey);
  const cyclePricing = getPlanCyclePricing(planInfo, cycleLabelRaw);

  const upgradeHref = getUpgradeCheckoutPath(usage?.tier);
  const upgradeLabel = getUpgradeActionLabel(usage?.tier);

  return (
    <div className="relative rounded-xl border border-[#1A1A1A]/20 dark:border-[#1E2D44] bg-white dark:bg-[#131E2E] p-5 backdrop-blur-sm shadow-lg shadow-sm overflow-hidden flex flex-col justify-between group hover:border-[#1A1A1A]/50 transition-all">
      {/* Decorative Gold Sheen Corner */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-[#1A1A1A]/5 dark:bg-[#1A1A1A]/50 rounded-full blur-2xl pointer-events-none" />

      <div>
        {/* Header: Plan Badge & Tier Name */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1A1A1A]/5 dark:bg-[#1A1A1A]/50 border border-[#1A1A1A]/20 dark:border-[#1E2D44] text-[#1A1A1A] dark:text-[#F8FAFC]">
              <Zap className="h-3.5 w-3.5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-mono tracking-wider text-[#1A1A1A] dark:text-[#F8FAFC]/90 font-bold block">
                Subscription & Quota Health
              </span>
              <span className="text-sm sm:text-base font-bold font-serif text-[#1A1A1A] dark:text-[#F8FAFC]">
                {usage?.tierLabel || planInfo.title || "Chambers Plan"}
              </span>
            </div>
          </div>

          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#1A1A1A]/8 text-[#1A1A1A] dark:text-[#F8FAFC] border border-[#1A1A1A]/20 dark:border-[#1E2D44]">
            {cyclePricing.totalLabel || "PKR Live"}
          </span>
        </div>

        {/* Plan Status Row */}
        <div className="flex items-center justify-between text-xs text-[#666666] dark:text-[#94A3B8] dark:text-[#475569] mb-3 pb-2.5 border-b border-[#E5E4E2] dark:border-[#1E2D44]">
          <span className="flex items-center gap-1">
            <CreditCard className="w-3.5 h-3.5 text-[#666666] dark:text-[#94A3B8] dark:text-[#475569]" />
            <span>{cycleLabel}</span>
          </span>
          <span className="font-mono text-[11px] text-[#4A4A4A] dark:text-[#94A3B8] dark:text-[#475569]">
            Renews: <strong className="text-[#1A1A1A] dark:text-[#F8FAFC] font-semibold">{renewalLabel}</strong>
          </span>
        </div>

        {/* Live Token Progress Bar */}
        <div className="space-y-1.5 mb-3">
          <div className="flex items-center justify-between text-xs font-mono font-medium">
            <span className="text-[#4A4A4A] dark:text-[#94A3B8] dark:text-[#475569]">
              Used:{" "}
              <strong className="text-[#1A1A1A] dark:text-[#F8FAFC]">
                {usage?.used?.toLocaleString() ?? 0}
              </strong>{" "}
              /{" "}
              <span className="text-[#666666] dark:text-[#94A3B8] dark:text-[#475569]">
                {usage?.monthlyLimit === 999999
                  ? "Unlimited"
                  : usage?.monthlyLimit?.toLocaleString() ?? "1,000"}
              </span>
            </span>
            <span className="text-[#1A1A1A] dark:text-[#F8FAFC] font-semibold">
              {usage?.remaining === 999999
                ? "Unlimited Capacity"
                : `${usage?.remaining?.toLocaleString() ?? 0} remaining`}
            </span>
          </div>

          <div className="relative h-2.5 w-full bg-white dark:bg-[#131E2E] rounded-full overflow-hidden border border-[#E5E4E2] dark:border-[#1E2D44]">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isAtLimit
                  ? "bg-red-500"
                  : isNearLimit
                  ? "bg-[#1A1A1A]"
                  : "bg-[#1A1A1A] "
              }`}
              style={{ width: `${Math.min(100, Math.max(0, usagePercentage))}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[10px] text-[#666666] dark:text-[#94A3B8] dark:text-[#475569] font-mono">
            <span>{usagePercentage.toFixed(1)}% consumed</span>
            <span>Monthly reset on 1st</span>
          </div>
        </div>

        {/* Warnings if limit reached / near */}
        {isAtLimit && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs mb-3">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>Quota exhausted. Upgrade tier for uninterrupted AI drafting.</span>
          </div>
        )}
        {!isAtLimit && isNearLimit && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-[#1A1A1A]/5 dark:bg-[#1A1A1A]/50 border border-[#1A1A1A]/20 dark:border-[#1E2D44] text-[#1A1A1A] dark:text-[#F8FAFC] text-xs mb-3">
            <AlertTriangle className="w-4 h-4 shrink-0 text-[#1A1A1A] dark:text-[#F8FAFC]" />
            <span>Approaching monthly token quota (80%+ consumed).</span>
          </div>
        )}
      </div>

      {/* Action Footers */}
      <div className="flex items-center justify-between gap-3 pt-3 border-t border-[#E5E4E2] dark:border-[#1E2D44]">
        <div className="text-[11px] text-[#666666] dark:text-[#94A3B8] dark:text-[#475569]">
          <span className="text-[#1A1A1A] dark:text-[#F8FAFC] font-semibold">● Apex & Turbo</span> AI ready
        </div>

        {onOpenUpgradeModal ? (
          <button
            onClick={onOpenUpgradeModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1A1A1A]/8 hover:bg-[#2D2D2D]/25 border border-[#1A1A1A]/30 text-[#1A1A1A] dark:text-[#F8FAFC] hover:text-[#666666] dark:text-[#94A3B8] dark:text-[#475569] text-xs font-semibold font-mono uppercase tracking-wider transition-all"
          >
            <span>{upgradeLabel}</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        ) : (
          <a
            href={upgradeHref}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1A1A1A]/8 hover:bg-[#2D2D2D]/25 border border-[#1A1A1A]/30 text-[#1A1A1A] dark:text-[#F8FAFC] hover:text-[#666666] dark:text-[#94A3B8] dark:text-[#475569] text-xs font-semibold font-mono uppercase tracking-wider transition-all"
          >
            <span>{upgradeLabel}</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    </div>
  );
};
