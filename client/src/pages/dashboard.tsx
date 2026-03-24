import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Scale, Gavel, Book, FileText, Sparkles, Bookmark, History, FileBadge, Zap, TrendingUp, AlertTriangle, ArrowUpRight } from "lucide-react";
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

  const isNearLimit = usage && usage.percentage >= 80;
  const isAtLimit = usage && usage.percentage >= 100;
  const upgradeHref = getUpgradeCheckoutPath(usage?.tier);
  const upgradeLabel = getUpgradeActionLabel(usage?.tier);
  const cycleLabelRaw = String(usage?.subscriptionCycle || "monthly").toLowerCase();
  const cycleLabel = cycleLabelRaw === "yearly" ? "Yearly" : cycleLabelRaw === "quarterly" ? "3 Months" : "Monthly";
  const renewalLabel = usage?.subscriptionEndAt
    ? new Date(usage.subscriptionEndAt).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" })
    : "Not set";

  return (
    <div className="space-y-7 md:space-y-10 fade-in" data-testid="dashboard-page">
      <div className="p-6 sm:p-8 md:p-16 preview-elevated rounded-[1.5rem] md:rounded-[2.25rem] text-white shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-6 md:p-12 opacity-10 group-hover:scale-110 group-hover:rotate-12 transition-all duration-1000">
          <Scale size={240} />
        </div>
        <div className="relative z-10">
          <p className="text-[10px] font-black uppercase tracking-[0.5em] mb-4 text-amber-400/70">
            Chambers Secure Protocol
          </p>
          <h2 className="text-3xl sm:text-4xl md:text-6xl font-bold mb-4 md:mb-6 tracking-tighter italic leading-none" style={{ fontFamily: "'Playfair Display', serif" }}>
            "Justice is for all,<br />but wins are for the smart."
          </h2>
          <p className="text-base md:text-lg font-medium opacity-80 max-w-2xl leading-relaxed">
            Welcome back, {user?.firstName || "Advocate"}. Al Wakeelo core engine synchronized. Chambers vaults and registries are online.
          </p>
        </div>
      </div>

      {usage && (
        <div className={`p-4 sm:p-6 md:p-8 rounded-[1.2rem] md:rounded-[1.75rem] border shadow-xl ${isAtLimit ? "bg-red-950/30 border-red-800/50" : isNearLimit ? "bg-amber-950/30 border-amber-800/50" : "preview-surface"}`} data-testid="usage-panel">
          <div className="flex items-center gap-4 mb-6">
            {isAtLimit ? (
              <AlertTriangle size={18} className="text-red-400" />
            ) : (
              <TrendingUp size={18} className="text-amber-500" />
            )}
            <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-amber-500">
              Monthly Usage — {usage.tierLabel} Plan
            </h3>
            <div className="flex-1 h-px bg-slate-800" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
            <div className="md:col-span-2 space-y-4">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-3xl font-black preview-title" data-testid="text-usage-count">
                    {usage.used}
                    <span className="text-lg preview-muted font-medium"> / {usage.monthlyLimit === 999999 ? "Unlimited" : usage.monthlyLimit}</span>
                  </p>
                  <p className="text-[9px] font-black uppercase tracking-widest preview-muted mt-1">
                    AI Actions This Month
                  </p>
                </div>
                <p className="text-sm font-bold preview-subtitle" data-testid="text-usage-remaining">
                  {usage.remaining === 999999 ? "Unlimited" : usage.remaining} remaining
                </p>
              </div>
              <Progress
                value={usage.monthlyLimit === 999999 ? 0 : usage.percentage}
                className="h-3 bg-slate-800 rounded-full"
                data-testid="progress-usage"
              />
            </div>

            <div className="flex flex-col items-center gap-3 p-6 bg-slate-800/40 border border-[hsl(var(--preview-border))] rounded-2xl">
              <p className="text-[9px] font-black uppercase tracking-widest preview-muted">Current Plan</p>
              <p className="text-xl font-black text-amber-500" data-testid="text-tier-label">{usage.tierLabel}</p>
              <p className="text-[10px] preview-subtitle text-center">{usage.tierDescription}</p>
              <p className="text-[10px] preview-muted text-center">{cycleLabel} cycle · Renews by {renewalLabel}</p>
              <a
                href={upgradeHref}
                className="mt-1 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-amber-500/40 text-amber-300 text-[10px] font-black uppercase tracking-widest hover:border-amber-400 hover:text-amber-200 transition-colors"
                data-testid="link-upgrade-from-plan-card-dashboard"
              >
                {upgradeLabel} <ArrowUpRight size={11} />
              </a>
            </div>
          </div>

          {isAtLimit && (
            <div className="mt-6 p-4 bg-red-900/30 border border-red-800/30 rounded-xl" data-testid="alert-limit-reached">
              <p className="text-sm text-red-300 font-medium">
                You have reached your monthly AI action limit. Upgrade your plan to continue using AI features.
              </p>
              <a
                href={upgradeHref}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 text-slate-950 text-[10px] font-black uppercase tracking-widest hover:bg-amber-400 transition-colors"
                data-testid="link-upgrade-limit-dashboard"
              >
                {upgradeLabel} <ArrowUpRight size={11} />
              </a>
            </div>
          )}

          {isNearLimit && !isAtLimit && (
            <div className="mt-6 p-4 bg-amber-900/30 border border-amber-800/30 rounded-xl" data-testid="alert-near-limit">
              <p className="text-sm text-amber-300 font-medium">
                You are approaching your monthly AI action limit ({usage.remaining} actions remaining). Consider upgrading your plan.
              </p>
              <a
                href={upgradeHref}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-amber-500/40 text-amber-300 text-[10px] font-black uppercase tracking-widest hover:border-amber-400 hover:text-amber-200 transition-colors"
                data-testid="link-upgrade-near-limit-dashboard"
              >
                View Upgrade Options <ArrowUpRight size={11} />
              </a>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="preview-surface rounded-[1.2rem] md:rounded-[1.4rem] p-4 md:p-8 shadow-xl hover:-translate-y-0.5 transition-all" data-testid={`stat-${stat.label.toLowerCase().replace(/\s+/g, '-')}`}>
              <div className="flex items-center gap-3 mb-4">
                <div className={`p-2.5 bg-slate-800 rounded-xl ${stat.color}`}><Icon size={18} /></div>
              </div>
              <p className="text-3xl font-black preview-title mb-1">{stat.value}</p>
              <p className="text-[9px] font-black uppercase tracking-widest preview-muted">{stat.label}</p>
            </div>
          );
        })}
      </div>

      <div>
        <div className="flex items-center gap-4 mb-8">
          <Zap size={18} className="text-amber-500" />
          <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-amber-500">Quick Actions</h3>
          <div className="flex-1 h-px bg-slate-800" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link key={action.label} href={action.href}>
                <div className="p-5 md:p-8 preview-surface rounded-[1.2rem] md:rounded-[1.6rem] shadow-xl hover:border-amber-500/35 hover:shadow-[0_20px_40px_-26px_rgba(251,191,36,0.7)] transition-all cursor-pointer group" data-testid={`action-${action.label.toLowerCase().replace(/\s+/g, '-')}`}>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl group-hover:bg-amber-500 group-hover:text-slate-950 transition-all"><Icon size={20} /></div>
                    <h4 className="text-sm font-bold preview-title">{action.label}</h4>
                  </div>
                  <p className="text-xs preview-subtitle leading-relaxed">{action.desc}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
