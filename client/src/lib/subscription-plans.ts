export type SubscriptionPlanKey = "standard" | "pro" | "chamber" | "enterprise";
export type BillingCycle = "monthly" | "quarterly" | "yearly";

export type SubscriptionPlan = {
  key: SubscriptionPlanKey;
  badge: string;
  title: string;
  monthlyPricePkr: number;
  price: string;
  subtitle: string;
  cta: string;
  features: string[];
  highlighted: boolean;
};

export type PlanCyclePricing = {
  cycle: BillingCycle;
  cycleLabel: string;
  months: number;
  totalPkr: number;
  effectiveMonthlyPkr: number;
  savingsPkr: number;
  discountPct: number;
  totalLabel: string;
  effectiveMonthlyLabel: string;
  savingsLabel: string;
};

const CYCLE_META: Record<BillingCycle, { label: string; months: number; discountPct: number }> = {
  monthly: { label: "Monthly", months: 1, discountPct: 0 },
  quarterly: { label: "3 Months", months: 3, discountPct: 10 },
  yearly: { label: "Yearly", months: 12, discountPct: 20 },
};

const DISCOUNT_ELIGIBLE_PLAN_KEYS = new Set<SubscriptionPlanKey>(["standard", "pro", "chamber"]);

function formatPkr(value: number): string {
  return `PKR ${Math.max(0, Math.round(value)).toLocaleString("en-US")}`;
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    key: "standard",
    badge: "Standard",
    title: "Standard",
    monthlyPricePkr: 500,
    price: "PKR 500/mo",
    subtitle: "Solo starter plan",
    cta: "Choose Standard",
    features: [
      "120 AI actions/month",
      "1 user",
      "Mode access: Standard",
      "Output cap: Standard 1,200 tokens/request",
      "Uploads: 100 files/month",
      "PDF upload in chat: up to 50 pages/day",
    ],
    highlighted: false,
  },
  {
    key: "pro",
    badge: "Most Popular",
    title: "Pro",
    monthlyPricePkr: 1000,
    price: "PKR 1,000/mo",
    subtitle: "For active practitioners",
    cta: "Upgrade to Pro",
    features: [
      "350 AI actions/month",
      "1 user",
      "Mode access: Standard + Turbo",
      "Output caps: Standard 1,200 · Turbo 3,000",
      "Uploads: 300 files/month",
      "PDF upload in chat: up to 150 pages/day",
    ],
    highlighted: true,
  },
  {
    key: "chamber",
    badge: "Chamber",
    title: "Chamber",
    monthlyPricePkr: 4500,
    price: "PKR 4,500/mo",
    subtitle: "Built for legal teams",
    cta: "Choose Chamber",
    features: [
      "1,200 AI actions/month (pooled)",
      "Up to 3 users",
      "Mode access: Standard + Turbo + Apex",
      "Output caps: Standard 3,200 · Turbo 6,000 · Apex 6,000",
      "Apex monthly cap: 180 requests",
      "Uploads: 1,200 files/month",
      "PDF upload in chat: up to 600 pages/day",
    ],
    highlighted: false,
  },
  {
    key: "enterprise",
    badge: "Enterprise",
    title: "Enterprise",
    monthlyPricePkr: 50000,
    price: "PKR 50,000/mo (custom base)",
    subtitle: "For high-volume firms",
    cta: "Contact Chamber",
    features: [
      "Custom fair-use (starts at 30,000 AI actions/month)",
      "Custom seats",
      "Full access + priority routing",
      "Output caps: Standard 3,200 · Turbo 8,192 · Apex 8,192",
      "Apex monthly cap: 4,500 requests",
      "Custom high-volume uploads",
      "PDF upload in chat: custom volume",
    ],
    highlighted: false,
  },
];

export function getSubscriptionPlanByKey(rawKey: string | null | undefined): SubscriptionPlan {
  const normalized = String(rawKey || "").toLowerCase();
  const matched = SUBSCRIPTION_PLANS.find((plan) => plan.key === normalized);
  return matched || SUBSCRIPTION_PLANS.find((plan) => plan.key === "pro")!;
}

export function normalizeBillingCycle(rawCycle: string | null | undefined): BillingCycle {
  const cycle = String(rawCycle || "monthly").toLowerCase();
  if (cycle === "quarterly" || cycle === "yearly") return cycle;
  return "monthly";
}

export function getBillingCycleMeta(cycleRaw: string | null | undefined): { cycle: BillingCycle; label: string; months: number; discountPct: number } {
  const cycle = normalizeBillingCycle(cycleRaw);
  return { cycle, ...CYCLE_META[cycle] };
}

export function getPlanCyclePricing(plan: SubscriptionPlan, cycleRaw: string | null | undefined): PlanCyclePricing {
  const { cycle, label, months, discountPct } = getBillingCycleMeta(cycleRaw);
  const baseTotal = plan.monthlyPricePkr * months;
  const discountApplies = DISCOUNT_ELIGIBLE_PLAN_KEYS.has(plan.key);
  const effectiveDiscountPct = discountApplies ? discountPct : 0;
  const discountedTotal = Math.round(baseTotal * (1 - effectiveDiscountPct / 100));
  const totalPkr = cycle === "monthly" ? plan.monthlyPricePkr : discountedTotal;
  const effectiveMonthlyPkr = Math.round(totalPkr / months);
  const savingsPkr = discountApplies ? Math.max(0, baseTotal - totalPkr) : 0;

  return {
    cycle,
    cycleLabel: label,
    months,
    totalPkr,
    effectiveMonthlyPkr,
    savingsPkr,
    discountPct: effectiveDiscountPct,
    totalLabel: cycle === "monthly" ? `${formatPkr(totalPkr)}/mo` : `${formatPkr(totalPkr)} / ${months} months`,
    effectiveMonthlyLabel: `${formatPkr(effectiveMonthlyPkr)}/mo effective`,
    savingsLabel: savingsPkr > 0 ? `Save ${formatPkr(savingsPkr)}` : "No cycle discount",
  };
}
