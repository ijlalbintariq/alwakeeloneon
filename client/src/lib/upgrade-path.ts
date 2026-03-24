import { getSubscriptionPlanByKey, type SubscriptionPlanKey } from "@/lib/subscription-plans";

const UPGRADE_MAP: Record<string, SubscriptionPlanKey> = {
  free: "pro",
  standard: "pro",
  pro: "chamber",
  chamber: "enterprise",
  enterprise: "enterprise",
};

export function getRecommendedUpgradePlan(tierRaw: string | null | undefined): SubscriptionPlanKey {
  const tier = String(tierRaw || "free").toLowerCase();
  return UPGRADE_MAP[tier] || "pro";
}

export function getUpgradeCheckoutPath(tierRaw: string | null | undefined): string {
  return `/checkout?plan=${getRecommendedUpgradePlan(tierRaw)}&cycle=monthly`;
}

export function getUpgradeActionLabel(tierRaw: string | null | undefined): string {
  const tier = String(tierRaw || "free").toLowerCase();
  if (tier === "free") return "Subscribe Now";
  if (tier === "enterprise") return "Contact Chamber";
  const nextPlan = getSubscriptionPlanByKey(getRecommendedUpgradePlan(tier));
  return `Upgrade to ${nextPlan.title}`;
}
