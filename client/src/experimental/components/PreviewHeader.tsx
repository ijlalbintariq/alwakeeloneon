import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  Search,
  Moon,
  Sun,
  ShieldCheck,
  Scale,
  Menu,
  Clock,
  ChevronRight,
  Bell,
  BookOpen,
} from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

interface PreviewHeaderProps {
  onToggleSidebar?: () => void;
  onOpenCommandPalette?: () => void;
  onOpenReference?: () => void;
  className?: string;
}

const ROUTE_TITLES: Record<string, { module: string; page: string }> = {
  "/preview": { module: "Chambers", page: "Chambers Dashboard" },
  "/preview/dashboard": { module: "Chambers", page: "Chambers Dashboard" },
  "/preview/chat": { module: "AI Intelligence", page: "Al Wakeelo AI Engine" },
  "/preview/drafting": { module: "Drafting Studio", page: "Litigation & Contract Studio" },
  "/preview/judgments": { module: "Precedent Research", page: "Judgments & Citation Graphs" },
  "/preview/cases": { module: "Matter Management", page: "Case Files & 6-Pillar Compliance" },
  "/preview/diary": { module: "Court Diary", page: "Daily Diary & Cause List" },
  "/preview/settings": { module: "Chambers", page: "Profile & Settings" },
  "/preview/profile": { module: "Chambers", page: "Advocate Profile" },
  "/preview/knowledge-vault": { module: "Legal Vaults", page: "Chambers Knowledge Vault" },
  "/preview/case-documents": { module: "Legal Vaults", page: "Case Documents & Records" },
  "/preview/bookmarks": { module: "Legal Vaults", page: "Saved Bookmarks & Citations" },
  "/preview/history": { module: "Audit & Logs", page: "Search & Query History" },
  "/preview/organization": { module: "Chambers", page: "Organization & Collaboration" },
  "/preview/document-analyzer": { module: "Risk & Compliance", page: "Document Analyzer & Redlines" },
  "/preview/statutes": { module: "Statutory Reference", page: "Statutes, Major Codes & Guides" },
  "/preview/reference": { module: "Statutory Reference", page: "Statutes, Major Codes & Guides" },
  "/preview/judges": { module: "Judicial Intelligence", page: "Judges Directory & Bench Profiles" },
  "/preview/most-cited": { module: "Precedent Intelligence", page: "Most Cited Precedents Leaderboard" },
};

export const PreviewHeader: React.FC<PreviewHeaderProps> = ({
  onToggleSidebar,
  onOpenCommandPalette,
  onOpenReference,
  className,
}) => {
  const [location, setLocation] = useLocation();
  const { resolvedTheme, toggle: toggleTheme } = useTheme();
  const { user } = useAuth();
  const [currentTime, setCurrentTime] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      try {
        const timeStr = new Intl.DateTimeFormat("en-PK", {
          timeZone: "Asia/Karachi",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        }).format(new Date());
        setCurrentTime(timeStr);
      } catch {
        setCurrentTime(new Date().toLocaleTimeString());
      }
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const routeInfo = ROUTE_TITLES[location] || {
    module: "Workstation",
    page: "Legal Workspace",
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b px-4 transition-colors",
        "bg-white/95 backdrop-blur-sm border-[#E2E8F0] text-[#0F172A]",
        className
      )}
    >
      {/* Left: Sidebar Toggle + Breadcrumbs + Bench Session */}
      <div className="flex items-center gap-3">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="p-1.5 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors md:hidden"
            aria-label="Toggle navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        {/* Breadcrumb Trail */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-[#64748B] font-medium hidden sm:inline">
            {routeInfo.module}
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-[#CBD5E1] hidden sm:inline" />
          <span className="text-[#0F172A] font-bold">
            {routeInfo.page}
          </span>
        </div>
      </div>

      {/* Center: Clean Search Bar */}
      <div className="flex-1 max-w-sm mx-4 hidden md:block">
        <button
          onClick={onOpenCommandPalette}
          className="w-full flex items-center justify-between px-3.5 py-1.5 rounded-xl bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] text-[#64748B] text-xs shadow-xs transition-all"
        >
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-[#105B38]" />
            <span>Search statutes, cases & drafts...</span>
          </div>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white text-[10px] font-mono text-[#475569] border border-[#E2E8F0] shadow-xs">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right: Clock & Quick Reference */}
      <div className="flex items-center gap-3">
        {/* Mobile Search Button */}
        <button
          onClick={onOpenCommandPalette}
          className="p-1.5 rounded-lg text-[#64748B] hover:text-[#0F172A] transition-colors md:hidden"
          aria-label="Open search"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Legal Reference Shelf */}
        <button
          onClick={() => setLocation("/preview/statutes")}
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#105B38]/10 hover:bg-[#105B38]/15 text-[#105B38] text-xs font-semibold border border-[#105B38]/20 transition-all"
          title="Statutes, Major Codes, Limitation Calculator & Courts Directory"
          aria-label="Open legal reference compendium"
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Statutes & Codes</span>
        </button>

        {/* PKT Clock */}
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-[#475569] font-mono bg-[#F1F5F9] px-2.5 py-1 rounded-lg border border-[#E2E8F0]">
          <Clock className="w-3.5 h-3.5 text-[#105B38]" />
          <span>{currentTime || "10:00 AM"} PKT</span>
        </div>
      </div>
    </header>
  );
};
