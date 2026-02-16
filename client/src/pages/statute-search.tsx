import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Loader2, X, Send, Book, ChevronRight, ChevronDown, FileText, MessageSquare, ArrowLeft, List } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";

type StatuteDocResult = {
  id: number;
  title: string;
  category: string;
  filename: string;
};

type StatuteDocFull = {
  id: number;
  title: string;
  filename: string;
  content: string;
  category: string;
  createdAt: string;
};

type AiMessage = {
  role: "user" | "assistant";
  content: string;
};

type TocItem = {
  title: string;
  children?: TocItem[];
};

const COMMON_STATUTES = [
  {
    category: "The Fundamental Ground Rules",
    description: "The supreme law of the land.",
    items: [
      { label: "Constitution of Pakistan, 1973", query: "Constitution", detail: "Articles 8-28 (Fundamental Rights) and Article 199 (Writ Jurisdiction)." },
    ],
  },
  {
    category: "Criminal Law",
    description: "Definitions of crimes and procedure.",
    items: [
      { label: "Pakistan Penal Code (PPC), 1860", query: "Pakistan Penal Code", detail: "Defines crimes from simple scuffle to 489-F cheque dishonour." },
      { label: "Code of Criminal Procedure (CrPC), 1898", query: "Criminal Procedure", detail: "FIRs, arrests, and Bail (Sections 497/498)." },
      { label: "PECA, 2016", query: "Electronic Crimes", detail: "Cybercrime and digital forensics." },
    ],
  },
  {
    category: "Civil & Property Law",
    description: "Filing suits, injunctions, and property movement.",
    items: [
      { label: "Code of Civil Procedure (CPC), 1908", query: "Civil Procedure", detail: "Suits, injunctions (stay orders), and appeals." },
      { label: "The Contract Act, 1872", query: "Contract Act", detail: "The foundation of every deal and partnership." },
      { label: "Transfer of Property Act, 1882", query: "Transfer of Property", detail: "Rules on land and property transfers." },
    ],
  },
  {
    category: "Family & Personal Law",
    description: "Marriage, divorce, custody, and inheritance.",
    items: [
      { label: "Family Courts Act, 1964", query: "Family Courts", detail: "Khula, maintenance, and dower." },
      { label: "Guardians and Wards Act, 1890", query: "Guardians and Wards", detail: "Custody of minors." },
    ],
  },
];

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
        data-testid={`toc-item-${item.title.slice(0, 20).replace(/\s/g, "-")}`}
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

export default function StatuteSearchPage() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<StatuteDocResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<StatuteDocFull | null>(null);
  const [isLoadingDoc, setIsLoadingDoc] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<AiMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [tocItems, setTocItems] = useState<TocItem[]>([]);
  const [isTocLoading, setIsTocLoading] = useState(false);
  const [showToc, setShowToc] = useState(true);
  const searchRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const [autoSearchDone, setAutoSearchDone] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    if (q && !autoSearchDone) {
      setAutoSearchDone(true);
      handleQuickSearch(q);
    }
  }, []);

  const fetchToc = useCallback(async (docId: number) => {
    setIsTocLoading(true);
    try {
      const res = await apiRequest("POST", `/api/statute-documents/${docId}/toc`, {});
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

    const scrollContainer = contentRef.current.closest(".overflow-y-auto");
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

    const allElements = Array.from(contentRef.current.querySelectorAll("p, h2, h3"));
    for (const el of allElements) {
      const txt = normalize(el.textContent || "");
      if (txt.includes(tocNorm)) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        highlightElement(el as HTMLElement);
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
            style={{ fontFamily: "'Libre Baskerville', serif" }}
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

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages]);

  function handleQueryChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.trim().length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/statute-documents/search?q=${encodeURIComponent(value.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data);
          setShowDropdown(data.length > 0);
        }
      } catch {}
      setIsSearching(false);
    }, 300);
  }

  async function handleSelectStatute(doc: StatuteDocResult) {
    setShowDropdown(false);
    setQuery(doc.title);
    setIsLoadingDoc(true);
    setChatMessages([]);
    setShowChat(false);
    setTocItems([]);

    try {
      const res = await fetch(`/api/statute-documents/${doc.id}`);
      if (res.ok) {
        const full = await res.json();
        setSelectedDoc(full);
        fetchToc(doc.id);
      }
    } catch {}
    setIsLoadingDoc(false);
  }

  async function handleQuickSearch(searchQuery: string) {
    setQuery(searchQuery);
    setIsSearching(true);
    try {
      const res = await fetch(`/api/statute-documents/search?q=${encodeURIComponent(searchQuery)}`);
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data);
        setShowDropdown(data.length > 0);
      }
    } catch {}
    setIsSearching(false);
  }

  async function handleChatSend() {
    if (!chatInput.trim() || !selectedDoc || isChatLoading) return;

    const userMsg = chatInput.trim();
    setChatInput("");
    setChatMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setIsChatLoading(true);

    try {
      const systemContext = `I am currently reading the following statute document:\n\nTitle: ${selectedDoc.title}\nCategory: ${selectedDoc.category}\n\nDocument Content (excerpt):\n${selectedDoc.content.slice(0, 4000)}`;

      const aiMessages = [
        { role: "system", content: systemContext },
        ...chatMessages.map(m => ({ role: m.role, content: m.content })),
        { role: "user", content: userMsg },
      ];

      const res = await apiRequest("POST", "/api/ai/chat", { messages: aiMessages, type: "chat" });
      const data = await res.json();
      setChatMessages(prev => [...prev, { role: "assistant", content: data.content || "I couldn't generate a response. Please try again." }]);
    } catch {
      setChatMessages(prev => [...prev, { role: "assistant", content: "Failed to get a response. Please try again." }]);
    }
    setIsChatLoading(false);
  }

  function handleBackToSearch() {
    setSelectedDoc(null);
    setShowChat(false);
    setChatMessages([]);
  }

  if (selectedDoc) {
    return (
      <div className="h-full flex flex-col fade-in" data-testid="statute-viewer">
        <div className="flex-1 flex overflow-hidden">
          <div className={`${showToc ? "w-[280px] min-w-[280px]" : "w-0 min-w-0"} border-r border-slate-800 bg-[#0f172a] flex flex-col overflow-hidden transition-all duration-300`} data-testid="toc-sidebar">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <List size={14} className="text-slate-500 flex-shrink-0" />
                <span className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 truncate">Table of Contents</span>
              </div>
              <Button size="icon" variant="ghost" onClick={() => setShowToc(false)} className="text-slate-500 flex-shrink-0" data-testid="button-close-toc">
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

          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-800 bg-[#0f172a]">
              <div className="flex items-center gap-3 min-w-0">
                {!showToc && (
                  <Button size="icon" variant="ghost" onClick={() => setShowToc(true)} className="text-slate-400 flex-shrink-0" data-testid="button-open-toc">
                    <List size={18} />
                  </Button>
                )}
                <Button size="icon" variant="ghost" onClick={handleBackToSearch} className="text-slate-400 flex-shrink-0" data-testid="button-back-to-search">
                  <ArrowLeft size={18} />
                </Button>
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-white truncate" style={{ fontFamily: "'Libre Baskerville', serif" }}>
                    {selectedDoc.title}
                  </h2>
                  <p className="text-[9px] text-slate-500 uppercase tracking-wider">{selectedDoc.category}</p>
                </div>
              </div>
              <Button
                variant={showChat ? "default" : "ghost"}
                className={`rounded-md text-[10px] uppercase tracking-widest font-bold gap-2 flex-shrink-0 ${showChat ? "bg-amber-500 text-slate-950" : "text-slate-400"}`}
                onClick={() => setShowChat(!showChat)}
                data-testid="button-toggle-chat"
              >
                <MessageSquare size={14} />
                <span className="hidden sm:inline">Ask AI</span>
              </Button>
            </div>

            <div className="flex-1 flex overflow-hidden">
              <div className={`flex-1 overflow-y-auto ${showChat ? "" : ""}`}>
                <div className="max-w-4xl mx-auto px-6 md:px-12 py-10">
                  <h1 className="text-3xl md:text-4xl font-bold text-white mb-2" style={{ fontFamily: "'Libre Baskerville', serif" }}>
                    {selectedDoc.title.toUpperCase()}
                  </h1>
                  <p className="text-sm text-slate-500 mb-8">
                    {new Date(selectedDoc.createdAt).toLocaleDateString("en-CA")}
                  </p>

                  <div
                    ref={contentRef}
                    className="max-w-none text-slate-300 leading-relaxed"
                    style={{ fontFamily: "'Inter', sans-serif", fontSize: "14px", lineHeight: "1.9" }}
                    data-testid="document-content"
                  >
                    {renderDocContent(selectedDoc.content)}
                  </div>

                  <div className="mt-12 pt-6 border-t border-slate-800 flex items-center justify-between flex-wrap gap-2">
                    <p className="text-[8px] font-black uppercase tracking-[0.3em] text-slate-600">
                      Al Wakeelo Digital Chambers
                    </p>
                    <p className="text-[8px] text-slate-600">
                      {new Date(selectedDoc.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>

              {showChat && (
                <div className="w-[340px] min-w-[300px] border-l border-slate-800 bg-[#0f172a] flex flex-col fade-in" data-testid="statute-chat-sidebar">
                  <div className="p-3 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <MessageSquare size={14} className="text-amber-500" />
                      <span className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">
                        Ask about this statute
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-3 space-y-3">
                    {chatMessages.length === 0 && (
                      <div className="text-center py-10">
                        <MessageSquare size={28} className="text-slate-700 mx-auto mb-2" />
                        <p className="text-sm text-slate-500">Ask any question</p>
                        <p className="text-xs text-slate-600 mt-1">AI will answer based on this document</p>
                      </div>
                    )}

                    {chatMessages.map((msg, idx) => (
                      <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[90%] px-3 py-2 rounded-md text-sm ${
                            msg.role === "user"
                              ? "bg-amber-500 text-slate-950"
                              : "bg-[#1e293b] text-slate-300 border border-slate-800"
                          }`}
                          data-testid={`chat-message-${idx}`}
                        >
                          <div className="whitespace-pre-wrap text-[13px]">{msg.content}</div>
                        </div>
                      </div>
                    ))}

                    {isChatLoading && (
                      <div className="flex justify-start">
                        <div className="bg-[#1e293b] border border-slate-800 rounded-md px-3 py-2">
                          <Loader2 size={16} className="animate-spin text-amber-500" />
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  <div className="p-3 border-t border-slate-800">
                    <div className="flex gap-2">
                      <input
                        className="flex-1 bg-[#1e293b] border border-slate-700 rounded-md px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                        placeholder="Ask about this statute..."
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleChatSend()}
                        data-testid="input-statute-chat"
                      />
                      <Button
                        size="icon"
                        onClick={handleChatSend}
                        disabled={!chatInput.trim() || isChatLoading}
                        className="bg-amber-500 text-slate-950 rounded-md"
                        data-testid="button-send-statute-chat"
                      >
                        <Send size={16} />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10 fade-in pb-20" data-testid="statute-search-page">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl md:text-5xl font-bold text-white italic tracking-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
            Search Statutes Instantly!
          </h2>
          <p className="text-slate-500 mt-2 font-medium">Search, read & consult AI on Pakistani statutes.</p>
        </div>
      </div>

      <div className="relative w-full max-w-2xl mx-auto" ref={searchRef}>
        <div className="flex gap-3 bg-[#1e293b] p-3 rounded-[2.5rem] border border-slate-800 shadow-2xl">
          <div className="flex items-center px-4">
            <Search size={18} className="text-slate-500" />
          </div>
          <input
            className="flex-1 bg-transparent border-none py-3 text-sm text-white focus:ring-0 focus:outline-none placeholder:text-slate-600"
            placeholder="Search statutes, acts, ordinances..."
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
            data-testid="input-statute-search"
          />
          {query && (
            <button
              onClick={() => { setQuery(""); setSuggestions([]); setShowDropdown(false); }}
              className="p-2 text-slate-500 hover:text-white transition-colors"
              data-testid="button-clear-search"
            >
              <X size={16} />
            </button>
          )}
          {isSearching && <Loader2 size={18} className="text-amber-500 animate-spin self-center mr-2" />}
          <button
            onClick={() => handleQuickSearch(query)}
            className="p-4 bg-amber-500 text-slate-950 rounded-[2rem] hover:bg-amber-400 transition-all shadow-xl active:scale-95"
            data-testid="button-statute-search"
          >
            <Search size={20} />
          </button>
        </div>

        {showDropdown && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-[#1e293b] border border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden max-h-[400px] overflow-y-auto" data-testid="search-dropdown">
            {suggestions.map((doc) => (
              <button
                key={doc.id}
                className="w-full text-left px-6 py-4 hover:bg-slate-700/50 transition-colors border-b border-slate-800 last:border-b-0 flex items-center gap-4"
                onClick={() => handleSelectStatute(doc)}
                data-testid={`dropdown-item-${doc.id}`}
              >
                <FileText size={16} className="text-slate-500 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white truncate">{doc.title}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">{doc.category}</p>
                </div>
                <ChevronRight size={14} className="text-slate-600 flex-shrink-0 ml-auto" />
              </button>
            ))}
          </div>
        )}
      </div>

      {isLoadingDoc && (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 size={40} className="animate-spin text-amber-500 mb-4" />
          <p className="text-sm text-slate-500 font-medium">Loading statute document...</p>
        </div>
      )}

      <div className="bg-[#1e293b] border border-slate-800 rounded-[3rem] p-8 md:p-10 shadow-2xl space-y-8 overflow-hidden relative">
        <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none scale-150"><Book size={200} /></div>
        <div className="flex items-center gap-4 relative z-10">
          <div className="p-3 bg-amber-500/10 text-amber-500 rounded-2xl"><Book size={24} /></div>
          <div>
            <h4 className="text-lg font-bold text-white tracking-tight uppercase italic" style={{ fontFamily: "'Playfair Display', serif" }}>
              Pakistani Legal Pillars: Quick Access
            </h4>
            <p className="text-[9px] text-slate-500 font-black uppercase tracking-[0.3em] mt-1">Direct statutory references — tap to search.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative z-10">
          {COMMON_STATUTES.map((cat, idx) => (
            <div key={idx} className="space-y-4">
              <div className="border-b border-slate-800 pb-3">
                <h5 className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-500 mb-1">{cat.category}</h5>
                <p className="text-[9px] text-slate-500 leading-relaxed italic">{cat.description}</p>
              </div>
              <div className="space-y-2">
                {cat.items.map((stat, i) => (
                  <button
                    key={i}
                    onClick={() => handleQuickSearch(stat.query)}
                    className="w-full text-left p-4 bg-[#0f172a] border border-slate-800 rounded-2xl transition-all hover:border-amber-500/50 group"
                    data-testid={`statute-quick-${idx}-${i}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-bold text-slate-300 group-hover:text-white transition-colors">{stat.label}</span>
                      <ChevronRight size={12} className="text-slate-700 group-hover:text-amber-500 transition-all" />
                    </div>
                    <p className="text-[9px] text-slate-600 group-hover:text-slate-400 transition-colors leading-relaxed line-clamp-2">{stat.detail}</p>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
