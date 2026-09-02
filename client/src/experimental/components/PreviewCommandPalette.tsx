import React, { useEffect, useState, useMemo } from "react";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import {
  Search,
  LayoutDashboard,
  Bot,
  FileSignature,
  Gavel,
  Briefcase,
  CalendarDays,
  Sparkles,
  BookOpen,
  ArrowRight,
  FileText,
  Clock,
  CheckCircle2,
  Database,
  Bookmark,
  History,
  Building2,
  FolderOpen,
  FileSearch,
  User,
  Sliders,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CommandItem {
  id: string;
  category: "navigation" | "precedents" | "templates" | "ai";
  title: string;
  subtitle?: string;
  badge?: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
}

interface PreviewCommandPaletteProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export const PreviewCommandPalette: React.FC<PreviewCommandPaletteProps> = ({
  isOpen,
  onOpenChange,
}) => {
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const commandItems: CommandItem[] = useMemo(
    () => [
      // Navigation
      {
        id: "nav-dashboard",
        category: "navigation",
        title: "Go to Chambers Dashboard",
        subtitle: "Overview, upcoming matters, quota metrics",
        icon: LayoutDashboard,
        action: () => setLocation("/preview/dashboard"),
      },
      {
        id: "nav-chat",
        category: "navigation",
        title: "Go to Al Wakeelo AI Engine",
        subtitle: "RAG citation assistant with SSE streaming",
        badge: "Live SSE",
        icon: Bot,
        action: () => setLocation("/preview/chat"),
      },
      {
        id: "nav-analyzer",
        category: "navigation",
        title: "Go to Document Analyzer",
        subtitle: "Order VII R.11 CPC & statutory risk scanner with redlines",
        badge: "Risk Scanner",
        icon: FileSearch,
        action: () => setLocation("/preview/document-analyzer"),
      },
      {
        id: "nav-drafting",
        category: "navigation",
        title: "Go to Legal Drafting Studio",
        subtitle: "Court petitions & commercial contracts",
        icon: FileSignature,
        action: () => setLocation("/preview/drafting"),
      },
      {
        id: "nav-judgments",
        category: "navigation",
        title: "Go to Precedent Research & Judgments",
        subtitle: "600,000+ judgments & precedent citation graphs",
        icon: Gavel,
        action: () => setLocation("/preview/judgments"),
      },
      {
        id: "nav-statutes",
        category: "navigation",
        title: "Go to Statutes, Major Codes & Guides",
        subtitle: "Pakistani statutory compendium, Limitation Act 1908 & Court Fees",
        badge: "7 Domains",
        icon: BookOpen,
        action: () => setLocation("/preview/statutes"),
      },
      {
        id: "nav-vault",
        category: "navigation",
        title: "Go to Knowledge Vault",
        subtitle: "Statutes, Precedents & Vector Semantic Library",
        badge: "1536-D Vectors",
        icon: Database,
        action: () => setLocation("/preview/knowledge-vault"),
      },
      {
        id: "nav-cases",
        category: "navigation",
        title: "Go to Case Files & Compliance",
        subtitle: "Dossiers, 6-pillar compliance audit & documents vault",
        icon: Briefcase,
        action: () => setLocation("/preview/cases"),
      },
      {
        id: "nav-diary",
        category: "navigation",
        title: "Go to Daily Diary",
        subtitle: "Court hearings & calendar cause lists",
        icon: CalendarDays,
        action: () => setLocation("/preview/diary"),
      },
      {
        id: "nav-bookmarks",
        category: "navigation",
        title: "Go to Bookmarks Vault",
        subtitle: "Saved Pakistani authorities & ratio decidendi notes",
        icon: Bookmark,
        action: () => setLocation("/preview/bookmarks"),
      },
      {
        id: "nav-history",
        category: "navigation",
        title: "Go to Search History",
        subtitle: "Audit trail, telemetry metrics & 1-click query re-runs",
        icon: History,
        action: () => setLocation("/preview/history"),
      },
      {
        id: "nav-org",
        category: "navigation",
        title: "Go to Chamber Collaboration & Roster",
        subtitle: "Counsel seats, matter allocation & activity stream",
        badge: "Enterprise",
        icon: Building2,
        action: () => setLocation("/preview/organization"),
      },
      {
        id: "nav-settings",
        category: "navigation",
        title: "Go to Chambers Profile & Settings",
        subtitle: "Advocate Bar ID, AI models, MCP tokens & 2FA security",
        icon: Sliders,
        action: () => setLocation("/preview/settings"),
      },

      // Precedents
      {
        id: "prec-1",
        category: "precedents",
        title: "2024 SCMR 1085 — Supreme Court Landmark Precedent",
        subtitle: "Supreme Court of Pakistan · Muhammad Ramzan vs Khizar Hayat",
        badge: "Supreme Court",
        icon: Gavel,
        action: () => setLocation("/preview/judgments?q=2024+SCMR+1085"),
      },
      {
        id: "prec-2",
        category: "precedents",
        title: "2026 LHC 2169 — Lahore High Court Ruling",
        subtitle: "Lahore High Court · Muhammad Zubair vs M Tahir Shafique",
        badge: "High Court",
        icon: Gavel,
        action: () => setLocation("/preview/judgments?q=2026+LHC+2169"),
      },
      {
        id: "prec-3",
        category: "precedents",
        title: "2026 CLD 569 — Corporate & Banking Jurisprudence",
        subtitle: "High Court of Sindh · Bank Alfalah Limited vs Federation of Pakistan",
        badge: "Corporate",
        icon: Gavel,
        action: () => setLocation("/preview/judgments?q=2026+CLD+569"),
      },

      // Templates
      {
        id: "tmpl-1",
        category: "templates",
        title: "Constitutional Writ Petition (Art. 199)",
        subtitle: "Standard High Court format with memo of parties & index",
        badge: "High Court",
        icon: FileText,
        action: () => setLocation("/preview/drafting?template=writ_199"),
      },
      {
        id: "tmpl-2",
        category: "templates",
        title: "Post-Arrest Bail Petition u/s 497 Cr.P.C.",
        subtitle: "Grounds for statutory delay and lack of independent witness",
        badge: "Criminal",
        icon: FileText,
        action: () => setLocation("/preview/drafting?template=bail_497"),
      },
      {
        id: "tmpl-3",
        category: "templates",
        title: "Commercial Non-Disclosure Agreement (NDA)",
        subtitle: "Pakistani Contract Act 1872 compliant bilateral agreement",
        badge: "Corporate",
        icon: FileText,
        action: () => setLocation("/preview/drafting?template=nda_corp"),
      },

      // AI Legal Prompts
      {
        id: "ai-1",
        category: "ai",
        title: "Check 6-Pillar Matter Compliance Status",
        subtitle: "Audit Wakalatnama, CNIC verification, Court Fee, Care Letter",
        badge: "AI Action",
        icon: Sparkles,
        action: () => setLocation("/preview/cases?action=check_compliance"),
      },
      {
        id: "ai-2",
        category: "ai",
        title: "Draft Urgent Interim Injunction Grounds",
        subtitle: "Generate prima facie case, balance of convenience, irreparable loss",
        badge: "AI Action",
        icon: Sparkles,
        action: () => setLocation("/preview/chat?prompt=Draft+urgent+interim+stay+application+under+Order+39+Rule+1+2+CPC"),
      },
    ],
    [setLocation]
  );

  const filteredItems = useMemo(() => {
    if (!query.trim()) return commandItems;
    const lowerQuery = query.toLowerCase();
    return commandItems.filter(
      (item) =>
        item.title.toLowerCase().includes(lowerQuery) ||
        (item.subtitle && item.subtitle.toLowerCase().includes(lowerQuery)) ||
        (item.badge && item.badge.toLowerCase().includes(lowerQuery))
    );
  }, [commandItems, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keyboard shortcut listener for Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onOpenChange(!isOpen);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onOpenChange]);

  const handleSelect = (item: CommandItem) => {
    item.action();
    onOpenChange(false);
    setQuery("");
  };

  const handleDialogKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (filteredItems.length || 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % (filteredItems.length || 1));
    } else if (e.key === "Enter" && filteredItems[selectedIndex]) {
      e.preventDefault();
      handleSelect(filteredItems[selectedIndex]);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl p-0 gap-0 overflow-hidden bg-white text-[#0F172A] border border-[#E2E8F0] shadow-xl rounded-2xl"
        onKeyDown={handleDialogKeyDown}
      >
        {/* Search Header */}
        <div className="flex items-center px-4 border-b border-[#E2E8F0] bg-[#F8FAFC]">
          <Search className="w-4 h-4 text-[#105B38] shrink-0 mr-3" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command, precedent citation, template, or AI action..."
            className="w-full h-12 bg-transparent text-sm text-[#0F172A] placeholder:text-[#64748B] focus:outline-none font-sans"
            autoFocus
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="text-xs text-[#64748B] hover:text-[#0F172A] font-mono px-1.5 py-0.5 rounded bg-white border border-[#E2E8F0]"
            >
              Clear
            </button>
          )}
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-2 space-y-1">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-[#64748B] text-xs font-mono">
              No matching commands or precedents found for &quot;{query}&quot;
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={cn(
                    "flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all text-xs",
                    isSelected
                      ? "bg-emerald-50/80 text-[#0F172A] border border-[#105B38]/30"
                      : "text-[#334155] hover:bg-[#F8FAFC] border border-transparent"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border",
                        isSelected
                          ? "bg-[#105B38] text-white border-[#105B38]"
                          : "bg-[#F8FAFC] text-[#105B38] border-[#E2E8F0]"
                      )}
                    >
                      <item.icon className="h-3.5 w-3.5" />
                    </div>

                    <div className="flex flex-col min-w-0">
                      <span className="font-semibold text-[#0F172A] truncate flex items-center gap-2">
                        {item.title}
                        {item.badge && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-emerald-50 text-[#105B38] border border-emerald-200">
                            {item.badge}
                          </span>
                        )}
                      </span>
                      {item.subtitle && (
                        <span className="text-[11px] text-[#64748B] truncate">
                          {item.subtitle}
                        </span>
                      )}
                    </div>
                  </div>

                  <ArrowRight
                    className={cn(
                      "w-3.5 h-3.5 shrink-0 transition-transform",
                      isSelected ? "text-[#105B38] translate-x-0.5" : "text-[#94A3B8]"
                    )}
                  />
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-[#E2E8F0] bg-[#F8FAFC] text-[10px] font-mono text-[#64748B]">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-[#E2E8F0] text-[#0F172A] mr-1">↑</kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-[#E2E8F0] text-[#0F172A] mr-1">↓</kbd>
              Navigate
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-[#E2E8F0] text-[#0F172A] mr-1">↵</kbd>
              Select
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-[#E2E8F0] text-[#0F172A] mr-1">ESC</kbd>
              Close
            </span>
          </div>
          <span className="text-[#105B38] font-bold">Al Wakeelo Legal Workstation</span>
        </div>
      </DialogContent>
    </Dialog>
  );
};
