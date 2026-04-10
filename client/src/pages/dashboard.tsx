import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Scale, Gavel, Book, FileText, Sparkles, Bookmark, History, FileBadge, TrendingUp, AlertTriangle, ArrowUpRight } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { getUpgradeActionLabel, getUpgradeCheckoutPath } from "@/lib/upgrade-path";

type UsageData = {
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
};

export default function DashboardPage() {
  const { user } = useAuth();
  const { data: bookmarks } = useQuery<any[]>({ queryKey: ["/api/bookmarks"] });
  const { data: history } = useQuery<any[]>({ queryKey: ["/api/search-history"] });
  const { data: documents } = useQuery<any[]>({ queryKey: ["/api/documents"] });
  const { data: threads } = useQuery<any[]>({ queryKey: ["/api/threads"] });
  const { data: usage } = useQuery<UsageData>({ queryKey: ["/api/usage"] });

  const stats = [
    { label: "Active Sessions", value: threads?.length || 0, icon: Scale, color: "text-amber-500" },
    { label: "Saved Strategies", value: bookmarks?.length || 0, icon: Bookmark, color: "text-blue-400" },
    { label: "Search History", value: history?.length || 0, icon: History, color: "text-emerald-400" },
    { label: "Registry Files", value: documents?.length || 0, icon: FileBadge, color: "text-amber-400" },
  ];

  const quickActions = [
    { label: "Judgments", icon: Gavel, href: "/judgments", desc: "Search Pakistani case law" },
    { label: "Statute Search", icon: Book, href: "/statute-search", desc: "Browse legal statutes" },
    { label: "Al Wakeelo Engine", icon: Scale, href: "/al-wakeelo", desc: "Consult your AI advocate" },
    { label: "Legal Drafting", icon: FileText, href: "/legal-drafting", desc: "Draft legal documents" },
    { label: "Contract Drafting", icon: Sparkles, href: "/contract-drafting", desc: "Generate contracts" },
    { label: "Case Documents", icon: FileBadge, href: "/case-documents", desc: "Browse case files" },
  ];

  const usagePercentage = usage?.monthlyLimit === 999999 ? 0 : (usage?.percentage ?? 0);
  const isNearLimit = usagePercentage >= 80;
  const isAtLimit = usagePercentage >= 100;
  const upgradeHref = getUpgradeCheckoutPath(usage?.tier);
  const upgradeLabel = getUpgradeActionLabel(usage?.tier);
  const cycleLabelRaw = String(usage?.subscriptionCycle || "monthly").toLowerCase();
  const cycleLabel = cycleLabelRaw === "yearly" ? "Yearly" : cycleLabelRaw === "quarterly" ? "3 Months" : "Monthly";
  const renewalLabel = usage?.subscriptionEndAt
    ? new Date(usage.subscriptionEndAt).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" })
    : "Not set";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const actionLabel = (label: string) => {
    if (label.includes("Statute")) return "Search Statutes";
    if (label.includes("Judgments")) return "Search Judgments";
    if (label.includes("Engine")) return "Open Engine";
    if (label.includes("Legal")) return "Start Drafting";
    if (label.includes("Contract")) return "Open Drafting";
    return "Open Briefcase";
  };

  return (
    <div className="h-full min-h-0 flex flex-col gap-3 fade-in" data-testid="dashboard-page">
      <section className="rounded-2xl border border-[hsl(var(--preview-border))] bg-[hsl(var(--preview-surface))/0.58] px-4 py-4 md:px-5 md:py-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
          <div className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-2xl md:text-4xl font-bold leading-none tracking-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
                {greeting}, <span className="text-amber-400">{user?.firstName || "Counsel"}</span>
              </h2>
              <p className="text-xs md:text-sm text-slate-400">Welcome back to your legal workstation.</p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
              {stats.map((stat) => {
                const Icon = stat.icon;
                return (
                  <div
                    key={`hero-${stat.label}`}
                    className="rounded-xl border border-[hsl(var(--preview-border))] bg-[#0f1a2d]/55 p-3"
                  >
                    <div className="mb-2 inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[hsl(var(--preview-border))] bg-[#111b2e]">
                      <Icon size={13} className={stat.color} />
                    </div>
                    <p className="text-xl font-black text-slate-100 leading-none">{stat.value}</p>
                    <p className="text-[9px] uppercase tracking-wider text-slate-500 font-bold mt-1">{stat.label}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {usage && (
            <div className="rounded-xl border border-[hsl(var(--preview-border))] bg-[#0f1a2d]/60 p-4 flex flex-col">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] uppercase tracking-wider text-slate-400 font-extrabold">Plan</p>
                <p className="text-base font-black text-amber-400" data-testid="text-tier-label">{usage.tierLabel}</p>
              </div>
              <p className="text-sm text-slate-300 font-bold mt-1">{cycleLabel} · renews {renewalLabel}</p>
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-200 mb-1.5">
                  <span className="text-base font-extrabold text-slate-100" data-testid="text-usage-count">{usage.used} / {usage.monthlyLimit === 999999 ? "Unlimited" : usage.monthlyLimit}</span>
                  <span className="text-base font-extrabold text-slate-100" data-testid="text-usage-remaining">{usage.remaining === 999999 ? "Unlimited" : usage.remaining} left</span>
                </div>
                <Progress
                  value={usagePercentage}
                  className="h-2 bg-slate-800 rounded-full"
                  data-testid="progress-usage"
                />
              </div>

              <div className="mt-4">
                <a
                  href={upgradeHref}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300/45 bg-amber-400/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-amber-300 hover:border-amber-300/70 hover:bg-amber-300/15"
                  data-testid="link-upgrade-from-plan-card-dashboard"
                >
                  {upgradeLabel} <ArrowUpRight size={12} />
                </a>
              </div>

              {isAtLimit && (
                <p className="mt-3 text-[11px] font-bold text-red-300">
                  Monthly AI limit reached. Upgrade to continue uninterrupted.
                </p>
              )}
              {!isAtLimit && isNearLimit && (
                <p className="mt-3 text-[11px] font-bold text-amber-300">
                  You are near your monthly limit. Consider upgrading soon.
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_280px] gap-3">
        <div className="min-h-0 h-full rounded-2xl border border-[hsl(var(--preview-border))] bg-[hsl(var(--preview-surface))/0.58] px-4 py-4 md:px-5 md:py-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg md:text-xl font-bold leading-none tracking-tight" style={{ fontFamily: "'Playfair Display', serif" }}>Workspace Shortcuts</h3>
            <p className="text-[10px] uppercase tracking-[0.18em] font-black text-slate-500">Chambers Operations</p>
          </div>
          <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.label}
                  href={action.href}
                  className="block no-underline hover:no-underline focus:no-underline"
                >
                  <div className="h-full min-h-[176px] rounded-xl border border-[hsl(var(--preview-border))] bg-[#0f1a2d]/55 p-4 cursor-pointer transition-all hover:border-amber-500/35 hover:bg-[#15233a]">
                    <div className="flex h-full flex-col gap-3" data-testid={`action-${action.label.toLowerCase().replace(/\s+/g, '-')}`}>
                      <div>
                        <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[hsl(var(--preview-border))] bg-[#111b2e] text-slate-300">
                          <Icon size={15} />
                        </div>
                        <h4 className="text-lg font-bold leading-tight mb-1.5" style={{ fontFamily: "'Playfair Display', serif" }}>{action.label}</h4>
                        <p className="text-sm text-slate-400 leading-snug">{action.desc}</p>
                      </div>
                      <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
                        <button className="rounded-lg border border-[hsl(var(--preview-border))] px-3 py-1.5 text-xs font-semibold text-slate-300">How to use</button>
                        <button className="rounded-lg border border-[hsl(var(--preview-border))] bg-white text-black px-3 py-1.5 text-xs font-semibold">
                          {actionLabel(action.label)}
                        </button>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        <aside className="min-h-0 h-full rounded-2xl border border-[hsl(var(--preview-border))] bg-[hsl(var(--preview-surface))/0.58] p-4 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            {isAtLimit ? <AlertTriangle size={15} className="text-red-400" /> : <TrendingUp size={15} className="text-amber-400" />}
            <p className="text-[10px] uppercase tracking-[0.16em] font-bold text-slate-300">Chamber Activity</p>
          </div>
          <div className="space-y-2.5">
            <div className="rounded-xl border border-[hsl(var(--preview-border))] bg-[#0f1a2d]/55 p-3">
              <p className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Last Activity Reminder</p>
              <p className="text-sm font-bold text-slate-100 mt-1">Review your most recent consultation thread before drafting.</p>
              <p className="text-[11px] text-slate-400 mt-1">Continue from saved context to keep facts, citations, and strategy consistent.</p>
            </div>

            <div className="rounded-xl border border-[hsl(var(--preview-border))] bg-[#0f1a2d]/55 p-3">
              <p className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Usage Health</p>
              <p className="text-sm font-bold text-slate-100 mt-1">
                {isAtLimit ? "Limit reached" : isNearLimit ? "High usage load" : "Normal capacity"}
              </p>
              <div className="mt-2">
                <Progress
                  value={usagePercentage}
                  className="h-2 bg-slate-800 rounded-full"
                />
              </div>
            </div>

            <div className="rounded-xl border border-[hsl(var(--preview-border))] bg-[#0f1a2d]/55 p-3">
              <p className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Workspace Focus</p>
              <p className="text-[11px] text-slate-300 mt-1">Run judgment research before drafting.</p>
              <p className="text-[11px] text-slate-300 mt-1">Attach core documents for stronger AI output.</p>
              <p className="text-[11px] text-slate-300 mt-1">Save final drafts to keep consultation continuity.</p>
            </div>
          </div>
          <div className="mt-auto rounded-xl border border-[hsl(var(--preview-border))] bg-[#0f1a2d]/60 p-3">
            <p className="text-[10px] uppercase tracking-[0.16em] font-black text-slate-500">Operational Status</p>
            <p className="text-sm font-bold text-slate-200 mt-1">
              {isAtLimit ? "Limit reached" : isNearLimit ? "Approaching monthly limit" : "Normal capacity"}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              {isAtLimit
                ? "AI actions are paused until plan upgrade or cycle reset."
                : isNearLimit
                  ? "Activity is high. Upgrade if you need uninterrupted drafting."
                  : "All systems ready for research and drafting workflows."}
            </p>
            <a href={upgradeHref} className="inline-flex items-center gap-1 mt-2 text-[10px] uppercase tracking-wider font-bold text-amber-300 hover:text-amber-200">
              {upgradeLabel} <ArrowUpRight size={11} />
            </a>
          </div>
        </aside>
      </section>
    </div>
  );
}
