import React, { useState, useEffect, useMemo } from "react";
import { PreviewShell } from "@/experimental/components/PreviewShell";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link, useLocation } from "wouter";
import {
  Bookmark,
  Search,
  Gavel,
  BookOpen,
  FileSignature,
  Trash2,
  Copy,
  ExternalLink,
  Tag,
  Share2,
  Download,
  Check,
  FolderOpen,
  Plus,
  Scale,
  Calendar,
  X,
  Edit3,
  RotateCcw,
  Sparkles,
  FileText,
  BookmarkCheck,
  CheckCircle2,
  Layers,
  FileSpreadsheet,
  FileCode,
  Briefcase,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface BookmarkedItem {
  id: string;
  title: string;
  citation: string;
  category: "Citations" | "Statutes" | "Document Clauses" | "Search Queries" | "Notes";
  courtOrSource: string;
  year: number;
  holdingSummary: string;
  tags: string[];
  savedAt: string;
  importance: "critical" | "leading" | "persuasive";
  matterTag?: string;
  userNotes?: string;
  fullRatioText?: string;
}

const STORAGE_KEY = "alwakeelo_preview_bookmarks";

function mapSavedJudgmentToBookmark(item: {
  id: number | string;
  citation?: string;
  court?: string;
  title?: string;
  summary?: string;
  keywords?: string[] | null;
  createdAt?: string | Date | null;
  aiAnalysis?: string | null;
}): BookmarkedItem {
  const yearMatch = item.citation?.match(/\b(19\d\d|20\d\d)\b/);
  const parsedYear = yearMatch
    ? parseInt(yearMatch[1], 10)
    : item.createdAt
    ? new Date(item.createdAt).getFullYear()
    : new Date().getFullYear();

  return {
    id: String(item.id),
    title: item.title || "Untitled Judgment",
    citation: item.citation || "",
    category: "Citations",
    courtOrSource: item.court || "Supreme Court of Pakistan",
    year: parsedYear,
    holdingSummary: item.summary || "",
    tags: Array.isArray(item.keywords) && item.keywords.length > 0
      ? item.keywords
      : ["Research", "Precedent"],
    savedAt: item.createdAt
      ? new Date(item.createdAt).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10),
    importance: "leading",
    userNotes: item.aiAnalysis || undefined,
    fullRatioText: item.summary || undefined,
  };
}

export const PreviewBookmarks: React.FC = () => {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  // Primary data source: load from GET /api/saved-judgments only (no localStorage fallback)
  const [bookmarks, setBookmarks] = useState<BookmarkedItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load from GET /api/saved-judgments
  useEffect(() => {
    let isMounted = true;
    async function loadSavedJudgments() {
      try {
        setIsLoading(true);
        const res = await fetch("/api/saved-judgments", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && isMounted) {
            const serverBookmarks = data.map(mapSavedJudgmentToBookmark);
            setBookmarks(serverBookmarks);
          }
        } else {
          if (isMounted) setBookmarks([]);
        }
      } catch (err) {
        console.error("Failed to load saved judgments from API:", err);
        if (isMounted) setBookmarks([]);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadSavedJudgments();
    return () => {
      isMounted = false;
    };
  }, []);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [selectedImportance, setSelectedImportance] = useState<string>("All");
  const [selectedMatter, setSelectedMatter] = useState<string>("All");

  // Modals state
  const [activeInspectBookmark, setActiveInspectBookmark] = useState<BookmarkedItem | null>(null);
  const [editingNoteBookmark, setEditingNoteBookmark] = useState<BookmarkedItem | null>(null);
  const [tempNoteText, setTempNoteText] = useState("");
  const [isAddBookmarkOpen, setIsAddBookmarkOpen] = useState(false);
  const [deletedBookmarkTemp, setDeletedBookmarkTemp] = useState<BookmarkedItem | null>(null);

  // Add Bookmark Form State
  const [addForm, setAddForm] = useState({
    title: "",
    citation: "",
    category: "Citations" as BookmarkedItem["category"],
    courtOrSource: "Supreme Court of Pakistan",
    year: new Date().getFullYear(),
    holdingSummary: "",
    fullRatioText: "",
    importance: "leading" as BookmarkedItem["importance"],
    matterTag: "General Research",
    tagsInput: "",
    userNotes: "",
  });

  const categories = [
    "All",
    "Citations",
    "Statutes",
    "Document Clauses",
    "Search Queries",
    "Notes",
  ];

  const uniqueMatters = useMemo(() => {
    const set = new Set<string>();
    bookmarks.forEach((b) => {
      if (b.matterTag) set.add(b.matterTag);
    });
    return Array.from(set).sort();
  }, [bookmarks]);

  // Filtered bookmarks
  const filteredBookmarks = useMemo(() => {
    return bookmarks.filter((item) => {
      const matchCat = selectedCategory === "All" || item.category === selectedCategory;
      const matchImp = selectedImportance === "All" || item.importance === selectedImportance;
      const matchMatter = selectedMatter === "All" || item.matterTag === selectedMatter;

      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        item.title.toLowerCase().includes(q) ||
        item.citation.toLowerCase().includes(q) ||
        item.holdingSummary.toLowerCase().includes(q) ||
        item.courtOrSource.toLowerCase().includes(q) ||
        (item.userNotes && item.userNotes.toLowerCase().includes(q)) ||
        item.tags.some((t) => t.toLowerCase().includes(q));

      return matchCat && matchImp && matchMatter && matchQuery;
    });
  }, [bookmarks, selectedCategory, selectedImportance, selectedMatter, searchQuery]);

  // Delete bookmark with undo toast
  const handleDeleteBookmark = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const itemToDelete = bookmarks.find((b) => b.id === id);
    if (!itemToDelete) return;

    // Call real API first if ID is numeric server ID
    const numericId = Number(id);
    if (!isNaN(numericId) && numericId > 0) {
      try {
        await fetch(`/api/saved-judgments/${numericId}`, {
          method: "DELETE",
          credentials: "include",
        });
      } catch (err) {
        console.warn("Backend delete failed, proceeding with local deletion:", err);
      }
    }

    setDeletedBookmarkTemp(itemToDelete);
    fetch("/api/saved-judgments/" + id, { method: "DELETE" }).then(res => { if(res.ok) queryClient.invalidateQueries({queryKey: ["/api/saved-judgments"]}); });
    setBookmarks((prev) => prev.filter((b) => b.id !== id));
    if (activeInspectBookmark?.id === id) setActiveInspectBookmark(null);
    if (editingNoteBookmark?.id === id) setEditingNoteBookmark(null);

    toast({
      title: "Bookmark Removed",
      description: `"${itemToDelete.citation}" removed from your research vault.`,
      action: (
        <button
          onClick={async () => {
            setBookmarks((prev) => [itemToDelete, ...prev]);
            try {
              await fetch("/api/saved-judgments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                  citation: itemToDelete.citation,
                  title: itemToDelete.title,
                  court: itemToDelete.courtOrSource,
                  summary: itemToDelete.holdingSummary || itemToDelete.title,
                  keywords: itemToDelete.tags,
                  aiAnalysis: itemToDelete.userNotes || undefined,
                }),
              });
            } catch {}
            toast({ title: "Bookmark Restored" });
          }}
          className="px-3 py-1 bg-white text-[#105B38] font-bold rounded-lg border border-emerald-200 text-xs shadow-xs"
        >
          Undo
        </button>
      ),
    });
  };

  // Copy citation
  const handleCopyCitation = (citation: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    navigator.clipboard.writeText(citation);
    toast({
      title: "Citation Copied",
      description: `${citation} copied to clipboard in official legal format.`,
    });
  };

  // Save edited note
  const handleSaveNote = () => {
    if (!editingNoteBookmark) return;
    setBookmarks((prev) =>
      prev.map((b) => {
        if (b.id === editingNoteBookmark.id) {
          return { ...b, userNotes: tempNoteText };
        }
        return b;
      })
    );
    if (activeInspectBookmark?.id === editingNoteBookmark.id) {
      setActiveInspectBookmark({ ...activeInspectBookmark, userNotes: tempNoteText });
    }
    setEditingNoteBookmark(null);
    toast({
      title: "Research Note Updated",
      description: "Notes saved to your research vault.",
    });
  };

  // Add new bookmark
  const handleCreateBookmark = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.title.trim() || !addForm.citation.trim()) {
      toast({
        title: "Fields Required",
        description: "Please enter title and citation reference.",
        variant: "destructive",
      });
      return;
    }

    const tagsArray = addForm.tagsInput
      ? addForm.tagsInput.split(",").map((t) => t.trim()).filter(Boolean)
      : ["Research", "Chambers Archive"];

    let serverId: string | null = null;

    // Save to real API backend first
    try {
      const res = await fetch("/api/saved-judgments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          citation: addForm.citation,
          title: addForm.title,
          court: addForm.courtOrSource || "Supreme Court of Pakistan",
          summary: addForm.holdingSummary || addForm.fullRatioText || addForm.title,
          keywords: tagsArray,
          aiAnalysis: addForm.userNotes || undefined,
        }),
      });

      if (res.ok) {
        const savedData = await res.json();
        if (savedData?.id) {
          serverId = String(savedData.id);
        }
      }
    } catch (err) {
      console.warn("Backend save failed, using local storage fallback:", err);
    }

    const newBookmark: BookmarkedItem = {
      id: serverId || `bm-${Date.now()}`,
      title: addForm.title,
      citation: addForm.citation,
      category: addForm.category,
      courtOrSource: addForm.courtOrSource,
      year: Number(addForm.year) || new Date().getFullYear(),
      holdingSummary: addForm.holdingSummary || "Saved authority for legal drafting and litigation arguments.",
      fullRatioText: addForm.fullRatioText || addForm.holdingSummary,
      tags: tagsArray,
      savedAt: new Date().toISOString().slice(0, 10),
      importance: addForm.importance,
      matterTag: addForm.matterTag,
      userNotes: addForm.userNotes,
    };

    setBookmarks((prev) => [newBookmark, ...prev]);
    queryClient.invalidateQueries({queryKey: ["/api/saved-judgments"]});
    setIsAddBookmarkOpen(false);
    setAddForm({
      title: "",
      citation: "",
      category: "Citations",
      courtOrSource: "Supreme Court of Pakistan",
      year: new Date().getFullYear(),
      holdingSummary: "",
      fullRatioText: "",
      importance: "leading",
      matterTag: "General Research",
      tagsInput: "",
      userNotes: "",
    });

    toast({
      title: "Authority Bookmarked",
      description: `"${newBookmark.citation}" added to your Saved Vault.`,
    });
  };

  // Export Brief as Markdown
  const handleExportMarkdown = () => {
    let md = `# AL WAKEEL CHAMBERS — RESEARCH & AUTHORITIES BRIEF\n`;
    md += `Exported on: ${new Date().toLocaleString()}\n`;
    md += `Total Authorities: ${filteredBookmarks.length}\n\n---\n\n`;

    filteredBookmarks.forEach((b, i) => {
      md += `### ${i + 1}. ${b.title}\n`;
      md += `- **Citation / Ref**: ${b.citation}\n`;
      md += `- **Category**: ${b.category} | **Court/Source**: ${b.courtOrSource} (${b.year})\n`;
      md += `- **Importance**: ${b.importance.toUpperCase()} | **Matter**: ${b.matterTag || "General"}\n`;
      md += `- **Legal Ratio / Holding**: ${b.holdingSummary}\n`;
      if (b.userNotes) md += `- **Advocate Research Notes**: ${b.userNotes}\n`;
      md += `- **Tags**: ${b.tags.join(", ")}\n\n`;
    });

    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `alwakeelo_authorities_brief_${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Markdown Brief Exported",
      description: "Downloaded legal research brief formatted for drafting.",
    });
  };

  // Export CSV
  const handleExportCsv = () => {
    const headers = ["Citation", "Title", "Category", "Court", "Year", "Importance", "Matter", "Summary", "Notes"];
    const rows = filteredBookmarks.map((b) => [
      `"${b.citation}"`,
      `"${b.title.replace(/"/g, '""')}"`,
      `"${b.category}"`,
      `"${b.courtOrSource}"`,
      b.year,
      `"${b.importance}"`,
      `"${b.matterTag || ""}"`,
      `"${b.holdingSummary.replace(/"/g, '""')}"`,
      `"${(b.userNotes || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `alwakeelo_bookmarks_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "CSV Exported",
      description: "Downloaded spreadsheet of saved authorities.",
    });
  };

  return (
    <PreviewShell>
      <div className="max-w-7xl mx-auto space-y-6 pb-12">
        {/* Header */}
        <div className="bg-white p-6 rounded-2xl border border-[#E2E8F0] shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <div className="p-1.5 rounded-lg bg-emerald-50 text-[#105B38] border border-emerald-200">
                <Bookmark className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#105B38]">
                Personal Precedent & Research Vault
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#0F172A]">Saved Authorities & Bookmarks</h1>
            <p className="text-xs sm:text-sm text-[#64748B] mt-1">
              Curated library of Supreme Court/High Court citations, statutory provisions, standard drafting clauses, and research notes.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={handleExportMarkdown}
              className="px-4 py-2.5 rounded-xl bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] text-xs font-bold text-[#0F172A] transition-colors flex items-center gap-1.5 shadow-2xs"
              title="Export formatted Markdown research summary"
            >
              <Download className="w-4 h-4 text-[#105B38]" />
              <span>Export Brief (.md)</span>
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              className="px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] text-xs font-bold text-[#0F172A] transition-colors flex items-center gap-1.5 shadow-2xs"
              title="Export as CSV spreadsheet"
            >
              <FileSpreadsheet className="w-4 h-4 text-[#105B38]" />
              <span>CSV</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAddBookmarkOpen(true)}
              className="px-5 py-2.5 rounded-xl bg-[#105B38] hover:bg-[#0D4A2E] text-white text-xs font-bold shadow-xs transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Bookmark Authority</span>
            </button>
          </div>
        </div>

        {/* Stats Metrics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div className="p-4 rounded-xl bg-white border border-[#E2E8F0] shadow-xs flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-50 text-[#105B38] border border-emerald-200">
              <BookmarkCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="text-lg font-bold text-[#0F172A]">{bookmarks.length}</div>
              <div className="text-[11px] text-[#64748B] font-medium">Saved Authorities</div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white border border-[#E2E8F0] shadow-xs flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-50 text-[#105B38] border border-emerald-200">
              <Gavel className="w-4 h-4" />
            </div>
            <div>
              <div className="text-lg font-bold text-[#0F172A]">
                {bookmarks.filter((b) => b.category === "Citations").length}
              </div>
              <div className="text-[11px] text-[#64748B] font-medium">Court Judgments</div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white border border-[#E2E8F0] shadow-xs flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-50 text-[#105B38] border border-emerald-200">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <div className="text-lg font-bold text-[#0F172A]">
                {bookmarks.filter((b) => b.category === "Statutes").length}
              </div>
              <div className="text-[11px] text-[#64748B] font-medium">Statutory Provisions</div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white border border-[#E2E8F0] shadow-xs flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-50 text-[#105B38] border border-emerald-200">
              <Briefcase className="w-4 h-4" />
            </div>
            <div>
              <div className="text-lg font-bold text-[#0F172A]">{uniqueMatters.length}</div>
              <div className="text-[11px] text-[#64748B] font-medium">Linked Case Matters</div>
            </div>
          </div>
        </div>

        {/* Search & Filter Hub */}
        <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex-1 flex items-center px-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] focus-within:border-[#105B38] focus-within:bg-white transition-all">
              <Search className="w-4 h-4 text-[#94A3B8] mr-2.5 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search saved authorities by citation (e.g. 2024 SCMR 1420), case title, statute, or personal notes..."
                className="w-full h-11 bg-transparent text-xs text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="p-1 rounded-md text-[#94A3B8] hover:text-[#0F172A]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Matter Filter Dropdown */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs">
                <Briefcase className="w-3.5 h-3.5 text-[#64748B]" />
                <select
                  value={selectedMatter}
                  onChange={(e) => setSelectedMatter(e.target.value)}
                  className="bg-transparent text-xs text-[#0F172A] font-semibold focus:outline-none cursor-pointer max-w-[180px] truncate"
                >
                  <option value="All">All Linked Matters</option>
                  {uniqueMatters.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              {/* Importance Filter */}
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs">
                <Tag className="w-3.5 h-3.5 text-[#64748B]" />
                <select
                  value={selectedImportance}
                  onChange={(e) => setSelectedImportance(e.target.value)}
                  className="bg-transparent text-xs text-[#0F172A] font-semibold focus:outline-none cursor-pointer"
                >
                  <option value="All">All Importance</option>
                  <option value="critical">Critical Authority</option>
                  <option value="leading">Leading Precedent</option>
                  <option value="persuasive">Persuasive / Ref</option>
                </select>
              </div>
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-[#E2E8F0]/70">
            <span className="text-[11px] font-bold text-[#64748B] mr-2">Category:</span>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold transition-all",
                  selectedCategory === cat
                    ? "bg-[#105B38] text-white shadow-xs"
                    : "bg-[#F8FAFC] text-[#64748B] hover:text-[#0F172A] border border-[#E2E8F0]"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Bookmarks Grid / Empty State */}
        {filteredBookmarks.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-[#E2E8F0] text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 text-[#105B38] flex items-center justify-center mx-auto">
              <Bookmark className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-[#0F172A]">No Matching Bookmarked Authorities</h3>
            <p className="text-xs text-[#64748B] max-w-md mx-auto">
              You haven&apos;t saved any legal authorities under this filter. Try clearing filters or bookmarking a new precedent.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("All");
                  setSelectedImportance("All");
                  setSelectedMatter("All");
                }}
                className="px-4 py-2 rounded-xl bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] text-xs font-bold text-[#105B38]"
              >
                Reset All Filters
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredBookmarks.map((item) => (
              <div
                key={item.id}
                className="p-5 rounded-2xl bg-white border border-[#E2E8F0] hover:border-[#105B38]/50 hover:shadow-md transition-all flex flex-col justify-between space-y-4 group"
              >
                <div className="space-y-3">
                  {/* Top Line */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono text-xs font-bold text-[#105B38] bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                        {item.citation}
                      </span>

                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#F8FAFC] border border-[#E2E8F0] text-[#64748B] uppercase">
                        {item.category}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {item.matterTag && (
                        <span className="font-mono text-[10px] font-bold text-[#0F172A] bg-[#F8FAFC] px-2 py-0.5 rounded-md border border-[#E2E8F0]">
                          {item.matterTag}
                        </span>
                      )}

                      <span
                        className={cn(
                          "text-[9px] uppercase font-bold px-1.5 py-0.5 rounded",
                          item.importance === "critical"
                            ? "bg-rose-100 text-rose-800"
                            : item.importance === "leading"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-blue-100 text-blue-800"
                        )}
                      >
                        {item.importance}
                      </span>
                    </div>
                  </div>

                  {/* Title & Court */}
                  <div>
                    <h3 className="font-bold text-sm text-[#0F172A] group-hover:text-[#105B38] transition-colors leading-snug">
                      {item.title}
                    </h3>
                    <div className="flex items-center gap-2 text-[11px] text-[#64748B] mt-1">
                      <span>{item.courtOrSource}</span>
                      <span>·</span>
                      <span>{item.year}</span>
                    </div>
                  </div>

                  {/* Legal Ratio Summary */}
                  <p className="text-xs text-[#475569] line-clamp-3 leading-relaxed">
                    {item.holdingSummary}
                  </p>

                  {/* User Note Box (if present) */}
                  {item.userNotes && (
                    <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/80 text-[11px] text-[#78350F] flex items-start gap-2">
                      <Edit3 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />
                      <div className="flex-1 line-clamp-2">
                        <span className="font-bold">Advocate Note: </span>
                        {item.userNotes}
                      </div>
                    </div>
                  )}

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1 pt-1">
                    {item.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#F8FAFC] border border-[#E2E8F0] text-[#64748B]"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-between text-xs">
                  <span className="text-[11px] text-[#94A3B8]">Saved on {item.savedAt}</span>

                  <div className="flex items-center gap-1.5">
                    {/* Copy Citation */}
                    <button
                      type="button"
                      onClick={(e) => handleCopyCitation(item.citation, e)}
                      className="p-1.5 rounded-lg bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] text-[#64748B] hover:text-[#0F172A] transition-colors"
                      title="Copy Citation"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>

                    {/* Edit Note */}
                    <button
                      type="button"
                      onClick={() => {
                        setEditingNoteBookmark(item);
                        setTempNoteText(item.userNotes || "");
                      }}
                      className="p-1.5 rounded-lg bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] text-[#64748B] hover:text-[#105B38] transition-colors"
                      title="Edit Research Note"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    {/* View Details */}
                    <button
                      type="button"
                      onClick={() => setActiveInspectBookmark(item)}
                      className="px-2.5 py-1 rounded-lg bg-[#F8FAFC] hover:bg-emerald-50 border border-[#E2E8F0] text-xs font-bold text-[#105B38] transition-colors flex items-center gap-1"
                      title="Inspect Authority Details"
                    >
                      <span>Inspect</span>
                    </button>

                    {/* Jump to Precedent Graph */}
                    <Link
                      href={`/preview/judgments?q=${encodeURIComponent(item.citation)}`}
                      className="p-1.5 rounded-lg bg-[#105B38] text-white hover:bg-[#0D4A2E] transition-all shadow-xs flex items-center justify-center"
                      title="Open in Precedent Graph"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>

                    {/* Delete */}
                    <button
                      type="button"
                      onClick={(e) => handleDeleteBookmark(item.id, e)}
                      className="p-1.5 rounded-lg bg-[#F8FAFC] hover:bg-rose-50 border border-[#E2E8F0] text-[#94A3B8] hover:text-rose-600 transition-colors"
                      title="Remove Bookmark"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 1. INSPECT AUTHORITY DETAILS MODAL */}
        {activeInspectBookmark && (
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6"
            onClick={() => setActiveInspectBookmark(null)}
          >
            <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" />

            <div
              className="relative bg-white border border-[#E2E8F0] rounded-2xl shadow-xl w-full max-w-3xl h-[85vh] flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Top Bar */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] bg-[#F8FAFC] shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[#105B38] shrink-0">
                    <Scale className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm sm:text-base font-bold text-[#0F172A] truncate">
                      {activeInspectBookmark.title}
                    </h2>
                    <p className="text-[11px] font-mono text-[#105B38] font-bold">
                      {activeInspectBookmark.citation} · {activeInspectBookmark.courtOrSource} ({activeInspectBookmark.year})
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleCopyCitation(activeInspectBookmark.citation)}
                    className="px-3 py-1.5 rounded-xl bg-white hover:bg-[#F1F5F9] border border-[#E2E8F0] text-xs font-bold text-[#0F172A] flex items-center gap-1.5"
                  >
                    <Copy className="w-3.5 h-3.5 text-[#105B38]" />
                    <span>Copy Citation</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveInspectBookmark(null)}
                    className="p-1.5 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-[#E2E8F0]"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {/* Meta Summary */}
                <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-3 text-xs">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <span className="text-[#64748B] block text-[10px] font-bold uppercase">Category</span>
                      <span className="font-bold text-[#0F172A]">{activeInspectBookmark.category}</span>
                    </div>
                    <div>
                      <span className="text-[#64748B] block text-[10px] font-bold uppercase">Importance</span>
                      <span className="font-bold text-[#105B38] uppercase">{activeInspectBookmark.importance}</span>
                    </div>
                    <div>
                      <span className="text-[#64748B] block text-[10px] font-bold uppercase">Linked Matter</span>
                      <span className="font-bold text-[#0F172A]">{activeInspectBookmark.matterTag || "General"}</span>
                    </div>
                    <div>
                      <span className="text-[#64748B] block text-[10px] font-bold uppercase">Saved Date</span>
                      <span className="font-bold text-[#0F172A]">{activeInspectBookmark.savedAt}</span>
                    </div>
                  </div>
                </div>

                {/* Legal Holding / Ratio */}
                <div className="space-y-2">
                  <span className="text-xs font-bold uppercase text-[#105B38] tracking-wider flex items-center gap-1.5">
                    <Gavel className="w-4 h-4" />
                    Ratio Decidendi & Legal Principle
                  </span>
                  <div className="p-4 rounded-xl bg-white border border-[#E2E8F0] shadow-2xs text-xs text-[#1E293B] leading-relaxed">
                    {activeInspectBookmark.fullRatioText || activeInspectBookmark.holdingSummary}
                  </div>
                </div>

                {/* Research Notes Container */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase text-[#0F172A] tracking-wider flex items-center gap-1.5">
                      <Edit3 className="w-4 h-4 text-amber-600" />
                      Advocate Chamber Notes
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingNoteBookmark(activeInspectBookmark);
                        setTempNoteText(activeInspectBookmark.userNotes || "");
                      }}
                      className="text-xs font-bold text-[#105B38] hover:underline"
                    >
                      Edit Note
                    </button>
                  </div>
                  <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-200/80 text-xs text-[#78350F] leading-relaxed">
                    {activeInspectBookmark.userNotes || "No personal research notes added yet. Click 'Edit Note' to add litigation takeaways."}
                  </div>
                </div>

                {/* Tags */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-[#64748B]">Indexed Topic Tags:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {activeInspectBookmark.tags.map((t) => (
                      <span
                        key={t}
                        className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-[#334155]"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-[#F8FAFC] border-t border-[#E2E8F0] flex items-center justify-between text-xs shrink-0">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/preview/judgments?q=${encodeURIComponent(activeInspectBookmark.citation)}`}
                    className="px-3.5 py-2 rounded-xl bg-white hover:bg-emerald-50 border border-[#E2E8F0] text-xs font-bold text-[#105B38] transition-colors flex items-center gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open in Precedent Graph</span>
                  </Link>

                  <Link
                    href="/preview/drafting"
                    className="px-3.5 py-2 rounded-xl bg-white hover:bg-emerald-50 border border-[#E2E8F0] text-xs font-bold text-[#105B38] transition-colors flex items-center gap-1.5"
                  >
                    <FileSignature className="w-3.5 h-3.5" />
                    <span>Insert into Drafting Studio</span>
                  </Link>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveInspectBookmark(null)}
                  className="px-4 py-2 rounded-xl bg-[#105B38] hover:bg-[#0D4A2E] text-white text-xs font-bold"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 2. EDIT NOTE MODAL */}
        {editingNoteBookmark && (
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6"
            onClick={() => setEditingNoteBookmark(null)}
          >
            <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" />

            <div
              className="relative bg-white border border-[#E2E8F0] rounded-2xl shadow-xl w-full max-w-lg overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] bg-[#F8FAFC]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
                    <Edit3 className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-[#0F172A]">Edit Advocate Research Note</h2>
                    <p className="text-[11px] font-mono text-[#64748B]">{editingNoteBookmark.citation}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setEditingNoteBookmark(null)}
                  className="p-1.5 rounded-lg text-[#64748B] hover:text-[#0F172A]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <textarea
                  rows={4}
                  value={tempNoteText}
                  onChange={(e) => setTempNoteText(e.target.value)}
                  placeholder="Record your legal strategy, paragraph citations, or specific counter-arguments..."
                  className="w-full p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#0F172A] focus:bg-white focus:border-[#105B38] focus:outline-none"
                />

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingNoteBookmark(null)}
                    className="px-4 py-2 rounded-xl bg-[#F8FAFC] text-xs font-bold text-[#64748B]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveNote}
                    className="px-5 py-2 rounded-xl bg-[#105B38] hover:bg-[#0D4A2E] text-white text-xs font-bold shadow-xs"
                  >
                    Save Note
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3. ADD NEW BOOKMARK MODAL */}
        {isAddBookmarkOpen && (
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6"
            onClick={() => setIsAddBookmarkOpen(false)}
          >
            <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" />

            <div
              className="relative bg-white border border-[#E2E8F0] rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] bg-[#F8FAFC]">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[#105B38]">
                    <Bookmark className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-[#0F172A]">Bookmark Legal Authority</h2>
                    <p className="text-xs text-[#64748B]">Add a precedent, statutory provision, or drafting clause.</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsAddBookmarkOpen(false)}
                  className="p-1.5 rounded-lg text-[#64748B] hover:text-[#0F172A]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateBookmark} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#0F172A] mb-1">Title / Case Name *</label>
                    <input
                      type="text"
                      required
                      value={addForm.title}
                      onChange={(e) => setAddForm({ ...addForm, title: e.target.value })}
                      placeholder="e.g. Federation of Pakistan v. Tariq Aziz"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#0F172A] focus:border-[#105B38] focus:bg-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#0F172A] mb-1">Citation / Reference *</label>
                    <input
                      type="text"
                      required
                      value={addForm.citation}
                      onChange={(e) => setAddForm({ ...addForm, citation: e.target.value })}
                      placeholder="e.g. 2025 SCMR 982"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#0F172A] focus:border-[#105B38] focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#0F172A] mb-1">Category</label>
                    <select
                      value={addForm.category}
                      onChange={(e) => setAddForm({ ...addForm, category: e.target.value as any })}
                      className="w-full px-3 py-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#0F172A] font-semibold focus:outline-none"
                    >
                      <option value="Citations">Citations (Precedents)</option>
                      <option value="Statutes">Statutes & Acts</option>
                      <option value="Document Clauses">Document Clauses</option>
                      <option value="Search Queries">Search Queries</option>
                      <option value="Notes">Notes</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#0F172A] mb-1">Court / Authority</label>
                    <input
                      type="text"
                      value={addForm.courtOrSource}
                      onChange={(e) => setAddForm({ ...addForm, courtOrSource: e.target.value })}
                      placeholder="e.g. Supreme Court"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#0F172A] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#0F172A] mb-1">Importance</label>
                    <select
                      value={addForm.importance}
                      onChange={(e) => setAddForm({ ...addForm, importance: e.target.value as any })}
                      className="w-full px-3 py-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#0F172A] font-semibold focus:outline-none"
                    >
                      <option value="critical">Critical Authority</option>
                      <option value="leading">Leading Precedent</option>
                      <option value="persuasive">Persuasive / Ref</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#0F172A] mb-1">Link to Matter</label>
                    <input
                      type="text"
                      value={addForm.matterTag}
                      onChange={(e) => setAddForm({ ...addForm, matterTag: e.target.value })}
                      placeholder="e.g. WP No. 4812/2026 or General Research"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#0F172A] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#0F172A] mb-1">Tags (comma separated)</label>
                    <input
                      type="text"
                      value={addForm.tagsInput}
                      onChange={(e) => setAddForm({ ...addForm, tagsInput: e.target.value })}
                      placeholder="e.g. Art. 199, Order 39, Writ"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#0F172A] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1">Legal Ratio / Holding Summary</label>
                  <textarea
                    rows={2}
                    value={addForm.holdingSummary}
                    onChange={(e) => setAddForm({ ...addForm, holdingSummary: e.target.value })}
                    placeholder="Core legal rule established by the court..."
                    className="w-full p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#0F172A] focus:outline-none resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1">Personal Advocate Notes (Optional)</label>
                  <textarea
                    rows={2}
                    value={addForm.userNotes}
                    onChange={(e) => setAddForm({ ...addForm, userNotes: e.target.value })}
                    placeholder="Notes for arguments, counter-pleas, or drafting..."
                    className="w-full p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#0F172A] focus:outline-none resize-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddBookmarkOpen(false)}
                    className="px-4 py-2.5 rounded-xl bg-[#F8FAFC] text-xs font-bold text-[#64748B]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-[#105B38] hover:bg-[#0D4A2E] text-white text-xs font-bold shadow-xs flex items-center gap-2"
                  >
                    <BookmarkCheck className="w-4 h-4" />
                    <span>Save to Vault</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </PreviewShell>
  );
};

export default PreviewBookmarks;
