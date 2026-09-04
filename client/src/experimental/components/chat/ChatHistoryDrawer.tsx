import React, { useState, useMemo } from "react";
import {
  MessageSquare,
  Plus,
  Search,
  Trash2,
  Clock,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface ThreadItem {
  id: number;
  title: string;
  createdAt?: string;
  updatedAt?: string;
}

interface ChatHistoryDrawerProps {
  threads: ThreadItem[];
  activeThreadId: number | null;
  isOpen: boolean;
  onToggleOpen: () => void;
  onSelectThread: (threadId: number) => void;
  onNewConsultation: () => void;
  onDeleteThread?: (threadId: number) => void;
  isLoading?: boolean;
}

export const ChatHistoryDrawer: React.FC<ChatHistoryDrawerProps> = ({
  threads,
  activeThreadId,
  isOpen,
  onToggleOpen,
  onSelectThread,
  onNewConsultation,
  onDeleteThread,
  isLoading = false,
}) => {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredThreads = useMemo(() => {
    if (!searchQuery.trim()) return threads;
    const q = searchQuery.toLowerCase();
    return threads.filter((t) => (t.title || "").toLowerCase().includes(q));
  }, [threads, searchQuery]);

  const formatTimestamp = (dateStr?: string) => {
    if (!dateStr) return "Recent";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "Recent";
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-PK", { month: "short", day: "numeric" });
  };

  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-white dark:bg-[#131E2E] transition-all duration-300 ease-in-out shrink-0 overflow-hidden relative select-none z-20",
        isOpen ? "w-72 md:w-80 border-r border-[#E2E8F0] dark:border-[#1E2D44] shadow-md" : "w-0 border-none pointer-events-none"
      )}
    >
      {/* Header & Toggle */}
      <div className="p-3.5 border-b border-[#E2E8F0] dark:border-[#1E2D44] flex items-center justify-between gap-2 min-h-[57px] bg-[#F8FAFC] dark:bg-[#0B131E]">
        {isOpen && (
          <>
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-7 w-7 rounded-lg bg-[#105B38]/10 text-[#105B38] border border-[#105B38]/20 dark:border-[#105B38]/40 flex items-center justify-center shrink-0">
                <MessageSquare className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC] uppercase tracking-wider truncate">
                  History
                </h3>
                <span className="text-[10px] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] font-mono">
                  {threads.length} consultations
                </span>
              </div>
            </div>
            <button
              onClick={onToggleOpen}
              className="p-1.5 rounded-lg text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F1F5F9] dark:bg-[#1E2D44] transition-colors"
              title="Close Drawer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      {isOpen && (
        <>
          {/* New Consultation CTA (Inspired by AI Attorney Image 4 green button) */}
          <div className="p-3 border-b border-[#E2E8F0] dark:border-[#1E2D44]">
            <button
              onClick={onNewConsultation}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#105B38] hover:bg-[#0D4A2E] text-white text-xs font-bold transition-all shadow-xs group"
            >
              <Plus className="w-4 h-4 text-white group-hover:rotate-90 transition-transform duration-200" />
              <span>New Chat</span>
            </button>
          </div>

          {/* Search Bar */}
          <div className="p-3 border-b border-[#E2E8F0] dark:border-[#1E2D44]">
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-[#94A3B8] dark:text-[#475569] absolute left-2.5 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search queries..."
                className="w-full bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] rounded-xl pl-8 pr-3 py-1.5 text-xs text-[#0F172A] dark:text-[#F8FAFC] placeholder:text-[#94A3B8] dark:text-[#475569] focus:outline-none focus:border-[#105B38] transition-colors shadow-xs"
              />
            </div>
          </div>

          {/* Thread List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin scrollbar-thumb-[#CBD5E1]">
            {isLoading ? (
              <div className="py-8 text-center text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] space-y-2">
                <div className="w-5 h-5 border-2 border-[#E2E8F0] dark:border-[#1E2D44] border-t-[#105B38] rounded-full animate-spin mx-auto" />
                <p>Loading consultation history...</p>
              </div>
            ) : filteredThreads.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] space-y-1.5 px-4">
                <p className="font-medium text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">
                  {searchQuery ? "No matching consultations" : "Your chat history is empty."}
                </p>
                <p className="text-[11px] text-[#94A3B8] dark:text-[#475569] leading-relaxed">
                  {searchQuery
                    ? "Try adjusting your search terms."
                    : "Ask your first legal query to begin."}
                </p>
              </div>
            ) : (
              filteredThreads.map((thread) => {
                const isActive = thread.id === activeThreadId;
                return (
                  <div
                    key={thread.id}
                    onClick={() => onSelectThread(thread.id)}
                    className={cn(
                      "group flex items-start justify-between gap-2 p-2.5 rounded-xl text-xs cursor-pointer transition-all border",
                      isActive
                        ? "bg-emerald-50/8 dark:bg-emerald-500/100 dark:bg-emerald-500/10 text-[#105B38] border-emerald-200 dark:border-emerald-500/20 shadow-xs font-semibold"
                        : "text-[#475569] border-transparent hover:bg-[#F8FAFC] dark:bg-[#0B131E] hover:text-[#0F172A] dark:text-[#F8FAFC]"
                    )}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="font-medium truncate text-xs leading-snug">
                        {thread.title || "Untitled Consultation"}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-[#94A3B8] dark:text-[#475569] font-mono">
                        <span className="flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {formatTimestamp(thread.createdAt || thread.updatedAt)}
                        </span>
                        {isActive && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#105B38]/10 text-[#105B38] font-bold">
                            Active
                          </span>
                        )}
                      </div>
                    </div>

                    {onDeleteThread && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm("Delete this consultation history?")) {
                            onDeleteThread(thread.id);
                          }
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[#F5F4F2] dark:bg-[#0B131E] text-[#999999] dark:text-[#475569] hover:text-[#1A1A1A] dark:text-[#F8FAFC] transition-all"
                        title="Delete Consultation"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Badge */}
          <div className="p-3 border-t border-[#E5E4E2] dark:border-[#1E2D44] bg-white dark:bg-[#131E2E] text-[11px] text-[#666666] dark:text-[#94A3B8] dark:text-[#475569] flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[#666666] dark:text-[#94A3B8] dark:text-[#475569] font-mono text-[10px]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#1A1A1A] dark:text-[#F8FAFC]" />
              <span>Privileged & Encrypted</span>
            </div>
            <span className="text-[10px] text-[#999999] dark:text-[#475569] font-mono">Chambers Vault</span>
          </div>
        </>
      )}

      {!isOpen && (
        <div className="flex-1 flex flex-col items-center py-4 space-y-4">
          <button
            onClick={onNewConsultation}
            className="p-2 rounded-lg bg-white dark:bg-[#131E2E] text-[#1A1A1A] dark:text-[#F8FAFC] hover:bg-[#F5F4F2] dark:bg-[#0B131E] border border-[#E5E4E2] dark:border-[#1E2D44] transition-colors shadow-sm"
            title="New Consultation"
          >
            <Plus className="w-4 h-4" />
          </button>
          <div className="w-6 h-[1px] bg-[#E5E4E2]" />
          <div
            className="text-[10px] text-[#999999] dark:text-[#475569] font-mono uppercase tracking-widest -rotate-90 origin-center whitespace-nowrap mt-8"
            style={{ width: "80px" }}
          >
            History
          </div>
        </div>
      )}
    </aside>
  );
};
