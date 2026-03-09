import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Clock3,
  FileText,
  Gavel,
  History,
  Loader2,
  MessageSquareText,
  RefreshCw,
  Scale,
  Search,
  X,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { LegalMarkdown } from "@/components/legal-markdown";
import { parseReferences, ReferenceCards } from "@/components/reference-cards";

interface HistoryItem {
  id: number;
  type: "judgment" | "statute" | "chat" | "draft" | "contract" | string;
  query: string;
  createdAt: string;
}

interface ThreadItem {
  id: number;
  title: string;
  createdAt: string;
  shareToken?: string | null;
}

interface ThreadMessage {
  id: number;
  role: string;
  content: string;
  createdAt: string;
}

type ActivityFilter = "all" | "statutes" | "drafts" | "chats";

interface ActivityItem {
  id: string;
  source: "history" | "thread";
  kind: "judgment" | "statute" | "chat" | "draft" | "contract";
  title: string;
  createdAt: string;
  historyId?: number;
  threadId?: number;
}

const LEGAL_DRAFT_AUTOSAVE_KEY = "legal-drafting-workspace-v2";
const CONTRACT_AUTOSAVE_KEY = "contract-drafting-workspace-v1";

function toDate(value: string): Date {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date(0) : d;
}

function formatRelative(value: string): string {
  const date = toDate(value);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour > 1 ? "s" : ""} ago`;

  return date.toLocaleString();
}

function bucketForDate(value: string): string {
  const date = toDate(value);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

  if (target >= todayStart) return "Today";
  if (target >= yesterdayStart) return "Yesterday";
  return date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

function typeMeta(kind: ActivityItem["kind"]) {
  switch (kind) {
    case "judgment":
      return {
        label: "Case Law Search",
        action: "Re-run",
        icon: Gavel,
        iconClass: "bg-amber-500/20 text-amber-400",
      };
    case "statute":
      return {
        label: "Statute Search",
        action: "Re-run",
        icon: Scale,
        iconClass: "bg-amber-500/20 text-amber-400",
      };
    case "draft":
      return {
        label: "Drafting Assistant",
        action: "Open",
        icon: FileText,
        iconClass: "bg-blue-500/20 text-blue-400",
      };
    case "contract":
      return {
        label: "Contract Drafting",
        action: "Open",
        icon: FileText,
        iconClass: "bg-cyan-500/20 text-cyan-400",
      };
    case "chat":
    default:
      return {
        label: "Client Chat",
        action: "Resume",
        icon: MessageSquareText,
        iconClass: "bg-emerald-500/20 text-emerald-400",
      };
  }
}

export default function HistoryPage() {
  const [, setLocation] = useLocation();
  const { data: history = [], isLoading: historyLoading, isError: historyError } = useQuery<HistoryItem[]>({
    queryKey: ["/api/search-history"],
  });
  const { data: threads = [], isLoading: threadsLoading } = useQuery<ThreadItem[]>({ queryKey: ["/api/threads"] });

  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [searchText, setSearchText] = useState("");
  const [selectedThread, setSelectedThread] = useState<ThreadItem | null>(null);
  const [threadMessages, setThreadMessages] = useState<ThreadMessage[] | null>(null);
  const [loadingThread, setLoadingThread] = useState(false);

  const activities = useMemo<ActivityItem[]>(() => {
    const fromHistory: ActivityItem[] = history
      .filter((h) => ["judgment", "statute", "chat", "draft", "contract"].includes(h.type))
      .map((h) => ({
        id: `h-${h.id}`,
        source: "history",
        kind: h.type as ActivityItem["kind"],
        title: h.query,
        createdAt: h.createdAt,
        historyId: h.id,
      }));

    const fromThreads: ActivityItem[] = threads.map((t) => ({
      id: `t-${t.id}`,
      source: "thread",
      kind: "chat",
      title: t.title || "Untitled Consultation",
      createdAt: t.createdAt,
      threadId: t.id,
    }));

    return [...fromHistory, ...fromThreads].sort(
      (a, b) => toDate(b.createdAt).getTime() - toDate(a.createdAt).getTime(),
    );
  }, [history, threads]);

  const filteredActivities = useMemo(() => {
    const q = searchText.trim().toLowerCase();

    return activities.filter((item) => {
      const filterOk =
        filter === "all" ||
        (filter === "statutes" && (item.kind === "statute" || item.kind === "judgment")) ||
        (filter === "drafts" && (item.kind === "draft" || item.kind === "contract")) ||
        (filter === "chats" && item.kind === "chat");

      const queryOk = !q || item.title.toLowerCase().includes(q) || typeMeta(item.kind).label.toLowerCase().includes(q);

      return filterOk && queryOk;
    });
  }, [activities, filter, searchText]);

  const groupedActivities = useMemo(() => {
    const map = new Map<string, ActivityItem[]>();
    for (const item of filteredActivities) {
      const bucket = bucketForDate(item.createdAt);
      const arr = map.get(bucket) || [];
      arr.push(item);
      map.set(bucket, arr);
    }
    return Array.from(map.entries());
  }, [filteredActivities]);

  const openThread = async (thread: ThreadItem) => {
    setSelectedThread(thread);
    setLoadingThread(true);
    try {
      const res = await apiRequest("GET", `/api/threads/${thread.id}`);
      const data = await res.json();
      setThreadMessages(data.messages || []);
    } catch {
      setThreadMessages([]);
    } finally {
      setLoadingThread(false);
    }
  };

  const handleAction = async (item: ActivityItem) => {
    if (item.source === "thread" && item.threadId) {
      const thread = threads.find((t) => t.id === item.threadId);
      if (thread) {
        await openThread(thread);
      }
      return;
    }

    const encoded = encodeURIComponent(item.title);

    if (item.kind === "judgment") {
      setLocation(`/judgments?tab=keywords&q=${encoded}`);
      return;
    }
    if (item.kind === "statute") {
      setLocation(`/statute-search?q=${encoded}`);
      return;
    }
    if (item.kind === "draft") {
      localStorage.setItem(LEGAL_DRAFT_AUTOSAVE_KEY, item.title);
      setLocation("/legal-drafting");
      return;
    }
    if (item.kind === "contract") {
      localStorage.setItem(CONTRACT_AUTOSAVE_KEY, item.title);
      setLocation("/contract-drafting");
      return;
    }

    setLocation(`/al-wakeelo?q=${encoded}`);
  };

  const counts = useMemo(
    () => ({
      all: activities.length,
      statutes: activities.filter((a) => a.kind === "statute" || a.kind === "judgment").length,
      drafts: activities.filter((a) => a.kind === "draft" || a.kind === "contract").length,
      chats: activities.filter((a) => a.kind === "chat").length,
    }),
    [activities],
  );

  return (
    <section
      className="h-[calc(100dvh-96px)] md:h-[calc(100vh-120px)] rounded-xl md:rounded-[1.8rem] overflow-hidden border border-[hsl(var(--preview-border))] bg-[#181611] text-slate-100 fade-in"
      data-testid="history-page"
    >
      <div className="flex h-full min-h-0 flex-col">
        <header className="shrink-0 border-b border-[#3a3327] bg-[#181611]/95 px-5 py-3 md:px-8">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center">
              <History size={18} />
            </div>
            <h2 className="text-xl font-bold text-white" style={{ fontFamily: "'Noto Serif', serif" }}>
              Al Wakeelo
            </h2>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-10 md:py-8">
          <div className="mx-auto w-full max-w-[1280px]">
            <div className="mb-8">
              <h1 className="mb-6 text-4xl font-bold leading-tight text-white" style={{ fontFamily: "'Noto Serif', serif" }}>
                Search History
              </h1>

              <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
                <label className="h-12 w-full md:w-1/2 min-w-[280px]">
                  <div className="flex h-full w-full items-center rounded-xl border border-amber-500/20 bg-[rgba(35,28,15,0.7)] backdrop-blur-md focus-within:ring-2 focus-within:ring-amber-500/50 transition-all">
                    <div className="pl-4 pr-2 text-[#bbb09b]">
                      <Search size={20} />
                    </div>
                    <input
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      className="h-full w-full min-w-0 flex-1 rounded-xl border-none bg-transparent px-2 text-base text-white placeholder:text-[#bbb09b] focus:outline-none"
                      placeholder="Search past queries, statutes, or drafts..."
                      data-testid="input-history-search"
                    />
                  </div>
                </label>

                <div className="flex w-full gap-3 overflow-x-auto pb-1 md:w-auto md:pb-0 scrollbar-hide">
                  <button
                    onClick={() => setFilter("all")}
                    className={`h-10 shrink-0 rounded-xl px-5 text-sm font-bold transition-all ${
                      filter === "all"
                        ? "bg-amber-500 text-[#181611] shadow-lg shadow-amber-500/20"
                        : "border border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                    }`}
                    data-testid="button-history-filter-all"
                  >
                    All Activity ({counts.all})
                  </button>
                  <button
                    onClick={() => setFilter("statutes")}
                    className={`h-10 shrink-0 rounded-xl px-5 text-sm font-medium transition-colors ${
                      filter === "statutes"
                        ? "bg-amber-500 text-[#181611]"
                        : "border border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                    }`}
                    data-testid="button-history-filter-statutes"
                  >
                    Statutes ({counts.statutes})
                  </button>
                  <button
                    onClick={() => setFilter("drafts")}
                    className={`h-10 shrink-0 rounded-xl px-5 text-sm font-medium transition-colors ${
                      filter === "drafts"
                        ? "bg-amber-500 text-[#181611]"
                        : "border border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                    }`}
                    data-testid="button-history-filter-drafts"
                  >
                    Drafts ({counts.drafts})
                  </button>
                  <button
                    onClick={() => setFilter("chats")}
                    className={`h-10 shrink-0 rounded-xl px-5 text-sm font-medium transition-colors ${
                      filter === "chats"
                        ? "bg-amber-500 text-[#181611]"
                        : "border border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                    }`}
                    data-testid="button-history-filter-chats"
                  >
                    Chats ({counts.chats})
                  </button>
                </div>
              </div>
            </div>

            {historyLoading || threadsLoading ? (
              <div className="flex items-center justify-center py-16 text-slate-400">
                <Loader2 size={20} className="mr-2 animate-spin text-amber-400" /> Loading activity...
              </div>
            ) : historyError ? (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
                Could not load search history right now.
              </div>
            ) : groupedActivities.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#3a3327] bg-[rgba(35,28,15,0.45)] p-10 text-center">
                <History size={44} className="mx-auto mb-4 text-[#6f6657]" />
                <p className="text-lg font-semibold text-slate-300">No activity found</p>
                <p className="mt-1 text-sm text-slate-500">Try a different filter or run searches to populate history.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {groupedActivities.map(([bucket, items]) => (
                  <section key={bucket} className="flex flex-col gap-4">
                    <h3 className="pl-2 text-xs font-bold uppercase tracking-widest text-slate-400">{bucket}</h3>

                    {items.map((item) => {
                      const meta = typeMeta(item.kind);
                      const Icon = meta.icon;

                      return (
                        <div
                          key={item.id}
                          className="group w-full rounded-2xl border border-white/5 bg-white/[0.03] p-4 transition-all duration-200 hover:-translate-y-[1px] hover:border-amber-500/30 hover:bg-white/[0.06]"
                          data-testid={`history-activity-${item.id}`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0 flex items-center gap-4">
                              <div className={`h-12 w-12 shrink-0 rounded-full flex items-center justify-center ${meta.iconClass}`}>
                                <Icon size={20} />
                              </div>

                              <div className="min-w-0">
                                <h4 className="truncate text-lg font-bold text-white transition-colors group-hover:text-amber-300" style={{ fontFamily: "'Noto Serif', serif" }}>
                                  {item.title}
                                </h4>
                                <p className="mt-1 flex items-center gap-2 text-sm text-slate-400">
                                  <span>{meta.label}</span>
                                  <span className="h-1 w-1 rounded-full bg-slate-600" />
                                  <span className="inline-flex items-center gap-1">
                                    <Clock3 size={12} /> {formatRelative(item.createdAt)}
                                  </span>
                                </p>
                              </div>
                            </div>

                            <button
                              onClick={() => handleAction(item)}
                              className="shrink-0 rounded-lg bg-amber-500/10 px-4 py-2 text-sm font-bold text-amber-400 transition-colors hover:bg-amber-500 hover:text-[#181611]"
                              data-testid={`button-history-action-${item.id}`}
                            >
                              <span className="inline-flex items-center gap-2">
                                {meta.action === "Re-run" ? <RefreshCw size={14} /> : <MessageSquareText size={14} />}
                                {meta.action}
                              </span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </section>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {selectedThread && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => { setSelectedThread(null); setThreadMessages(null); }}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            className="relative max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-[#3a3327] bg-[#231c0f] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#3a3327] bg-[#231c0f] p-4">
              <div>
                <h3 className="text-sm font-bold text-white">{selectedThread.title}</h3>
                <p className="mt-0.5 text-[10px] text-slate-500">{new Date(selectedThread.createdAt).toLocaleString()}</p>
              </div>
              <button
                onClick={() => { setSelectedThread(null); setThreadMessages(null); }}
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-[#3a3327] hover:text-white"
                data-testid="button-close-thread-modal"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {loadingThread ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 size={22} className="animate-spin text-amber-500" />
                </div>
              ) : threadMessages && threadMessages.length > 0 ? (
                threadMessages.map((m) => {
                  const parsed = m.role === "assistant" ? parseReferences(m.content) : null;
                  const content = parsed ? parsed.cleanContent : m.content;
                  return (
                    <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[85%] rounded-2xl p-4 ${
                          m.role === "user"
                            ? "bg-amber-500 text-[#181611] rounded-tr-sm"
                            : "border border-[#3a3327] bg-[#181611] text-slate-100 rounded-tl-sm"
                        }`}
                      >
                        {m.role === "assistant" ? (
                          <>
                            <LegalMarkdown content={content} />
                            {parsed?.references && <ReferenceCards references={parsed.references} />}
                          </>
                        ) : (
                          <p className="whitespace-pre-wrap text-sm">{content}</p>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="py-8 text-center text-sm text-slate-500">No messages found in this consultation.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
