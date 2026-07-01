import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useRoute, Link } from "wouter";
import { ArrowLeft, Send, Loader2, MessageSquare, Book, List, ChevronRight, ChevronDown, X, FileText, Lock } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { LegalMarkdown } from "@/components/legal-markdown";
import { Button } from "@/components/ui/button";
import { StatutePdfViewer } from "@/components/statute-pdf-viewer";
import { useAuth } from "@/hooks/use-auth";

type AiMessage = {
  role: "user" | "assistant";
  content: string;
};

type StatuteDocFull = {
  id: number;
  title: string;
  filename: string;
  content: string;
  category: string;
  createdAt: string;
  isPreview?: boolean;
  isTruncated?: boolean;
  file?: {
    available: boolean;
    mimeType: string | null;
    originalFilename: string | null;
    isPdf: boolean;
    viewUrl: string | null;
  };
};

type TocItem = {
  title: string;
  children?: TocItem[];
};

function TocSidebarItem({ item, depth = 0, onScrollTo }: { item: TocItem; depth?: number; onScrollTo: (title: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = item.children && item.children.length > 0;

  return (
    <div>
      <button
        className={`w-full flex items-center gap-2 text-left py-2 pr-3 transition-colors hover:text-foreground group ${depth === 0 ? "text-foreground text-sm font-medium" : "text-muted-foreground text-xs"}`}
        style={{ paddingLeft: `${depth * 16 + 12}px` }}
        onClick={() => {
          if (hasChildren) setExpanded(!expanded);
          onScrollTo(item.title);
        }}
      >
        {hasChildren ? (
          expanded ? <ChevronDown size={14} className="text-muted-foreground flex-shrink-0" /> : <ChevronRight size={14} className="text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronRight size={10} className="text-muted-foreground flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
        <span className="truncate">{item.title}</span>
      </button>
      {expanded && hasChildren && (
        <div>
          {item.children!.map((child, idx) => (
            <TocSidebarItem key={idx} item={child} depth={depth + 1} onScrollTo={onScrollTo} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function StatuteViewPage() {
  const { user } = useAuth();
  const isAuthed = !!user;
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/statute-view/:id");
  const docId = params?.id ? parseInt(params.id, 10) : null;

  const [doc, setDoc] = useState<StatuteDocFull | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tocItems, setTocItems] = useState<TocItem[]>([]);
  const [isTocLoading, setIsTocLoading] = useState(false);
  const [showToc, setShowToc] = useState(false);
  const [viewMode, setViewMode] = useState<"text" | "pdf">("text");
  const [chatMessages, setChatMessages] = useState<AiMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [focusSectionHint, setFocusSectionHint] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!docId) {
      setLocation("/statute-search");
      return;
    }
    loadDocument(docId);
  }, [docId, isAuthed]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sectionHint = (params.get("section") || "").trim();
    setFocusSectionHint(sectionHint);
  }, [docId]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages]);

  useEffect(() => {
    if (!doc || !focusSectionHint || viewMode !== "text") return;
    const timer = window.setTimeout(() => {
      scrollToSection(focusSectionHint);
      if (!/^section\s+/i.test(focusSectionHint)) {
        scrollToSection(`Section ${focusSectionHint}`);
      }
      if (!/^article\s+/i.test(focusSectionHint)) {
        scrollToSection(`Article ${focusSectionHint}`);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [doc?.id, focusSectionHint, viewMode]);

  async function loadDocument(id: number) {
    setIsLoading(true);
    try {
      const endpoint = isAuthed
        ? `/api/statute-documents/${id}`
        : `/api/public/statutes/${id}`;
      const res = await fetch(endpoint);
      if (res.ok) {
        const data: StatuteDocFull = await res.json();
        setDoc(data);
        setViewMode(data.file?.isPdf && data.file?.viewUrl ? "pdf" : "text");
        if (isAuthed) {
          fetchToc(id);
        }
      } else {
        setLocation("/statute-search");
      }
    } catch {
      setLocation("/statute-search");
    }
    setIsLoading(false);
  }

  const fetchToc = useCallback(async (id: number) => {
    setIsTocLoading(true);
    try {
      const res = await apiRequest("POST", `/api/statute-documents/${id}/toc`, {});
      const data = await res.json();
      setTocItems(data.toc || []);
    } catch {
      setTocItems([]);
    }
    setIsTocLoading(false);
  }, []);

  function highlightElement(el: HTMLElement) {
    el.classList.add("bg-primary/20", "ring-1", "ring-primary/40", "rounded");
    setTimeout(() => el.classList.remove("bg-primary/20", "ring-1", "ring-primary/40", "rounded"), 3000);
  }

  function scrollToSection(title: string) {
    if (!contentRef.current) return;
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
    const tocNorm = normalize(title);

    const sectionId = "section-" + title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    const el = contentRef.current.querySelector(`[id="${sectionId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      highlightElement(el as HTMLElement);
      return;
    }

    const allHeadings = Array.from(contentRef.current.querySelectorAll("[data-section-heading]"));
    for (const heading of allHeadings) {
      const headingAttr = normalize((heading as HTMLElement).getAttribute("data-section-heading") || "");
      const headingText = normalize(heading.textContent || "");
      if (headingAttr.includes(tocNorm) || tocNorm.includes(headingAttr) ||
          headingText.includes(tocNorm) || tocNorm.includes(headingText)) {
        heading.scrollIntoView({ behavior: "smooth", block: "start" });
        highlightElement(heading as HTMLElement);
        return;
      }
    }

    const tocWords = tocNorm.split(" ").filter(w => w.length > 1);
    if (tocWords.length >= 2) {
      let bestMatch: HTMLElement | null = null;
      let bestScore = 0;
      for (const heading of allHeadings) {
        const txt = normalize(heading.textContent || "");
        const score = tocWords.filter(w => txt.includes(w)).length;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = heading as HTMLElement;
        }
      }
      if (bestMatch && bestScore >= Math.min(2, tocWords.length)) {
        bestMatch.scrollIntoView({ behavior: "smooth", block: "start" });
        highlightElement(bestMatch);
        return;
      }
    }

    const bodyLines = Array.from(contentRef.current.querySelectorAll("[data-line-idx]"));
    for (const line of bodyLines) {
      const text = normalize(line.textContent || "");
      if (text.includes(tocNorm) || tocNorm.includes(text)) {
        (line as HTMLElement).scrollIntoView({ behavior: "smooth", block: "center" });
        highlightElement(line as HTMLElement);
        return;
      }
    }
  }

  function preprocessContent(content: string): string {
    const headingBreakPattern = /(?<!\n)\s*((?:PART|CHAPTER|SCHEDULE|TITLE|PREAMBLE|ANNEX|AMENDMENT)\s+[IVXLCDM0-9]+[\.\s\u2013\u2014–—:-]*[A-Z])/g;
    let processed = content.replace(headingBreakPattern, "\n$1");
    processed = processed.replace(/(?<!\n)(Page\s+\d+\s+of\s+\d+)/gi, "\n");
    return processed;
  }

  function renderDocContent(content: string) {
    const processed = preprocessContent(content);
    const lines = processed.split("\n");
    const headingPatterns = /^\s*(PART|CHAPTER|SCHEDULE|ARTICLE|SECTION|TITLE|PREAMBLE|INTRODUCTORY|ANNEX|AMENDMENT)\b/i;
    const subHeadingPatterns = /^\s*\d+[\.\)]\s+[A-Z]/;

    return lines.map((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) return <div key={idx} className="h-4" />;

      const isMainHeading = headingPatterns.test(trimmed) || (trimmed === trimmed.toUpperCase() && trimmed.length > 3 && trimmed.length < 120 && /[A-Z]/.test(trimmed));
      const isSubHeading = subHeadingPatterns.test(trimmed);

      if (isMainHeading) {
        const sectionId = "section-" + trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
        return (
          <h2
            key={idx}
            id={sectionId}
            data-section-heading={trimmed}
            className="text-xl font-bold text-foreground mt-10 mb-4 pt-4 transition-colors duration-500"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            {trimmed}
          </h2>
        );
      }

      if (isSubHeading) {
        const sectionId = "section-" + trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
        return (
          <h3
            key={idx}
            id={sectionId}
            data-section-heading={trimmed}
            className="text-base font-semibold text-foreground mt-6 mb-2 transition-colors duration-500"
          >
            {trimmed}
          </h3>
        );
      }

      return (
        <p key={idx} className="text-foreground mb-1" data-line-idx={idx}>
          {trimmed}
        </p>
      );
    });
  }

  async function handleChatSend() {
    if (!chatInput.trim() || !doc || isChatLoading) return;
    const userMsg = chatInput.trim();
    setChatInput("");
    setChatMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setIsChatLoading(true);

    try {
      const res = await apiRequest("POST", "/api/ai/document-chat", {
        documentType: "statute",
        documentTitle: doc.title,
        documentContent: doc.content.slice(0, 6000),
        messages: [
          ...chatMessages.map(m => ({ role: m.role, content: m.content })),
          { role: "user", content: userMsg },
        ],
      });
      const data = await res.json();
      setChatMessages(prev => [...prev, { role: "assistant", content: data.content || "I couldn't generate a response." }]);
    } catch {
      setChatMessages(prev => [...prev, { role: "assistant", content: "Failed to get a response. Please try again." }]);
    }
    setIsChatLoading(false);
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20">
        <Loader2 size={40} className="animate-spin text-primary mb-4" />
        <p className="text-sm text-muted-foreground font-medium">Loading statute document...</p>
      </div>
    );
  }

  if (!doc) return null;

  return (
    <div className="h-full flex flex-col fade-in">
      <div className="flex items-center justify-between gap-3 px-3 md:px-4 py-3 border-b border-border bg-background">
        <div className="flex items-center gap-3 min-w-0">
          {viewMode === "text" && !showToc && (
            <Button size="icon" variant="ghost" onClick={() => setShowToc(true)} className="text-muted-foreground flex-shrink-0 hidden md:inline-flex">
              <List size={18} />
            </Button>
          )}
          <Button size="icon" variant="ghost" onClick={() => setLocation("/statute-search")} className="text-muted-foreground flex-shrink-0">
            <ArrowLeft size={18} />
          </Button>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-foreground truncate" style={{ fontFamily: "'Playfair Display', serif" }}>
              {doc.title}
            </h2>
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{doc.category}</p>
          </div>
        </div>
        {doc.file?.isPdf && doc.file?.viewUrl && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              size="sm"
              variant={viewMode === "pdf" ? "default" : "outline"}
              className={viewMode === "pdf" ? "bg-primary text-primary-foreground hover:bg-primary" : "border-border text-foreground"}
              onClick={() => setViewMode("pdf")}
            >
              <FileText size={14} className="mr-1" />
              PDF View
            </Button>
            <Button
              size="sm"
              variant={viewMode === "text" ? "default" : "outline"}
              className={viewMode === "text" ? "bg-primary text-primary-foreground hover:bg-primary" : "border-border text-foreground"}
              onClick={() => setViewMode("text")}
            >
              <List size={14} className="mr-1" />
              Text View
            </Button>
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col xl:flex-row overflow-y-auto xl:overflow-hidden">
        <div className={`${viewMode === "text" && showToc ? "md:w-[280px] md:min-w-[280px]" : "w-0 min-w-0"} border-r border-border bg-background hidden md:flex flex-col overflow-hidden transition-all duration-300`}>
          <div className="p-4 border-b border-border flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <List size={14} className="text-muted-foreground flex-shrink-0" />
              <span className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground truncate">Table of Contents</span>
            </div>
            <Button size="icon" variant="ghost" onClick={() => setShowToc(false)} className="text-muted-foreground flex-shrink-0">
              <X size={14} />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto py-2">
            {isTocLoading && (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 size={20} className="animate-spin text-primary" />
                <p className="text-xs text-muted-foreground">Analyzing document structure...</p>
              </div>
            )}
            {!isTocLoading && tocItems.length === 0 && (
              <div className="px-4 py-8 text-center">
                <List size={24} className="text-foreground mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">No chapters detected</p>
              </div>
            )}
            {!isTocLoading && tocItems.length > 0 && tocItems.map((item, idx) => (
              <TocSidebarItem key={idx} item={item} onScrollTo={scrollToSection} />
            ))}
          </div>
        </div>

        <div className={`flex-1 min-w-0 ${viewMode === "pdf" ? "overflow-hidden" : "overflow-y-auto"}`}>
          {viewMode === "pdf" && doc.file?.viewUrl ? (
            <div className="h-full w-full bg-background">
              <StatutePdfViewer 
                fileUrl={doc.file.viewUrl} 
                onNavigateToSection={(sectionId) => {
                  setViewMode("text");
                  setFocusSectionHint(sectionId);
                }}
              />
            </div>
          ) : (
            <div className="max-w-4xl mx-auto px-3 sm:px-6 md:px-12 py-6 md:py-10">
              <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>
                {doc.title.toUpperCase()}
              </h1>
              <p className="text-sm text-muted-foreground mb-8">
                {new Date(doc.createdAt).toLocaleDateString("en-CA")}
              </p>

              <div
                ref={contentRef}
                className="max-w-none text-foreground leading-relaxed"
                style={{ fontFamily: "'Inter', sans-serif", fontSize: "14px", lineHeight: "1.9" }}
              >
                {renderDocContent(doc.content)}
              </div>

              {doc.isTruncated ? (
                <div className="mt-10 rounded-3xl border border-primary/30 bg-primary/10 p-5 md:p-7 space-y-3">
                  <div className="flex items-center gap-2 text-primary">
                    <Lock size={16} />
                    <h2 className="text-base font-bold uppercase tracking-wide">Sign up to read the full statute</h2>
                  </div>
                  <p className="text-sm text-foreground">
                    Free Al Wakeelo account unlocks the complete statute sections, schedules,
                    cross-references, and the ability to ask AI questions about it.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Link
                      href="/auth?mode=register"
                      className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90"
                    >
                      Sign up free
                    </Link>
                    <Link
                      href="/auth?mode=login"
                      className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-card/70"
                    >
                      Sign in
                    </Link>
                  </div>
                </div>
              ) : null}

              <div className="mt-12 pt-6 border-t border-border flex items-center justify-between flex-wrap gap-2">
                <p className="text-[8px] font-black uppercase tracking-[0.3em] text-muted-foreground">
                  Al Wakeelo Digital Chambers
                </p>
                <p className="text-[8px] text-muted-foreground">
                  {new Date(doc.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="w-full xl:w-[380px] xl:min-w-[340px] border-t xl:border-t-0 xl:border-l border-border bg-background flex flex-col max-h-[52vh] xl:max-h-none">
          <div className="p-3 md:p-4 border-b border-border">
            <div className="flex items-center gap-2">
              <MessageSquare size={14} className="text-primary" />
              <span className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">
                Ask about this statute
              </span>
            </div>
          </div>

          {!isAuthed ? (
            <div className="flex-grow p-6 flex flex-col items-center justify-center text-center space-y-4">
              <Lock size={36} className="text-primary animate-pulse" />
              <h3 className="font-bold text-sm" style={{ fontFamily: "'Playfair Display', serif" }}>AI Chat is Locked</h3>
              <p className="text-xs text-muted-foreground max-w-[260px] leading-relaxed">
                Sign in or register a free account to ask questions, summarize provisions, and explain penalties for this statute.
              </p>
              <div className="flex flex-col gap-2 w-full pt-2">
                <Link
                  href="/auth?mode=register"
                  className="rounded-xl bg-primary py-2.5 text-xs font-bold text-primary-foreground hover:bg-primary/95 transition-all text-center"
                >
                  Sign up free
                </Link>
                <Link
                  href="/auth?mode=login"
                  className="rounded-xl border border-border bg-card py-2.5 text-xs font-semibold text-foreground hover:bg-card/75 transition-all text-center"
                >
                  Sign in
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3">
                {chatMessages.length === 0 && (
                  <div className="text-center py-12">
                    <Book size={32} className="text-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground font-medium">Ask any question about this statute</p>
                    <p className="text-xs text-muted-foreground mt-1">AI will answer based on the document</p>
                    <div className="mt-6 space-y-2">
                      {[
                        "Summarize this statute",
                        "What are the key provisions?",
                        "Explain the penalties under this law",
                      ].map((suggestion, i) => (
                        <button
                          key={i}
                          onClick={() => { setChatInput(suggestion); }}
                          className="w-full text-left px-4 py-3 bg-card border border-border rounded-xl text-xs text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {chatMessages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[90%] px-4 py-3 rounded-xl text-sm ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-card text-foreground border border-border"
                      }`}
                    >
                      {msg.role === "assistant" ? (
                        <div className="prose prose-invert prose-sm max-w-none">
                          <LegalMarkdown content={msg.content} />
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap text-[13px]">{msg.content}</div>
                      )}
                    </div>
                  </div>
                ))}

                {isChatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-card border border-border rounded-xl px-4 py-3">
                      <Loader2 size={16} className="animate-spin text-primary" />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <div className="p-3 border-t border-border">
                <div className="flex gap-2">
                  <input
                    className="flex-1 bg-card border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                    placeholder="Ask about this statute..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleChatSend()}
                  />
                  <Button
                    size="icon"
                    onClick={handleChatSend}
                    disabled={!chatInput.trim() || isChatLoading}
                    className="bg-primary text-primary-foreground rounded-xl h-10 w-10"
                  >
                    <Send size={16} />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
