import React, { useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import {
  Bot,
  FileSignature,
  Gavel,
  Briefcase,
  CalendarDays,
  Plus,
  Sparkles,
  Clock,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Building,
  MessageSquare,
  FileText,
  Search,
  BookOpen,
  ShieldCheck,
  Calculator,
  GitBranch,
  Layers,
  Send,
  HelpCircle,
  Scale,
  Activity,
  Calendar,
} from "lucide-react";
import { PreviewShell } from "@/experimental/components/PreviewShell";
import { UpgradePlanModal } from "@/experimental/components/dashboard/UpgradePlanModal";
import { AddHearingModal } from "@/experimental/components/dashboard/AddHearingModal";
import { CourtFeeCalculatorModal } from "@/experimental/components/drafting/CourtFeeCalculatorModal";
import { type UsageData } from "@/experimental/components/dashboard/QuotaHealthCard";
import { cn } from "@/lib/utils";

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

export const PreviewDashboard: React.FC = () => {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [upgradeModalOpen, setUpgradeModalOpen] = useState<boolean>(false);
  const [addHearingOpen, setAddHearingOpen] = useState<boolean>(false);
  const [feeModalOpen, setFeeModalOpen] = useState<boolean>(false);
  const [activityFilter, setActivityFilter] = useState<"all" | "chat" | "draft" | "search">("all");

  const { data: usage, isLoading: isLoadingUsage } = useQuery<UsageData>({
    queryKey: ["/api/usage"],
  });

  const { data: activitySummary } = useQuery<ActivitySummary>({
    queryKey: ["/api/activity/summary"],
  });

  const todayStr = new Date().toISOString().slice(0, 10);
  const { data: todayAgenda = [] } = useQuery<any[]>({
    queryKey: ["/api/diary", todayStr],
    queryFn: async () => {
      const res = await fetch(`/api/diary?date=${todayStr}`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: upcomingDeadlines = [] } = useQuery<any[]>({
    queryKey: ["/api/case-files-compliance/upcoming"],
  });

  const { data: documents = [] } = useQuery<any[]>({
    queryKey: ["/api/documents"],
  });

  const { data: threads = [] } = useQuery<any[]>({
    queryKey: ["/api/threads"],
  });

  const { data: caseFiles = [] } = useQuery<any[]>({
    queryKey: ["/api/case-files"],
  });

  const { data: searchHistory = [] } = useQuery<any[]>({
    queryKey: ["/api/search-history"],
  });

  const counselName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    (user?.email ? user.email.split("@")[0] : "Counsel");

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";

  const quotaPercent = Math.max(0, 100 - (usage?.percentage || 0));

  // Consolidated Single Activity Stream
  type ActivityItem = {
    id: string;
    type: "chat" | "draft" | "search";
    title: string;
    subtitle: string;
    href: string;
    date: string | null;
    timestamp: number;
    icon: any;
    iconBg: string;
    iconColor: string;
  };

  const unifiedActivity: ActivityItem[] = useMemo(() => {
    const items: ActivityItem[] = [];

    // 1. Threads (AI Consultations)
    threads.forEach((t: any) => {
      items.push({
        id: `thread-${t.id}`,
        type: "chat",
        title: t.title || `AI Consultation #${t.id}`,
        subtitle: "AI Consultation",
        href: `/preview/chat?threadId=${t.id}`,
        date: t.updatedAt || t.createdAt || null,
        timestamp: new Date(t.updatedAt || t.createdAt || 0).getTime(),
        icon: Bot,
        iconBg: "bg-blue-50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20",
        iconColor: "text-blue-600 dark:text-blue-400",
      });
    });

    // 2. Documents (Drafted Petitions & Agreements)
    (documents.length > 0 ? documents : activitySummary?.recentDocuments || []).forEach((d: any) => {
      items.push({
        id: `doc-${d.id}`,
        type: "draft",
        title: d.title || `Document #${d.id}`,
        subtitle: d.docType || "Court Petition",
        href: `/preview/drafting?docId=${d.id}`,
        date: d.updatedAt || d.createdAt || null,
        timestamp: new Date(d.updatedAt || d.createdAt || 0).getTime(),
        icon: FileText,
        iconBg: "bg-amber-50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/20",
        iconColor: "text-amber-600 dark:text-amber-400",
      });
    });

    // 3. Search History (Judgment & Statute Lookups)
    searchHistory.forEach((s: any) => {
      items.push({
        id: `search-${s.id}`,
        type: "search",
        title: s.query || "Legal Query",
        subtitle: "Judgment Search",
        href: `/preview/judgments?q=${encodeURIComponent(s.query || "")}`,
        date: s.createdAt || null,
        timestamp: new Date(s.createdAt || 0).getTime(),
        icon: Search,
        iconBg: "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20",
        iconColor: "text-[#105B38]",
      });
    });

    return items.sort((a, b) => b.timestamp - a.timestamp);
  }, [threads, documents, activitySummary, searchHistory]);

  const filteredActivity = useMemo(() => {
    if (activityFilter === "all") return unifiedActivity.slice(0, 6);
    return unifiedActivity.filter((item) => item.type === activityFilter).slice(0, 6);
  }, [unifiedActivity, activityFilter]);

  const quickActions = [
    {
      title: "Start Legal Research",
      subtitle: "Find cases & statutes",
      href: "/preview/judgments",
      icon: Search,
      iconBg: "bg-emerald-50 dark:bg-emerald-500/10 text-[#105B38] border-emerald-100 dark:border-emerald-500/20",
    },
    {
      title: "Ask AI Counsel",
      subtitle: "Get legal answers",
      href: "/preview/chat",
      icon: MessageSquare,
      iconBg: "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-500/20",
    },
    {
      title: "Draft Legal Document",
      subtitle: "Create with AI",
      href: "/preview/drafting",
      icon: FileSignature,
      iconBg: "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-500/20",
    },
    {
      title: "View Cause List",
      subtitle: "Latest court schedules",
      href: "/preview/diary",
      icon: CalendarDays,
      iconBg: "bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-100 dark:border-orange-500/20",
    },
    {
      title: "Case Files Vault",
      subtitle: "Manage client matters",
      href: "/preview/cases",
      icon: Briefcase,
      iconBg: "bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-100 dark:border-purple-500/20",
    },
    {
      title: "6-Pillar Matter Audit",
      subtitle: "Analyze & detect risks",
      href: "/preview/cases",
      icon: ShieldCheck,
      iconBg: "bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-100 dark:border-teal-500/20",
    },
    {
      title: "Statutes & Major Codes",
      subtitle: "Compendium & limitation",
      href: "/preview/statutes",
      icon: BookOpen,
      iconBg: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/20",
    },
    {
      title: "Precedent Graphs",
      subtitle: "Treatment & citations",
      href: "/preview/judgments",
      icon: GitBranch,
      iconBg: "bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-100 dark:border-cyan-500/20",
    },
    {
      title: "Court Fee Calculator",
      subtitle: "Stamp & valuation",
      onClick: () => setFeeModalOpen(true),
      icon: Calculator,
      iconBg: "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-500/20",
    },
  ];

  return (
    <PreviewShell className="max-w-7xl mx-auto space-y-6">
      {/* ── Top Section: Greeting + 3 Usage Meters ──────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-6 rounded-2xl bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] shadow-xs">
        {/* Left: Greeting */}
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] dark:text-[#F8FAFC] tracking-tight">
            {greeting}, <span className="text-[#105B38]">{counselName}!</span>
          </h1>
          <p className="text-sm text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">
            Al Wakeelo Legal AI has summarized your daily chambers briefing.
          </p>
        </div>

        {/* Right: 3 Usage Health Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* 1. Monthly Usage */}
          <div
            onClick={() => setUpgradeModalOpen(true)}
            className="p-3.5 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D44] bg-[#F8FAFC] dark:bg-[#0B131E] hover:border-[#105B38]/40 cursor-pointer transition-all min-w-[170px]"
          >
            <div className="flex items-center justify-between text-[11px] font-bold text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] uppercase tracking-wider">
              <span>Monthly Usage</span>
              <span className="text-[#105B38]">{usage?.percentage || 0}% used</span>
            </div>
            <p className="text-lg font-extrabold text-[#0F172A] dark:text-[#F8FAFC] mt-1">
              {usage?.used || 0} <span className="text-xs font-medium text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">/ {usage?.monthlyLimit || "unlimited"}</span>
            </p>
            <div className="w-full h-1.5 bg-[#E2E8F0] rounded-full mt-2 overflow-hidden">
              <div
                className="h-full bg-[#105B38] rounded-full transition-all"
                style={{ width: `${usage?.percentage || 0}%` }}
              />
            </div>
            <p className="text-[10px] text-[#94A3B8] dark:text-[#475569] mt-1.5 truncate">
              {usage?.tierLabel || "Enterprise Plan"}
            </p>
          </div>

          {/* 2. Today Usage */}
          <div className="p-3.5 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D44] bg-[#F8FAFC] dark:bg-[#0B131E] min-w-[170px]">
            <div className="flex items-center justify-between text-[11px] font-bold text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] uppercase tracking-wider">
              <span>Today Usage</span>
              <span className="text-[#105B38]">{usage?.todayPercentage || 0}% used</span>
            </div>
            <p className="text-lg font-extrabold text-[#0F172A] dark:text-[#F8FAFC] mt-1">
              {Math.max(0, 100 - (usage?.todayPercentage || 0))}% <span className="text-xs font-medium text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">left</span>
            </p>
            <div className="w-full h-1.5 bg-[#E2E8F0] rounded-full mt-2 overflow-hidden">
              <div 
                className="h-full bg-[#105B38] rounded-full transition-all" 
                style={{ width: `${usage?.todayPercentage || 0}%` }}
              />
            </div>
            <p className="text-[10px] text-[#94A3B8] dark:text-[#475569] mt-1.5">
              Resets 00:00 PKT
            </p>
          </div>

          {/* 3. Session Limit */}
          <div className="p-3.5 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D44] bg-[#F8FAFC] dark:bg-[#0B131E] min-w-[170px]">
            <div className="flex items-center justify-between text-[11px] font-bold text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] uppercase tracking-wider">
              <span>Session Health</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">Active</span>
            </div>
            <p className="text-lg font-extrabold text-[#0F172A] dark:text-[#F8FAFC] mt-1">
              100% <span className="text-xs font-medium text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">speed</span>
            </p>
            <div className="w-full h-1.5 bg-[#E2E8F0] rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-[#105B38] rounded-full w-full" />
            </div>
            <p className="text-[10px] text-[#94A3B8] dark:text-[#475569] mt-1.5">
              SSE Real-Time Sync
            </p>
          </div>
        </div>
      </div>

      {/* ── Middle: Quick Actions (8 Grid) ────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#105B38] text-white shadow-xs">
            <Scale className="h-4 w-4" />
          </div>
          <h2 className="text-base font-bold text-[#0F172A] dark:text-[#F8FAFC] tracking-tight">
            Quick Actions
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {quickActions.map((action, i) => {
            const Icon = action.icon;
            const content = (
              <div className="group relative flex items-start justify-between p-4 rounded-2xl bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] hover:border-[#105B38]/40 hover:shadow-md transition-all duration-200 cursor-pointer h-full">
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-transform group-hover:scale-105", action.iconBg)}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC] group-hover:text-[#105B38] transition-colors truncate">
                      {action.title}
                    </h3>
                    <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] mt-0.5 truncate">
                      {action.subtitle}
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-[#CBD5E1] group-hover:text-[#105B38] group-hover:translate-x-1 transition-all shrink-0 mt-1" />
              </div>
            );

            if (action.onClick) {
              return (
                <div key={i} onClick={action.onClick}>
                  {content}
                </div>
              );
            }

            return (
              <Link key={i} href={action.href!} className="block">
                {content}
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── Bottom: 3-Column Split (Unified Activity Stream, Today's Court Agenda, Upcoming Deadlines) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Col 1: Unified Activity Stream */}
        <div className="flex flex-col rounded-2xl bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] shadow-xs overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0] dark:border-[#1E2D44]">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#105B38]" />
              <h2 className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC]">Activity Stream</h2>
            </div>
            <Link href="/preview/history" className="text-xs font-semibold text-[#105B38] hover:underline">
              View History
            </Link>
          </div>

          {/* Filter Chips */}
          <div className="flex items-center gap-1.5 px-4 pt-3 pb-2 border-b border-[#F1F5F9] overflow-x-auto">
            {[
              { key: "all" as const, label: "All" },
              { key: "chat" as const, label: "Consultations" },
              { key: "draft" as const, label: "Drafts" },
              { key: "search" as const, label: "Searches" },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActivityFilter(tab.key)}
                className={cn(
                  "px-2.5 py-1 text-[10px] font-bold rounded-lg transition-colors whitespace-nowrap",
                  activityFilter === tab.key
                    ? "bg-[#105B38] text-white shadow-xs"
                    : "bg-[#F1F5F9] dark:bg-[#1E2D44] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#E2E8F0]"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-4 flex-1 overflow-y-auto max-h-[300px] space-y-2.5 custom-scrollbar">
            {filteredActivity.length === 0 ? (
              <div className="py-10 text-center text-xs text-[#94A3B8] dark:text-[#475569] space-y-2">
                <Activity className="w-7 h-7 text-[#CBD5E1] mx-auto" />
                <p>No recent activity under this filter.</p>
              </div>
            ) : (
              filteredActivity.map((item) => {
                const ItemIcon = item.icon;
                const hasQuery = item.href.includes("?");
                const handleClick = () => {
                  if (hasQuery) {
                    window.location.href = item.href;
                  } else {
                    navigate(item.href);
                  }
                };
                return (
                  <div
                    key={item.id}
                    onClick={handleClick}
                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-[#F8FAFC] dark:bg-[#0B131E] border border-transparent hover:border-[#E2E8F0] dark:border-[#1E2D44] transition-all group cursor-pointer"
                  >
                    <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border", item.iconBg, item.iconColor)}>
                      <ItemIcon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] group-hover:text-[#105B38] truncate transition-colors">
                        {item.title}
                      </p>
                      <div className="flex items-center gap-1.5 text-[10px] text-[#94A3B8] dark:text-[#475569] font-mono mt-0.5">
                        <span className="font-semibold text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">{item.subtitle}</span>
                        {item.date && (
                          <>
                            <span>·</span>
                            <span>{new Date(item.date).toLocaleDateString("en-PK", { day: "2-digit", month: "short" })}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-[#CBD5E1] group-hover:text-[#105B38] transition-colors shrink-0" />
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Col 2: Today's Court Agenda */}
        <div className="flex flex-col rounded-2xl bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] shadow-xs overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0] dark:border-[#1E2D44]">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-[#105B38]" />
              <h2 className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC]">Today's Agenda</h2>
              <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-[#F1F5F9] dark:bg-[#1E2D44] text-[#475569]">
                {new Date().toLocaleDateString("en-PK", { day: "numeric", month: "short" })}
              </span>
            </div>
            <Link href="/preview/diary" className="text-xs font-semibold text-[#105B38] hover:underline">
              Go to Diary
            </Link>
          </div>

          <div className="p-4 flex-1 overflow-y-auto max-h-[300px] space-y-2.5 custom-scrollbar">
            {todayAgenda.length === 0 ? (
              <div className="py-8 flex flex-col items-center justify-center text-center space-y-2">
                <CalendarDays className="w-8 h-8 text-[#CBD5E1]" />
                <p className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">No hearings scheduled for today.</p>
                <button
                  type="button"
                  onClick={() => setAddHearingOpen(true)}
                  className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-[#105B38] hover:underline"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Hearing</span>
                </button>
              </div>
            ) : (
              todayAgenda.map((entry: any) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44]"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC] truncate">
                      {entry.caseTitle || entry.title || `Matter #${entry.id}`}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">
                      <span className="font-mono font-semibold text-[#105B38]">
                        {entry.hearingTime || "09:00 AM"}
                      </span>
                      {entry.courtName && <span>· {entry.courtName}</span>}
                    </div>
                  </div>
                  <span
                    className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 border",
                      entry.status === "completed"
                        ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20"
                        : entry.status === "adjourned"
                        ? "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20"
                        : "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20"
                    )}
                  >
                    {entry.status || "Pending"}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Col 3: Upcoming Deadlines & Compliance */}
        <div className="flex flex-col rounded-2xl bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] shadow-xs overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0] dark:border-[#1E2D44]">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <h2 className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC]">Upcoming Deadlines</h2>
              {upcomingDeadlines.length > 0 && (
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20">
                  {upcomingDeadlines.length} Due
                </span>
              )}
            </div>
            <Link href="/preview/cases" className="text-xs font-semibold text-[#105B38] hover:underline">
              Case Vault
            </Link>
          </div>

          <div className="p-4 flex-1 overflow-y-auto max-h-[300px] space-y-2.5 custom-scrollbar">
            {upcomingDeadlines.length === 0 && caseFiles.length === 0 ? (
              <div className="py-8 flex flex-col items-center justify-center text-center space-y-2">
                <Briefcase className="w-8 h-8 text-[#CBD5E1]" />
                <p className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">No pending court deadlines.</p>
                <Link
                  href="/preview/cases"
                  className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-[#105B38] hover:underline"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Matter</span>
                </Link>
              </div>
            ) : upcomingDeadlines.length > 0 ? (
              upcomingDeadlines.slice(0, 5).map((d: any) => {
                const daysLeft = Math.ceil((new Date(d.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                const isOverdue = daysLeft < 0;
                const isUrgent = daysLeft >= 0 && daysLeft <= 3;

                return (
                  <Link
                    key={`deadline-${d.id}`}
                    href={`/preview/cases`}
                    className="flex items-center justify-between p-3 rounded-xl bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] hover:border-[#105B38]/40 hover:bg-white dark:bg-[#131E2E] transition-all group"
                  >
                    <div className="min-w-0 space-y-1">
                      <p className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC] group-hover:text-[#105B38] truncate transition-colors">
                        {d.title || "Court Compliance"}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">
                        <span className="font-semibold text-[#334155] dark:text-[#CBD5E1]">{d.caseTitle || "Litigation Matter"}</span>
                        {d.court && <span>· {d.court}</span>}
                      </div>
                    </div>
                    <span
                      className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 border ml-2",
                        isOverdue
                          ? "bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/20"
                          : isUrgent
                          ? "bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-400 border-amber-200 dark:border-amber-500/20"
                          : "bg-emerald-50 dark:bg-emerald-500/10 text-[#105B38] border-emerald-200 dark:border-emerald-500/20"
                      )}
                    >
                      {isOverdue
                        ? `${Math.abs(daysLeft)}d Overdue`
                        : daysLeft === 0
                        ? "Due Today"
                        : `${daysLeft}d left`}
                    </span>
                  </Link>
                );
              })
            ) : (
              caseFiles.slice(0, 4).map((item: any) => (
                <Link
                  key={`case-${item.id}`}
                  href={`/preview/cases`}
                  className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-[#F8FAFC] dark:bg-[#0B131E] border border-transparent hover:border-[#E2E8F0] dark:border-[#1E2D44] transition-all group"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-100 dark:border-purple-500/20">
                    <Briefcase className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] group-hover:text-[#105B38] truncate transition-colors">
                      {item.title || item.caseNumber || `Matter #${item.id}`}
                    </p>
                    <div className="flex items-center gap-1.5 text-[10px] text-[#94A3B8] dark:text-[#475569] font-mono mt-0.5">
                      <span className="font-semibold text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">Active Matter</span>
                      <span>·</span>
                      <span>{item.court || "High Court"}</span>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-[#CBD5E1] group-hover:text-[#105B38] transition-colors shrink-0" />
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <UpgradePlanModal
        isOpen={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        currentTier={usage?.tier}
      />

      <AddHearingModal
        isOpen={addHearingOpen}
        onClose={() => setAddHearingOpen(false)}
        cases={caseFiles}
        defaultDate={todayStr}
      />

      <CourtFeeCalculatorModal
        isOpen={feeModalOpen}
        onClose={() => setFeeModalOpen(false)}
      />
    </PreviewShell>
  );
};

export default PreviewDashboard;
