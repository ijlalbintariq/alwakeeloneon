import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Scale, Gavel, Book, FileText, Sparkles, Bookmark, History, FileBadge, TrendingUp, AlertTriangle, ArrowUpRight, Calendar, CalendarDays, Briefcase } from "lucide-react";
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

interface ActivitySummary {
  lastActivity: {
    threadId?: number;
    threadTitle?: string;
    updatedAt?: string;
    displayDate?: string;
    displayTime?: string;
  };
  recentDocuments: Array<{ id: number; title: string; createdAt?: string }>;
  documentCount: number;
  workspaceFocus: string[];
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { data: bookmarks } = useQuery<any[]>({ queryKey: ["/api/bookmarks"] });
  const { data: history } = useQuery<any[]>({ queryKey: ["/api/search-history"] });
  const { data: documents } = useQuery<any[]>({ queryKey: ["/api/documents"] });
  const { data: threads } = useQuery<any[]>({ queryKey: ["/api/threads"] });
  const { data: usage } = useQuery<UsageData>({ queryKey: ["/api/usage"] });
  const { data: activitySummary } = useQuery<ActivitySummary>({ queryKey: ["/api/activity/summary"] });
  const { data: upcomingDeadlines = [] } = useQuery<Array<{ id: number; caseId: number; type: string; title: string; dueDate: string; court?: string; status: string; caseTitle: string }>>({ queryKey: ["/api/case-files-compliance/upcoming"] });
  const todayStr = new Date().toISOString().slice(0, 10);
  const { data: todayAgenda = [] } = useQuery<any[]>({
    queryKey: ["/api/diary", todayStr],
    queryFn: async () => { const res = await fetch(`/api/diary?date=${todayStr}`, { credentials: "include" }); return res.json(); },
  });

  const stats = [
    { label: "Active Sessions", value: threads?.length || 0, icon: Scale, color: "text-primary" },
    { label: "Saved Strategies", value: bookmarks?.length || 0, icon: Bookmark, color: "text-blue-400" },
    { label: "Search History", value: history?.length || 0, icon: History, color: "text-emerald-400" },
    { label: "Registry Files", value: documents?.length || 0, icon: FileBadge, color: "text-primary" },
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
    <div className="min-h-full flex flex-col gap-2 md:gap-3 fade-in" data-testid="dashboard-page">
      <section className="rounded-2xl border border-[hsl(var(--preview-border))] bg-[hsl(var(--preview-surface))/0.58] px-3 py-3 md:px-5 md:py-5">
        <div className="grid gap-3 md:gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
          <div className="space-y-3 md:space-y-4">
            <div className="space-y-1">
              <h2 className="text-xl sm:text-2xl md:text-4xl font-bold leading-none tracking-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
                {greeting}, <span className="text-primary">{user?.firstName || "Counsel"}</span>
              </h2>
              <p className="text-[11px] sm:text-xs md:text-sm text-muted-foreground">Welcome back to your legal workstation.</p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              {stats.map((stat) => {
                const Icon = stat.icon;
                return (
                  <div
                    key={`hero-${stat.label}`}
                    className="rounded-xl border border-[hsl(var(--preview-border))] bg-background/55 p-2.5 md:p-3"
                  >
                    <div className="mb-1.5 inline-flex h-6 w-6 md:h-7 md:w-7 items-center justify-center rounded-lg border border-[hsl(var(--preview-border))] bg-card">
                      <Icon size={12} className={stat.color} />
                    </div>
                    <p className="text-lg md:text-xl font-black text-foreground leading-none">{stat.value}</p>
                    <p className="text-[8px] md:text-[9px] uppercase tracking-wider text-muted-foreground font-bold mt-1">{stat.label}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {usage && (
            <div className="rounded-xl border border-[hsl(var(--preview-border))] bg-background/60 p-3 md:p-4 flex flex-col">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-extrabold">Plan</p>
                <p className="text-sm md:text-base font-black text-primary" data-testid="text-tier-label">{usage.tierLabel}</p>
              </div>
              <p className="text-xs md:text-sm text-foreground font-bold mt-1">{cycleLabel} · renews {renewalLabel}</p>
              <div className="mt-2.5 md:mt-3">
                <div className="flex items-center justify-between text-[11px] md:text-xs font-bold text-foreground mb-1.5 gap-3">
                  <span className="text-sm md:text-base font-extrabold text-foreground" data-testid="text-usage-count">{usage.used} / {usage.monthlyLimit === 999999 ? "Unlimited" : usage.monthlyLimit}</span>
                  <span className="text-sm md:text-base font-extrabold text-foreground text-right" data-testid="text-usage-remaining">{usage.remaining === 999999 ? "Unlimited" : usage.remaining} left</span>
                </div>
                <Progress
                  value={usagePercentage}
                  className="h-2 bg-card rounded-full"
                  data-testid="progress-usage"
                />
              </div>

              <div className="mt-3 md:mt-4">
                <a
                  href={upgradeHref}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-primary/45 bg-primary/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-primary hover:border-primary/70 hover:bg-primary/15"
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
                <p className="mt-3 text-[11px] font-bold text-primary">
                  You are near your monthly limit. Consider upgrading soon.
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_280px] gap-2 md:gap-3 xl:flex-1 xl:min-h-0">
        <div className="rounded-2xl border border-[hsl(var(--preview-border))] bg-[hsl(var(--preview-surface))/0.58] px-3 py-3 md:px-5 md:py-5 flex flex-col xl:min-h-0 xl:h-full">
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <h3 className="text-base md:text-xl font-bold leading-none tracking-tight" style={{ fontFamily: "'Playfair Display', serif" }}>Workspace Shortcuts</h3>
            <p className="text-[9px] md:text-[10px] uppercase tracking-[0.18em] font-black text-muted-foreground">Chambers Operations</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2 md:gap-3 xl:flex-1 xl:min-h-0">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.label}
                  href={action.href}
                  className="block no-underline hover:no-underline focus:no-underline"
                >
                  <div className="h-full min-h-[100px] md:min-h-[120px] rounded-xl border border-[hsl(var(--preview-border))] bg-background/55 p-2.5 md:p-3 cursor-pointer transition-all hover:border-primary/35 hover:bg-card">
                    <div className="flex h-full flex-col gap-2.5 md:gap-3" data-testid={`action-${action.label.toLowerCase().replace(/\s+/g, '-')}`}>
                      <div>
                        <div className="mb-1.5 inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[hsl(var(--preview-border))] bg-card text-foreground">
                          <Icon size={13} />
                        </div>
                        <h4 className="text-sm md:text-base font-bold leading-tight mb-0.5" style={{ fontFamily: "'Playfair Display', serif" }}>{action.label}</h4>
                        <p className="text-[11px] md:text-xs text-muted-foreground leading-snug">{action.desc}</p>
                      </div>
                      <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1.5">
                        <button className="rounded-md border border-[hsl(var(--preview-border))] px-2 py-0.5 text-[10px] font-semibold text-foreground">How to use</button>
                        <button className="rounded-md border border-[hsl(var(--preview-border))] bg-primary text-primary-foreground px-2 py-0.5 text-[10px] font-semibold">
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

        <aside className="rounded-2xl border border-[hsl(var(--preview-border))] bg-[hsl(var(--preview-surface))/0.58] p-3 md:p-4 flex flex-col xl:min-h-0 xl:h-full">
          <div className="flex items-center gap-2 mb-2.5 md:mb-3">
            {isAtLimit ? <AlertTriangle size={15} className="text-red-400" /> : <TrendingUp size={15} className="text-primary" />}
            <p className="text-[10px] uppercase tracking-[0.16em] font-bold text-foreground">Chamber Activity</p>
          </div>
          <div className="space-y-2">
            {todayAgenda.length > 0 && (
              <div className="rounded-xl border border-primary/20 bg-background/55 p-2.5 md:p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <CalendarDays size={12} className="text-primary" />
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold">Today's Agenda</p>
                  <span className="ml-auto text-[9px] font-bold text-primary">{todayAgenda.length}</span>
                </div>
                <div className="space-y-1">
                  {todayAgenda.slice(0, 3).map((item: any, i: number) => (
                    <div key={i} className={`flex items-center gap-2 px-2 py-1 rounded-lg ${item.completed ? "opacity-40" : ""}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${item.source === "compliance" ? "bg-red-400" : "bg-primary"}`} />
                      <span className="text-[11px] text-foreground font-medium truncate flex-1">{item.title}</span>
                      {item.time && <span className="text-[9px] text-muted-foreground">{item.time}</span>}
                    </div>
                  ))}
                </div>
                {todayAgenda.length > 3 && (
                  <Link href="/daily-diary" className="block text-[10px] text-primary font-bold mt-1.5 hover:text-foreground no-underline">+{todayAgenda.length - 3} more →</Link>
                )}
              </div>
            )}
            <div className="rounded-xl border border-[hsl(var(--preview-border))] bg-background/55 p-2.5 md:p-3">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold">Last Activity Reminder</p>
              {activitySummary?.lastActivity?.threadId ? (
                <>
                  <p className="text-xs md:text-sm font-bold text-primary mt-1">
                    {activitySummary.lastActivity.threadTitle}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Last updated: {activitySummary.lastActivity.displayDate} at {activitySummary.lastActivity.displayTime}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">Continue from saved context to keep facts, citations, and strategy consistent.</p>
                </>
              ) : (
                <>
                  <p className="text-xs md:text-sm font-bold text-foreground mt-1">No recent consultations</p>
                  <p className="text-[11px] text-muted-foreground mt-1">Start a new consultation with Al Wakeelo to begin your legal research journey.</p>
                </>
              )}
            </div>

            <div className="rounded-xl border border-[hsl(var(--preview-border))] bg-background/55 p-2.5 md:p-3">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold">Usage Health</p>
              <p className="text-xs md:text-sm font-bold text-foreground mt-1">
                {isAtLimit ? "Limit reached" : isNearLimit ? "High usage load" : "Normal capacity"}
              </p>
              <div className="mt-2">
                <Progress
                  value={usagePercentage}
                  className="h-2 bg-card rounded-full"
                />
              </div>
            </div>

            <div className="rounded-xl border border-[hsl(var(--preview-border))] bg-background/55 p-2.5 md:p-3">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold">Workspace Focus</p>
              {activitySummary?.workspaceFocus?.length ? (
                <div className="space-y-1.5 mt-2">
                  {activitySummary.workspaceFocus.map((suggestion, idx) => (
                    <p key={idx} className="text-[11px] text-foreground flex items-start gap-2">
                      <span className="text-primary mt-0.5">•</span>
                      <span>{suggestion}</span>
                    </p>
                  ))}
                </div>
              ) : (
                <>
                  <p className="text-[11px] text-foreground mt-1">Run judgment research before drafting.</p>
                  <p className="text-[11px] text-foreground mt-1">Attach core documents for stronger AI output.</p>
                  <p className="text-[11px] text-foreground mt-1">Save final drafts to keep consultation continuity.</p>
                </>
              )}
            </div>
          </div>

          {upcomingDeadlines.length > 0 && (
            <div className="rounded-xl border border-amber-500/20 bg-background/55 p-2.5 md:p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Calendar size={12} className="text-amber-400" />
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold">Upcoming Deadlines</p>
              </div>
              <div className="space-y-1.5">
                {upcomingDeadlines.slice(0, 4).map((d: any) => (
                  <Link key={d.id} href={`/case-files/${d.caseId}`} className="block no-underline">
                    <div className="rounded-lg border border-border/50 bg-card/30 px-2.5 py-1.5 hover:border-primary/30 transition">
                      <p className="text-[11px] font-bold text-foreground truncate">{d.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[9px] text-amber-400 font-bold">{new Date(d.dueDate).toLocaleDateString("en-PK", { day: "2-digit", month: "short" })}</span>
                        <span className="text-[9px] text-muted-foreground">{d.type.replace("_", " ")}</span>
                        <span className="text-[9px] text-primary/70 truncate ml-auto">{d.caseTitle}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
              {upcomingDeadlines.length > 4 && (
                <Link href="/case-files" className="block text-[10px] text-primary font-bold mt-2 hover:text-foreground no-underline">
                  +{upcomingDeadlines.length - 4} more deadlines →
                </Link>
              )}
            </div>
          )}

          <div className="mt-2 md:mt-auto rounded-xl border border-[hsl(var(--preview-border))] bg-background/60 p-2.5 md:p-3">
            <p className="text-[10px] uppercase tracking-[0.16em] font-black text-muted-foreground">Operational Status</p>
            <p className="text-xs md:text-sm font-bold text-foreground mt-1">
              {isAtLimit ? "Limit reached" : isNearLimit ? "Approaching monthly limit" : "Normal capacity"}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              {isAtLimit
                ? "AI actions are paused until plan upgrade or cycle reset."
                : isNearLimit
                  ? "Activity is high. Upgrade if you need uninterrupted drafting."
                  : "All systems ready for research and drafting workflows."}
            </p>
            <a href={upgradeHref} className="inline-flex items-center gap-1 mt-2 text-[10px] uppercase tracking-wider font-bold text-primary hover:text-foreground">
              {upgradeLabel} <ArrowUpRight size={11} />
            </a>
          </div>
        </aside>
      </section>
    </div>
  );
}
