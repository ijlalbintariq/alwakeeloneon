import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useRoute } from "wouter";
import { ArrowLeft, Send, Loader2, MessageSquare, Book, List, ChevronRight, ChevronDown, X, FileText } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { LegalMarkdown } from "@/components/legal-markdown";
import { Button } from "@/components/ui/button";

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
        className={`w-full flex items-center gap-2 text-left py-2 pr-3 transition-colors hover:text-white group ${depth === 0 ? "text-slate-300 text-sm font-medium" : "text-slate-400 text-xs"}`}
        style={{ paddingLeft: `${depth * 16 + 12}px` }}
        onClick={() => {
          if (hasChildren) setExpanded(!expanded);
          onScrollTo(item.title);
        }}
      >
        {hasChildren ? (
          expanded ? <ChevronDown size={14} className="text-slate-500 flex-shrink-0" /> : <ChevronRight size={14} className="text-slate-500 flex-shrink-0" />
        ) : (
          <ChevronRight size={10} className="text-slate-600 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
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
  }, [docId]);

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
      const res = await fetch(`/api/statute-documents/${id}`);
      if (res.ok) {
        const data: StatuteDocFull = await res.json();
        setDoc(data);
        setViewMode(data.file?.isPdf && data.file?.viewUrl ? "pdf" : "text");
        fetchToc(id);
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
    el.classList.add("bg-amber-500/20", "ring-1", "ring-amber-500/40", "rounded");
    setTimeout(() => el.classList.remove("bg-amber-500/20", "ring-1", "ring-amber-500/40", "rounded"), 3000);
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
            className="text-xl font-bold text-white mt-10 mb-4 pt-4 transition-colors duration-500"
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
            className="text-base font-semibold text-slate-200 mt-6 mb-2 transition-colors duration-500"
          >
            {trimmed}
          </h3>
        );
      }

      return (
        <p key={idx} className="text-slate-300 mb-1" data-line-idx={idx}>
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
        <Loader2 size={40} className="animate-spin text-amber-500 mb-4" />
        <p className="text-sm text-slate-500 font-medium">Loading statute document...</p>
      </div>
    );
  }

  if (!doc) return null;

  return (
    <div className="h-full flex flex-col fade-in">
      <div className="flex items-center justify-between gap-3 px-3 md:px-4 py-3 border-b border-slate-800 bg-[#0f172a]">
        <div className="flex items-center gap-3 min-w-0">
          {viewMode === "text" && !showToc && (
            <Button size="icon" variant="ghost" onClick={() => setShowToc(true)} className="text-slate-400 flex-shrink-0 hidden md:inline-flex">
              <List size={18} />
            </Button>
          )}
          <Button size="icon" variant="ghost" onClick={() => setLocation("/statute-search")} className="text-slate-400 flex-shrink-0">
            <ArrowLeft size={18} />
          </Button>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-white truncate" style={{ fontFamily: "'Playfair Display', serif" }}>
              {doc.title}
            </h2>
            <p className="text-[9px] text-slate-500 uppercase tracking-wider">{doc.category}</p>
          </div>
        </div>
        {doc.file?.isPdf && doc.file?.viewUrl && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              size="sm"
              variant={viewMode === "pdf" ? "default" : "outline"}
              className={viewMode === "pdf" ? "bg-amber-500 text-slate-950 hover:bg-amber-400" : "border-slate-700 text-slate-300"}
              onClick={() => setViewMode("pdf")}
            >
              <FileText size={14} className="mr-1" />
              PDF View
            </Button>
            <Button
              size="sm"
              variant={viewMode === "text" ? "default" : "outline"}
              className={viewMode === "text" ? "bg-amber-500 text-slate-950 hover:bg-amber-400" : "border-slate-700 text-slate-300"}
              onClick={() => setViewMode("text")}
            >
              <List size={14} className="mr-1" />
              Text View
            </Button>
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col xl:flex-row overflow-y-auto xl:overflow-hidden">
        <div className={`${viewMode === "text" && showToc ? "md:w-[280px] md:min-w-[280px]" : "w-0 min-w-0"} border-r border-slate-800 bg-[#0f172a] hidden md:flex flex-col overflow-hidden transition-all duration-300`}>
          <div className="p-4 border-b border-slate-800 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <List size={14} className="text-slate-500 flex-shrink-0" />
              <span className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 truncate">Table of Contents</span>
            </div>
            <Button size="icon" variant="ghost" onClick={() => setShowToc(false)} className="text-slate-500 flex-shrink-0">
              <X size={14} />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto py-2">
            {isTocLoading && (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 size={20} className="animate-spin text-amber-500" />
                <p className="text-xs text-slate-500">Analyzing document structure...</p>
              </div>
            )}
            {!isTocLoading && tocItems.length === 0 && (
              <div className="px-4 py-8 text-center">
                <List size={24} className="text-slate-700 mx-auto mb-2" />
                <p className="text-xs text-slate-600">No chapters detected</p>
              </div>
            )}
            {!isTocLoading && tocItems.length > 0 && tocItems.map((item, idx) => (
              <TocSidebarItem key={idx} item={item} onScrollTo={scrollToSection} />
            ))}
          </div>
        </div>

        <div className={`flex-1 min-w-0 ${viewMode === "pdf" ? "overflow-hidden" : "overflow-y-auto"}`}>
          {viewMode === "pdf" && doc.file?.viewUrl ? (
            <div className="h-full w-full bg-[#0b1220]">
              <iframe
                src={`${doc.file.viewUrl}#view=FitH&toolbar=1&navpanes=1`}
                title={`PDF Viewer - ${doc.title}`}
                className="h-full w-full border-0"
              />
            </div>
          ) : (
            <div className="max-w-4xl mx-auto px-3 sm:px-6 md:px-12 py-6 md:py-10">
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>
                {doc.title.toUpperCase()}
              </h1>
              <p className="text-sm text-slate-500 mb-8">
                {new Date(doc.createdAt).toLocaleDateString("en-CA")}
              </p>

              <div
                ref={contentRef}
                className="max-w-none text-slate-300 leading-relaxed"
                style={{ fontFamily: "'Inter', sans-serif", fontSize: "14px", lineHeight: "1.9" }}
              >
                {renderDocContent(doc.content)}
              </div>

              <div className="mt-12 pt-6 border-t border-slate-800 flex items-center justify-between flex-wrap gap-2">
                <p className="text-[8px] font-black uppercase tracking-[0.3em] text-slate-600">
                  Al Wakeelo Digital Chambers
                </p>
                <p className="text-[8px] text-slate-600">
                  {new Date(doc.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="w-full xl:w-[380px] xl:min-w-[340px] border-t xl:border-t-0 xl:border-l border-slate-800 bg-[#0f172a] flex flex-col max-h-[52vh] xl:max-h-none">
          <div className="p-3 md:p-4 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <MessageSquare size={14} className="text-amber-500" />
              <span className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">
                Ask about this statute
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3">
            {chatMessages.length === 0 && (
              <div className="text-center py-12">
                <Book size={32} className="text-slate-700 mx-auto mb-3" />
                <p className="text-sm text-slate-500 font-medium">Ask any question about this statute</p>
                <p className="text-xs text-slate-600 mt-1">AI will answer based on the document</p>
                <div className="mt-6 space-y-2">
                  {[
                    "Summarize this statute",
                    "What are the key provisions?",
                    "Explain the penalties under this law",
                  ].map((suggestion, i) => (
                    <button
                      key={i}
                      onClick={() => { setChatInput(suggestion); }}
                      className="w-full text-left px-4 py-3 bg-[#1e293b] border border-slate-800 rounded-xl text-xs text-slate-400 hover:text-white hover:border-amber-500/30 transition-all"
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
                      ? "bg-amber-500 text-slate-950"
                      : "bg-[#1e293b] text-slate-300 border border-slate-800"
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
                <div className="bg-[#1e293b] border border-slate-800 rounded-xl px-4 py-3">
                  <Loader2 size={16} className="animate-spin text-amber-500" />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="p-3 border-t border-slate-800">
            <div className="flex gap-2">
              <input
                className="flex-1 bg-[#1e293b] border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                placeholder="Ask about this statute..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleChatSend()}
              />
              <Button
                size="icon"
                onClick={handleChatSend}
                disabled={!chatInput.trim() || isChatLoading}
                className="bg-amber-500 text-slate-950 rounded-xl h-10 w-10"
              >
                <Send size={16} />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
