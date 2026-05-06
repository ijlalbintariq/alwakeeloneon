import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Bookmark,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Eye,
  Search,
  Trash2,
  X,
} from "lucide-react";
import jsPDF from "jspdf";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { LegalMarkdown } from "@/components/legal-markdown";
import { parseReferences, ReferenceCards } from "@/components/reference-cards";

interface BookmarkItem {
  id: number;
  title: string;
  content: string;
  type: "al-wakeelo" | "draft" | "contract" | string;
  category: string;
  createdAt: string;
}

type TypeFilter = "all" | "al-wakeelo" | "draft" | "contract";

type TypeMeta = {
  label: string;
  chip: string;
};

const PAGE_SIZE = 6;

const TYPE_META: Record<string, TypeMeta> = {
  "al-wakeelo": {
    label: "LEGAL CHAT",
    chip: "bg-violet-500/15 text-violet-300 border border-violet-400/25",
  },
  draft: {
    label: "LEGAL DRAFT",
    chip: "bg-blue-500/15 text-blue-300 border border-blue-400/25",
  },
  contract: {
    label: "CONTRACT DRAFT",
    chip: "bg-primary/15 text-primary border border-primary/25",
  },
};

function getTypeMeta(type: string): TypeMeta {
  return (
    TYPE_META[type] || {
      label: (type || "bookmark").toUpperCase(),
      chip: "bg-slate-500/20 text-foreground border border-slate-400/25",
    }
  );
}

function formatCardDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Unknown date";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function safeFileName(value: string, fallback: string): string {
  const base = (value || fallback).trim().toLowerCase().replace(/\s+/g, "-");
  return base.replace(/[^a-z0-9-_]/g, "") || fallback;
}

function downloadTxt(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadPdf(title: string, content: string, filename: string) {
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 50;
  const usableWidth = pdf.internal.pageSize.getWidth() - margin * 2;
  let y = 56;

  pdf.setFont("times", "bold");
  pdf.setFontSize(16);
  pdf.text(title || "Bookmark", margin, y);
  y += 24;

  pdf.setFont("times", "normal");
  pdf.setFontSize(12);
  const lines = pdf.splitTextToSize(content || "", usableWidth);

  for (const line of lines) {
    if (y > pdf.internal.pageSize.getHeight() - 50) {
      pdf.addPage();
      y = 56;
    }
    pdf.text(line, margin, y);
    y += 17;
  }

  pdf.save(`${filename}.pdf`);
}

export default function BookmarksPage() {
  const { data: bookmarks = [], isLoading, isError, error } = useQuery<BookmarkItem[]>({
    queryKey: ["/api/bookmarks"],
  });

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<TypeFilter>("all");
  const [page, setPage] = useState(1);
  const [preview, setPreview] = useState<BookmarkItem | null>(null);
  const [copied, setCopied] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/bookmarks/${id}`);
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookmarks"] });
      if (preview?.id === id) setPreview(null);
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bookmarks
      .filter((b) => {
        const typeOk = filter === "all" || b.type === filter;
        const queryOk =
          !q ||
          b.title.toLowerCase().includes(q) ||
          b.content.toLowerCase().includes(q) ||
          b.category.toLowerCase().includes(q);
        return typeOk && queryOk;
      })
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }, [bookmarks, filter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const paged = useMemo(() => {
    const current = Math.min(page, totalPages);
    const start = (current - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page, totalPages]);

  const pageButtons = useMemo(() => {
    const nums: number[] = [];
    for (let i = 1; i <= totalPages; i += 1) nums.push(i);
    return nums;
  }, [totalPages]);

  const counts = useMemo(
    () => ({
      all: bookmarks.length,
      "al-wakeelo": bookmarks.filter((b) => b.type === "al-wakeelo").length,
      draft: bookmarks.filter((b) => b.type === "draft").length,
      contract: bookmarks.filter((b) => b.type === "contract").length,
    }),
    [bookmarks],
  );

  const openPreview = (b: BookmarkItem) => {
    setCopied(false);
    setPreview(b);
  };

  const copyText = async () => {
    if (!preview) return;
    await navigator.clipboard.writeText(preview.content || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const setFilterAndResetPage = (next: TypeFilter) => {
    setFilter(next);
    setPage(1);
  };

  return (
    <section
      className="h-[calc(100dvh-96px)] md:h-[calc(100vh-120px)] rounded-xl md:rounded-[1.8rem] overflow-hidden border border-[hsl(var(--preview-border))] bg-background fade-in"
      data-testid="bookmarks-page"
    >
      <div className="relative flex h-full min-h-0 flex-col overflow-hidden">
        <header className="shrink-0 border-b border-border bg-background/95 px-4 py-3 md:px-8 md:py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 flex-1 items-center gap-4 md:gap-7">
              <div className="hidden md:flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Bookmark size={18} />
              </div>
              <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
                Al Wakeelo
              </h2>

              <div className="relative hidden max-w-lg flex-1 md:block">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search your bookmarks..."
                  className="h-12 w-full rounded-xl border border-border bg-card pl-10 pr-3 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  data-testid="input-bookmark-search"
                />
              </div>
            </div>
          </div>

          <div className="relative mt-3 md:hidden">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search your bookmarks..."
              className="h-11 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              data-testid="input-bookmark-search-mobile"
            />
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-10 md:py-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-5xl" style={{ fontFamily: "'Playfair Display', serif" }}>
                  My Bookmarked Responses
                </h1>
                <p className="mt-2 text-base text-muted-foreground md:text-lg">
                  Access your saved legal drafts, case law research, and AI consultations securely.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {([
                  ["all", "All"],
                  ["draft", "Drafts"],
                  ["al-wakeelo", "Research"],
                  ["contract", "Contracts"],
                ] as Array<[TypeFilter, string]>).map(([value, label]) => {
                  const active = filter === value;
                  return (
                    <button
                      key={value}
                      onClick={() => setFilterAndResetPage(value)}
                      className={`rounded-lg px-4 py-2 text-sm transition-colors ${
                        active
                          ? "bg-primary text-foreground font-bold"
                          : "bg-card text-foreground border border-border hover:bg-muted"
                      }`}
                      data-testid={`button-bookmark-filter-${value}`}
                    >
                      {label} ({counts[value] || 0})
                    </button>
                  );
                })}
              </div>
            </div>

            {isLoading ? (
              <div className="flex h-40 items-center justify-center">
                <div className="flex items-center gap-2 text-foreground">
                  <span className="animate-spin"><ChevronRight size={18} /></span>
                  Loading bookmarks...
                </div>
              </div>
            ) : isError ? (
              <div className="rounded-xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-300">
                Failed to load bookmarks: {(error as Error)?.message || "Unknown error"}
              </div>
            ) : paged.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-background/40 px-6 py-14 text-center">
                <Bookmark size={44} className="mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-semibold text-foreground">No bookmarks found</p>
                <p className="mt-1 text-sm text-muted-foreground">Save responses from chat and drafting modules to populate this vault.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {paged.map((bookmark) => {
                    const meta = getTypeMeta(bookmark.type);
                    const filename = safeFileName(bookmark.title, `bookmark-${bookmark.id}`);

                    return (
                      <article
                        key={bookmark.id}
                        className="group relative flex min-h-[288px] flex-col justify-between rounded-xl border border-border/60 bg-card p-6 shadow-sm transition-all duration-300 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5"
                        data-testid={`bookmark-${bookmark.id}`}
                      >
                        <div>
                          <div className="mb-4 flex items-start justify-between gap-3">
                            <span className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-bold ${meta.chip}`}>
                              {meta.label}
                            </span>
                            <button
                              onClick={() => deleteMutation.mutate(bookmark.id)}
                              disabled={deleteMutation.isPending}
                              className="text-muted-foreground opacity-0 transition-colors group-hover:opacity-100 hover:text-red-400 disabled:opacity-40"
                              title="Delete Bookmark"
                              data-testid={`button-delete-bookmark-${bookmark.id}`}
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>

                          <h3 className="line-clamp-2 text-xl font-bold leading-snug text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
                            {bookmark.title || "Untitled Bookmark"}
                          </h3>

                          <p className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
                            <CalendarDays size={14} />
                            {formatCardDate(bookmark.createdAt)}
                          </p>

                          <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{bookmark.content}</p>
                        </div>

                        <div className="mt-4 flex items-center gap-3 border-t border-border/50 pt-4">
                          <button
                            onClick={() => openPreview(bookmark)}
                            className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-foreground transition-colors hover:bg-primary"
                            data-testid={`button-view-bookmark-${bookmark.id}`}
                          >
                            <span className="inline-flex items-center justify-center gap-2">
                              <Eye size={16} />
                              View Full Response
                            </span>
                          </button>
                          <button
                            onClick={() => downloadTxt(bookmark.content, filename)}
                            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-foreground transition-colors hover:bg-muted"
                            title="Download .txt"
                            data-testid={`button-download-bookmark-${bookmark.id}`}
                          >
                            <Download size={16} />
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>

                <div className="mt-10 flex justify-center">
                  <nav className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="rounded-lg border border-border px-4 py-2 text-muted-foreground transition-colors hover:bg-card disabled:opacity-40"
                      data-testid="button-bookmarks-prev"
                    >
                      <span className="inline-flex items-center gap-1"><ChevronLeft size={14} /> Previous</span>
                    </button>

                    {pageButtons.map((n) => (
                      <button
                        key={n}
                        onClick={() => setPage(n)}
                        className={`rounded-lg px-4 py-2 text-sm ${
                          page === n
                            ? "bg-primary font-bold text-foreground"
                            : "border border-border text-foreground hover:bg-card"
                        }`}
                        data-testid={`button-bookmarks-page-${n}`}
                      >
                        {n}
                      </button>
                    ))}

                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                      className="rounded-lg border border-border px-4 py-2 text-muted-foreground transition-colors hover:bg-card disabled:opacity-40"
                      data-testid="button-bookmarks-next"
                    >
                      <span className="inline-flex items-center gap-1">Next <ChevronRight size={14} /></span>
                    </button>
                  </nav>
                </div>
              </>
            )}
          </div>
        </main>

        <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent opacity-60" />
      </div>

      {preview && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-6">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setPreview(null)} />

          <div className="relative flex h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-4 sm:px-6">
              <div className="min-w-0">
                <h3 className="truncate text-xl font-bold text-foreground sm:text-2xl" style={{ fontFamily: "'Playfair Display', serif" }}>
                  {preview.title || "Bookmark"}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">Generated on {formatCardDate(preview.createdAt)}</p>
              </div>

              <div className="ml-3 flex items-center gap-1">
                <button
                  onClick={copyText}
                  className="rounded-lg p-2 text-foreground transition-colors hover:bg-card hover:text-foreground"
                  title="Copy text"
                  data-testid="button-bookmark-copy"
                >
                  <Copy size={17} />
                </button>
                <button
                  onClick={() => downloadTxt(preview.content, safeFileName(preview.title, `bookmark-${preview.id}`))}
                  className="rounded-lg p-2 text-foreground transition-colors hover:bg-card hover:text-foreground"
                  title="Download TXT"
                  data-testid="button-bookmark-modal-download-txt"
                >
                  <Download size={17} />
                </button>
                <button
                  onClick={() =>
                    downloadPdf(
                      preview.title,
                      preview.content,
                      safeFileName(preview.title, `bookmark-${preview.id}`),
                    )
                  }
                  className="rounded-lg p-2 text-foreground transition-colors hover:bg-card hover:text-foreground"
                  title="Download PDF"
                  data-testid="button-bookmark-modal-download-pdf"
                >
                  <Bookmark size={17} />
                </button>
                <button
                  onClick={() => setPreview(null)}
                  className="rounded-lg p-2 text-foreground transition-colors hover:bg-card hover:text-foreground"
                  title="Close"
                  data-testid="button-bookmark-close"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {copied && (
              <div className="border-b border-border bg-emerald-500/10 px-6 py-2 text-xs text-emerald-300">Copied to clipboard.</div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto bg-muted p-5 font-serif text-foreground sm:p-8">
              {(() => {
                const parsed = parseReferences(preview.content);
                return (
                  <div className="mx-auto max-w-3xl space-y-6">
                    <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                      <LegalMarkdown content={parsed.cleanContent} />
                    </div>
                    {parsed.references && (
                      <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                        <ReferenceCards references={parsed.references} />
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
