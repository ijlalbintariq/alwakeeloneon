import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import {
  Scale,
  LayoutDashboard,
  Bot,
  FileSignature,
  Gavel,
  Briefcase,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Shield,
  BookOpen,
  FileSearch,
  Database,
  Bookmark,
  History,
  Building2,
  FolderOpen,
  LogOut,
  Users,
  Trophy,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

interface PreviewSidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  onOpenReference?: () => void;
  className?: string;
}

interface NavItem {
  id: string;
  title: string;
  href?: string;
  onClick?: () => void;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

export const PreviewSidebar: React.FC<PreviewSidebarProps> = ({
  collapsed,
  onToggleCollapse,
  onOpenReference,
  className,
}) => {
  const [location] = useLocation();
  const { user } = useAuth();
  const { data: usage } = useQuery<{ tier: string; tierLabel: string; used: number; monthlyLimit: number; percentage: number; remaining: number }>({
    queryKey: ["/api/usage"],
  });

  const quotaAvailable = Math.max(0, 100 - (usage?.percentage || 0));
  const tierDisplay = usage?.tierLabel ? `Chambers ${usage.tierLabel}` : "Chambers Enterprise";

  const navigationGroups: NavGroup[] = [
    {
      label: "Workspace",
      items: [
        {
          id: "dashboard",
          title: "Chambers Dashboard",
          href: "/preview/dashboard",
          icon: LayoutDashboard,
          description: "Docket, quotas & metrics",
        },
        {
          id: "chat",
          title: "Al Wakeelo AI Engine",
          href: "/preview/chat",
          icon: Bot,
          description: "RAG precedent assistant",
        },
        {
          id: "analyzer",
          title: "Document Analyzer",
          href: "/preview/document-analyzer",
          icon: FileSearch,
          description: "O7 R11 & Risk audit scanner",
        },
      ],
    },
    {
      label: "Litigation & Research",
      items: [
        {
          id: "drafting",
          title: "Legal Drafting Studio",
          href: "/preview/drafting",
          icon: FileSignature,
          description: "Pakistani court petitions & launchpad",
        },
        {
          id: "judgments",
          title: "Judgment Precedent Graph",
          href: "/preview/judgments",
          icon: Gavel,
          description: "Precedent network & citations",
        },
        {
          id: "vault",
          title: "Knowledge Vault",
          href: "/preview/knowledge-vault",
          icon: Database,
          description: "Precedent & statutory vector library",
        },
        {
          id: "bookmarks",
          title: "Bookmarks Vault",
          href: "/preview/bookmarks",
          icon: Bookmark,
          description: "Saved Pakistani authorities",
        },
        {
          id: "statutes",
          title: "Statutes & Major Codes",
          href: "/preview/statutes",
          icon: BookOpen,
          description: "Major Codes, Limitation & Court Fees",
        },
        {
          id: "judges",
          title: "Judges Directory",
          href: "/preview/judges",
          icon: Users,
          description: "Bench profiles & jurisprudence history",
        },
        {
          id: "most-cited",
          title: "Most Cited Precedents",
          href: "/preview/most-cited",
          icon: Trophy,
          description: "Top precedents by citation count",
        },
      ],
    },
    {
      label: "Practice & Records",
      items: [
        {
          id: "cases",
          title: "Case Files & Compliance",
          href: "/preview/cases",
          icon: Briefcase,
          description: "Matter management, compliance & documents vault",
        },
        {
          id: "diary",
          title: "Daily Diary & Cause List",
          href: "/preview/diary",
          icon: CalendarDays,
          description: "Court hearings & schedule",
        },
        {
          id: "history",
          title: "Search & Query History",
          href: "/preview/history",
          icon: History,
          description: "Audit trail & 1-click re-runs",
        },
        ...(user?.subscriptionTier === "chamber" || user?.subscriptionTier === "enterprise" || user?.isAdmin
          ? [
              {
                id: "organization",
                title: "Chamber Collaboration",
                href: "/preview/organization",
                icon: Building2,
                description: "Counsel roster & matter allocation",
              },
            ]
          : []),
      ],
    },
    ...(user?.isAdmin
      ? [
          {
            label: "Chamber Administration",
            items: [
              {
                id: "admin",
                title: "Admin Control",
                href: "/admin",
                icon: Shield,
                description: "Platform & system management",
              },
            ],
          },
        ]
      : []),
  ];

  return (
    <aside
      aria-label="Experimental Workstation Navigation Sidebar"
      className={cn(
        "relative flex flex-col border-r transition-all duration-300 ease-in-out select-none",
        "bg-white border-[#E2E8F0] text-[#0F172A]",
        collapsed ? "w-16" : "w-64",
        className
      )}
    >
      {/* Brand Header */}
      <div
        className={cn(
          "flex h-16 items-center border-b border-[#E2E8F0] transition-all",
          collapsed ? "justify-center px-2" : "justify-between px-4"
        )}
      >
        {!collapsed ? (
          <>
            <Link href="/preview/dashboard" className="flex items-center gap-2.5 overflow-hidden group">
              <img src="/logo.svg" alt="Al Wakeelo" className="h-9 w-9 shrink-0 object-contain transition-transform group-hover:scale-105" />
              <div className="flex flex-col leading-tight">
                <span className="text-base font-bold tracking-tight text-[#0F172A]">
                  Al Wakeelo
                </span>
                <span className="text-xs font-bold text-[#105B38] tracking-wide">
                  Legal AI Chambers
                </span>
              </div>
            </Link>

            <button
              type="button"
              onClick={onToggleCollapse}
              className="hidden md:flex h-7 w-7 items-center justify-center rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors"
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] text-[#64748B] hover:text-[#105B38] transition-colors shadow-xs"
            title="Expand sidebar"
            aria-label="Expand sidebar"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-2 py-4 space-y-5 custom-scrollbar">
        {navigationGroups.map((group) => (
          <div key={group.label} className="space-y-1">
            {!collapsed && (
              <div className="px-3 py-1 text-xs font-bold tracking-wider text-[#64748B] uppercase">
                {group.label}
              </div>
            )}
            <nav className="space-y-0.5">
              {group.items.map((item) => {
                const isActive =
                  item.href &&
                  (location === item.href ||
                    (item.href === "/preview/dashboard" && location === "/preview"));

                const content = (
                  <>
                    <item.icon
                      className={cn(
                        "h-4 w-4 shrink-0 transition-colors",
                        isActive ? "text-white" : "text-[#64748B] group-hover:text-[#0F172A]"
                      )}
                    />

                    {!collapsed && (
                      <span className="flex-1 truncate min-w-0 font-medium">
                        {item.title}
                      </span>
                    )}
                  </>
                );

                const itemClasses = cn(
                  "group flex items-center rounded-xl py-2.5 text-xs font-medium transition-all w-full text-left",
                  collapsed ? "justify-center px-2" : "gap-3 px-3",
                  isActive
                    ? "bg-[#105B38] text-white font-semibold shadow-xs"
                    : "text-[#334155] hover:text-[#0F172A] hover:bg-[#F1F5F9]"
                );

                if (item.onClick) {
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={item.onClick}
                      title={collapsed ? item.title : undefined}
                      className={itemClasses}
                    >
                      {content}
                    </button>
                  );
                }

                return (
                  <Link
                    key={item.id}
                    href={item.href || "#"}
                    title={collapsed ? item.title : undefined}
                    className={itemClasses}
                  >
                    {content}
                  </Link>
                );
              })}
            </nav>
          </div>
        ))}
      </div>

      {/* Chambers Status & AI Quota Pill */}
      {!collapsed ? (
        <div className="px-3 py-2 border-t border-[#E2E8F0] bg-white">
          <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-1.5 font-bold text-[#0F172A]">
                <Shield className="w-3.5 h-3.5 text-[#105B38]" />
                <span>{tierDisplay}</span>
              </div>
              <span className="text-[10px] font-mono font-bold text-[#105B38]">Active</span>
            </div>

            {/* Quota Progress Bar */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] text-[#64748B]">
                <span>AI Quota</span>
                <span className="font-semibold text-[#0F172A]">{quotaAvailable}% Available</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-[#E2E8F0] overflow-hidden">
                <div className="h-full bg-[#105B38] rounded-full transition-all" style={{ width: `${quotaAvailable}%` }} />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Footer Profile & Sign Out */}
      <div className="p-2 border-t border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between gap-1">
        <Link
          href="/preview/settings"
          title="Chambers Profile & Settings"
          className={cn(
            "flex items-center gap-2.5 p-1.5 rounded-xl text-xs hover:bg-[#F1F5F9] transition-colors group cursor-pointer flex-1 min-w-0",
            collapsed ? "justify-center" : "justify-start"
          )}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#105B38]/10 border border-[#105B38]/20 text-xs font-bold text-[#105B38] group-hover:bg-[#105B38] group-hover:text-white transition-colors">
              {user?.firstName?.[0] || user?.email?.[0]?.toUpperCase() || "U"}
            </div>
            {!collapsed && (
              <div className="flex flex-col min-w-0 text-left">
                <span className="font-semibold text-[#0F172A] truncate text-xs group-hover:text-[#105B38] transition-colors">
                  {[user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email || "Advocate"}
                </span>
                <span className="text-[10px] text-[#64748B] truncate">
                  {designation}
                </span>
              </div>
            )}
          </div>
        </Link>

        {!collapsed && (
          <button
            type="button"
            onClick={async () => {
              try {
                await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
              } catch {}
              localStorage.removeItem("alwakeelo_preview_auth");
              localStorage.removeItem("alwakeelo_preview_user");
              window.location.href = "/auth";
            }}
            title="Sign Out"
            className="p-2 rounded-xl text-[#64748B] hover:text-rose-600 hover:bg-rose-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>
    </aside>
  );
};

export default PreviewSidebar;
