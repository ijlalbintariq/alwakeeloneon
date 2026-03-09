export type SubscriptionPlanKey = "standard" | "pro" | "chamber" | "enterprise";

export type SubscriptionPlan = {
  key: SubscriptionPlanKey;
  badge: string;
  title: string;
  price: string;
  subtitle: string;
  cta: string;
  features: string[];
  highlighted: boolean;
};

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    key: "standard",
    badge: "Standard",
    title: "Standard",
    price: "PKR 500/mo",
    subtitle: "Solo starter plan",
    cta: "Choose Standard",
    features: [
      "120 AI actions/month",
      "1 user",
      "Mode access: Standard",
      "Output cap: Standard 900 tokens/request",
      "Uploads: 100 files/month",
      "PDF upload in chat: up to 50 pages/day",
    ],
    highlighted: false,
  },
  {
    key: "pro",
    badge: "Most Popular",
    title: "Pro",
    price: "PKR 1,000/mo",
    subtitle: "For active practitioners",
    cta: "Upgrade to Pro",
    features: [
      "350 AI actions/month",
      "1 user",
      "Mode access: Standard + Turbo",
      "Output caps: Standard 1200, Turbo 1500",
      "Uploads: 300 files/month",
      "PDF upload in chat: up to 150 pages/day",
    ],
    highlighted: true,
  },
  {
    key: "chamber",
    badge: "Chamber",
    title: "Chamber",
    price: "PKR 3,000/mo",
    subtitle: "Built for legal teams",
    cta: "Choose Chamber",
    features: [
      "1,200 AI actions/month (pooled)",
      "Up to 3 users",
      "Mode access: Standard + Turbo + Apex",
      "Output caps: Standard 1700, Turbo 2200, Apex 1800",
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
    price: "PKR 50,000/mo (custom base)",
    subtitle: "For high-volume firms",
    cta: "Contact Chamber",
    features: [
      "Custom fair-use (starts at 30,000 AI actions/month)",
      "Custom seats",
      "Full access + priority routing",
      "Output caps: Standard 1700, Turbo 2200, Apex 1800",
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

