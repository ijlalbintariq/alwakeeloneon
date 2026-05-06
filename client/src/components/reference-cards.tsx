import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { BookOpen, Gavel, ChevronRight, X, Loader2, Scale, List, FileText, ExternalLink } from "lucide-react";
import { DocumentViewer } from "./document-viewer";

interface LawReference {
  name: string;
  section: string;
  description: string;
}

interface JudgmentReference {
  citation: string;
  court: string;
  description: string;
}

interface ParsedReferences {
  laws: LawReference[];
  judgments: JudgmentReference[];
}

interface StatuteLookupResult {
  found: boolean;
  statutes?: Array<{ shortTitle: string; section: string; description: string; punishment: string }>;
  documents?: Array<{ id: number; title: string; content: string; category: string }>;
  knowledgeVault?: Array<{ title: string; content: string }>;
}

interface TocEntry {
  id: string;
  text: string;
  level: number;
}

function parseToc(content: string): TocEntry[] {
  const entries: TocEntry[] = [];
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    let match: RegExpMatchArray | null;

    match = line.match(/^(CHAPTER|PART|TITLE|SCHEDULE)\s+[IVXLCDM\d]+/i);
    if (match) {
      entries.push({ id: `toc-${i}`, text: line.substring(0, 80), level: 1 });
      continue;
    }

    match = line.match(/^(Section|Article|Sec\.?|Art\.?)\s+\d+/i);
    if (match) {
      entries.push({ id: `toc-${i}`, text: line.substring(0, 80), level: 2 });
      continue;
    }

    match = line.match(/^\d+[\.\)]\s+[A-Z]/);
    if (match && line.length > 10 && line.length < 120) {
      entries.push({ id: `toc-${i}`, text: line.substring(0, 80), level: 3 });
      continue;
    }

    if (/^[A-Z][A-Z\s]{5,}$/.test(line) && line.length < 80) {
      entries.push({ id: `toc-${i}`, text: line, level: 1 });
    }
  }
  return entries;
}

export function parseReferences(content: string): { cleanContent: string; references: ParsedReferences | null } {
  const refFencedPattern = /```references\s*\n?([\s\S]*?)\n?```/gi;
  const genericFencedPattern = /```(?:json)?\s*\n?([\s\S]*?)\n?```/gi;
  const parseJsonLoose = (raw: string): any | null => {
    const text = raw.trim();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      try {
        return JSON.parse(text.replace(/,\s*([}\]])/g, "$1"));
      } catch {
        return null;
      }
    }
  };
  const normalizeLaws = (input: any): LawReference[] =>
    (Array.isArray(input) ? input : [])
      .map((l: any) => ({
        name: String(l?.name || "").trim(),
        section: String(l?.section || "").trim(),
        description: String(l?.description || "").trim(),
      }))
      .filter((l: LawReference) => l.name.length > 0 || l.section.length > 0)
      .slice(0, 10);
  const normalizeJudgments = (input: any): JudgmentReference[] =>
    (Array.isArray(input) ? input : [])
      .map((j: any) => ({
        citation: String(j?.citation || "").trim(),
        court: String(j?.court || "").trim(),
        description: String(j?.description || "").trim(),
      }))
      .filter((j: JudgmentReference) => j.citation.length > 0)
      .slice(0, 10);

  let chosenIndex = -1;
  let chosenLength = 0;
  let chosenPayload: any = null;
  const tryCapture = (raw: string, index: number, fullLength: number) => {
    const parsed = parseJsonLoose(raw);
    if (!parsed || (!Array.isArray(parsed.laws) && !Array.isArray(parsed.judgments))) return;
    chosenPayload = parsed;
    chosenIndex = index;
    chosenLength = fullLength;
  };

  let match: RegExpExecArray | null;
  while ((match = refFencedPattern.exec(content)) !== null) {
    tryCapture(match[1] || "", match.index, match[0].length);
  }

  if (!chosenPayload) {
    while ((match = genericFencedPattern.exec(content)) !== null) {
      tryCapture(match[1] || "", match.index, match[0].length);
    }
  }

  if (!chosenPayload) {
    const jsonTailPattern = /(\{[\s\S]*?"laws"\s*:\s*\[[\s\S]*?\]\s*,\s*"judgments"\s*:\s*\[[\s\S]*?\][\s\S]*?\})\s*$/i;
    const tailMatch = content.match(jsonTailPattern);
    if (tailMatch && typeof tailMatch.index === "number") {
      tryCapture(tailMatch[1], tailMatch.index, tailMatch[1].length);
    }
  }

  if (!chosenPayload) {
    // Patterns to detect and remove malformed JSON artifacts
    const malformedJsonPatterns = [
      // Pattern 1: Properly formed JSON at end but incomplete
      /\n?\s*(?:references\s*)?\{\s*"laws"\s*:\s*[^,\}\n]*\s*,\s*"judgments"\s*:\s*[^\}\n]*\s*\}\s*$/i,
      // Pattern 2: Malformed JSON without proper colons/values anywhere in content
      /\n?\s*(?:references\s*)?\{\s*"laws"\s*[:;,]?\s*[,:]?\s*"judgments"\s*[:;,]?\s*\}\s*?(?=\n|$)/i,
      /\n?\s*(?:references\s*)?\{\s*"judgments"\s*[:;,]?\s*[,:]?\s*"laws"\s*[:;,]?\s*\}\s*?(?=\n|$)/i,
      // Pattern 3: Catch anywhere in content (not just at end)
      /\n?\s*\{\s*"laws"\s*[:;,]?\s*[,:]?\s*"judgments"\s*[:;,]?\s*\}/i,
      /\n?\s*\{\s*"judgments"\s*[:;,]?\s*[,:]?\s*"laws"\s*[:;,]?\s*\}/i,
    ];

    // Try to find and remove malformed JSON
    for (const pattern of malformedJsonPatterns) {
      const match = content.match(pattern);
      if (match && typeof match.index === "number") {
        // For end-of-content patterns, cut at the match
        if (pattern.source.includes("$")) {
          return { cleanContent: content.slice(0, match.index).trimEnd(), references: null };
        }
        // For mid-content patterns, remove the matched JSON and continue
        const cleaned = content.slice(0, match.index) + content.slice(match.index + match[0].length);
        return { cleanContent: cleaned.trimEnd(), references: null };
      }
    }
    return { cleanContent: content, references: null };
  }

  const cleanContent = chosenIndex >= 0
    ? `${content.slice(0, chosenIndex).trimEnd()}${content.slice(chosenIndex + chosenLength).trimEnd()}`
    : content;

  const refs: ParsedReferences = {
    laws: normalizeLaws(chosenPayload.laws),
    judgments: normalizeJudgments(chosenPayload.judgments),
  };
  if (refs.laws.length === 0 && refs.judgments.length === 0) {
    return { cleanContent, references: null };
  }

  return { cleanContent, references: refs };
}

function LawDetailPopup({ law, onClose }: { law: LawReference; onClose: () => void }) {
  const [lookupData, setLookupData] = useState<StatuteLookupResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [showToc, setShowToc] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchLaw = async () => {
      try {
        const params = new URLSearchParams({ name: law.name, section: law.section });
        const res = await fetch(`/api/statute-lookup?${params}`, { credentials: "include" });
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          setLookupData(data);
        } else {
          setLoadError(true);
        }
      } catch {
        if (!cancelled) setLoadError(true);
      }
      if (!cancelled) setIsLoading(false);
    };
    fetchLaw();
    return () => { cancelled = true; };
  }, [law.name, law.section]);

  const tocEntries = useMemo(() => {
    if (!lookupData) return [];
    const allContent: string[] = [];
    lookupData.documents?.forEach(d => allContent.push(d.content));
    lookupData.knowledgeVault?.forEach(g => allContent.push(g.content));
    return parseToc(allContent.join("\n"));
  }, [lookupData]);

  const scrollToSection = (text: string) => {
    const container = document.getElementById("law-detail-content");
    if (!container) return;
    const allText = container.innerText;
    const idx = allText.indexOf(text.substring(0, 30));
    if (idx === -1) return;

    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    let charCount = 0;
    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      charCount += node.textContent?.length || 0;
      if (charCount >= idx) {
        const el = node.parentElement;
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
          el.classList.add("bg-primary/20");
          setTimeout(() => el.classList.remove("bg-primary/20"), 2000);
        }
        break;
      }
    }
  };

  const hasToc = tocEntries.length > 0;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-h-[85vh] flex"
        style={{ maxWidth: hasToc && showToc ? "56rem" : "42rem" }}
        onClick={(e) => e.stopPropagation()}
      >
        {hasToc && showToc && (
          <div className="w-64 flex-shrink-0 border-r border-border overflow-y-auto bg-background rounded-l-2xl">
            <div className="sticky top-0 bg-background border-b border-border p-3 z-10">
              <div className="flex items-center gap-2">
                <List size={14} className="text-primary" />
                <span className="text-xs font-bold text-primary uppercase tracking-wider">Table of Contents</span>
              </div>
            </div>
            <div className="p-2 space-y-0.5">
              {tocEntries.map((entry, i) => (
                <button
                  key={i}
                  onClick={() => scrollToSection(entry.text)}
                  className="w-full text-left px-2 py-1.5 rounded-lg text-xs hover:bg-card transition-colors truncate"
                  style={{ paddingLeft: `${(entry.level - 1) * 12 + 8}px` }}
                >
                  <span className={entry.level === 1 ? "text-primary font-semibold" : entry.level === 2 ? "text-foreground" : "text-muted-foreground"}>
                    {entry.text}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="sticky top-0 bg-card border-b border-border p-4 flex items-center justify-between rounded-t-2xl z-10">
            <div className="flex items-center gap-2">
              <Scale size={16} className="text-primary" />
              <h3 className="text-sm font-bold text-foreground">Law Reference</h3>
            </div>
            <div className="flex items-center gap-2">
              {hasToc && (
                <button
                  onClick={() => setShowToc(!showToc)}
                  className={`p-1.5 rounded-lg transition-colors ${showToc ? "bg-primary/20 text-primary" : "hover:bg-muted text-muted-foreground hover:text-foreground"}`}
                  title="Toggle Table of Contents"
                >
                  <List size={16} />
                </button>
              )}
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                <X size={16} />
              </button>
            </div>
          </div>
          <div id="law-detail-content" className="p-5 space-y-4 overflow-y-auto flex-1">
            <div>
              <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest mb-1">Statute / Act</p>
              <p className="text-lg font-bold text-foreground">{law.name}</p>
            </div>
            {law.section && (
              <div>
                <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest mb-1">Section</p>
                <p className="text-sm text-primary font-semibold">{law.section}</p>
              </div>
            )}
            <div>
              <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest mb-1">AI Summary</p>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{law.description}</p>
            </div>

            {isLoading && (
              <div className="flex items-center justify-center py-6 gap-3">
                <Loader2 size={18} className="animate-spin text-primary" />
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Loading from Knowledge Vault...</p>
              </div>
            )}

            {!isLoading && lookupData?.found && (
              <div className="border-t border-border pt-4 space-y-4">
                <p className="text-[10px] text-emerald-400 font-black uppercase tracking-widest">Knowledge Vault Match</p>

                {lookupData.statutes && lookupData.statutes.map((s, i) => (
                  <div key={i} className="bg-card/50 border border-border rounded-xl p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-primary/10 border border-primary/20 rounded text-[9px] font-black uppercase text-primary">
                        {s.shortTitle}
                      </span>
                      <span className="text-[10px] text-muted-foreground">Section {s.section}</span>
                    </div>
                    <p className="text-sm text-foreground leading-relaxed">{s.description}</p>
                    {s.punishment && (
                      <p className="text-xs text-muted-foreground">
                        <span className="text-primary/70 font-semibold">Punishment/Remedy: </span>{s.punishment}
                      </p>
                    )}
                  </div>
                ))}

                {lookupData.documents && lookupData.documents.map((d, i) => (
                  <div key={i} className="bg-card/50 border border-border rounded-xl p-4 space-y-2">
                    <p className="text-sm font-bold text-foreground">{d.title}</p>
                    <span className="inline-block px-2 py-0.5 bg-muted rounded text-[9px] text-muted-foreground uppercase">{d.category}</span>
                    <div className="max-h-[300px] overflow-y-auto mt-2">
                      <pre className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground font-mono">{d.content}</pre>
                    </div>
                  </div>
                ))}

                {lookupData.knowledgeVault && lookupData.knowledgeVault.map((g, i) => (
                  <div key={i} className="bg-card/50 border border-border rounded-xl p-4 space-y-2">
                    <p className="text-sm font-bold text-foreground">{g.title}</p>
                    <div className="max-h-[300px] overflow-y-auto mt-2">
                      <pre className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground font-mono">{g.content}</pre>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!isLoading && !loadError && lookupData && !lookupData.found && (
              <div className="border-t border-border pt-4">
                <p className="text-xs text-muted-foreground italic">No additional details found in the Knowledge Vault for this provision. The AI summary above is based on the response context.</p>
              </div>
            )}

            {loadError && (
              <div className="border-t border-border pt-4">
                <p className="text-xs text-red-400/70 italic">Could not load additional details. The AI summary above is still available.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function ReferencePopup({ onClose, children, title }: { onClose: () => void; children: React.ReactNode; title: string }) {
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-card border border-border rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-card border-b border-border p-4 flex items-center justify-between rounded-t-2xl z-10">
          <h3 className="text-sm font-bold text-foreground">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>,
    document.body
  );
}

interface CaseLawLookup {
  found: boolean;
  id?: number;
  citation?: string;
  court?: string;
  title?: string;
  summary?: string;
  hasSource?: boolean;
  sourceType?: string;
  sourceFilename?: string;
}

interface SourceDocument {
  found: boolean;
  title?: string;
  content?: string;
  filename?: string;
  sourceType?: string;
  citation?: string;
  mimeType?: string | null;
  originalFileAvailable?: boolean;
  viewUrl?: string | null;
  message?: string;
}

function JudgmentDetailPopup({ judgment, onClose }: { judgment: JudgmentReference; onClose: () => void }) {
  const [lookupData, setLookupData] = useState<CaseLawLookup | null>(null);
  const [sourceDoc, setSourceDoc] = useState<SourceDocument | null>(null);
  const [isLoadingLookup, setIsLoadingLookup] = useState(true);
  const [isLoadingSource, setIsLoadingSource] = useState(false);
  const [showDocViewer, setShowDocViewer] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchLookup = async () => {
      try {
        const params = new URLSearchParams({ citation: judgment.citation });
        const res = await fetch(`/api/case-law/lookup?${params}`, { credentials: "include" });
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          setLookupData(data);
        }
      } catch {}
      if (!cancelled) setIsLoadingLookup(false);
    };
    fetchLookup();
    return () => { cancelled = true; };
  }, [judgment.citation]);

  const handleViewSource = async () => {
    if (!lookupData?.id || !lookupData.hasSource) return;
    setIsLoadingSource(true);
    try {
      const res = await fetch(`/api/case-law/${lookupData.id}/source`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setSourceDoc(data);
        if (data.found && data.viewUrl) {
          window.open(data.viewUrl, "_blank", "noopener,noreferrer");
        } else if (data.found && data.content) {
          setShowDocViewer(true);
        }
      }
    } catch {}
    setIsLoadingSource(false);
  };

  const sourceLabel = lookupData?.sourceType === "github" ? "Legal Library" :
    lookupData?.sourceType === "admin" ? "Knowledge Vault" :
    lookupData?.sourceType === "statute" ? "Statute Library" :
    lookupData?.sourceType === "user" ? "User Documents" : "Source";

  return (
    <>
      {createPortal(
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ zIndex: 9999 }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <div
            className="bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-card border-b border-border p-4 flex items-center justify-between rounded-t-2xl z-10">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Gavel size={14} className="text-primary" />
                Judgment Reference
              </h3>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest mb-1">Citation</p>
                <p className="text-lg font-bold text-foreground">{judgment.citation}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest mb-1">Court</p>
                <p className="text-sm text-primary font-semibold">{judgment.court}</p>
              </div>

              {lookupData?.found && lookupData.title && (
                <div>
                  <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest mb-1">Case Title</p>
                  <p className="text-sm text-foreground font-semibold">{lookupData.title}</p>
                </div>
              )}

              <div>
                <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest mb-1">Summary</p>
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                  {lookupData?.found && lookupData.summary && lookupData.summary.length > judgment.description.length
                    ? lookupData.summary
                    : judgment.description}
                </p>
              </div>

              {isLoadingLookup && (
                <div className="flex items-center gap-2 text-muted-foreground text-xs">
                  <Loader2 size={12} className="animate-spin" />
                  Checking knowledge base...
                </div>
              )}

              {lookupData?.found && lookupData.hasSource && (
                <button
                  onClick={handleViewSource}
                  disabled={isLoadingSource}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary/10 border border-primary/30 rounded-xl text-primary text-sm font-semibold hover:bg-primary/20 transition-colors disabled:opacity-50"
                >
                  {isLoadingSource ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <FileText size={16} />
                  )}
                  {isLoadingSource ? "Loading Document..." : "Open Case Law Document"}
                  <span className="text-[10px] text-primary/60 ml-1">({sourceLabel})</span>
                </button>
              )}

              {lookupData?.found && !lookupData.hasSource && !isLoadingLookup && (
                <div className="flex items-center gap-2 px-3 py-2 bg-card/50 rounded-lg text-[11px] text-muted-foreground">
                  <FileText size={12} />
                  Found in database (no linked source document)
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {showDocViewer && sourceDoc?.found && sourceDoc.content && (
        <DocumentViewer
          title={sourceDoc.title || judgment.citation}
          filename={sourceDoc.filename}
          content={sourceDoc.content}
          sourceLabel={sourceLabel}
          onClose={() => setShowDocViewer(false)}
        />
      )}
    </>
  );
}

export function ReferenceCards({ references }: { references: ParsedReferences }) {
  const [selectedLaw, setSelectedLaw] = useState<LawReference | null>(null);
  const [selectedJudgment, setSelectedJudgment] = useState<JudgmentReference | null>(null);

  return (
    <>
      <div className="mt-4 pt-4 border-t border-border/50 space-y-3" data-testid="reference-cards-container">
        {references.laws.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <BookOpen size={13} className="text-primary" />
              <span className="text-[10px] font-black uppercase tracking-widest text-primary/80" data-testid="text-relevant-laws-label">Relevant Laws</span>
              <ChevronRight size={12} className="text-muted-foreground" />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {references.laws.map((law, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setSelectedLaw(law);
                  }}
                  onTouchEnd={(e) => {
                    e.stopPropagation();
                  }}
                  className="flex-shrink-0 bg-card/80 border border-border/50 rounded-xl p-3 text-left max-w-[260px] transition-all hover:bg-muted/50 hover:border-primary/30 active:scale-[0.98] cursor-pointer select-none"
                  style={{ touchAction: "manipulation" }}
                  data-testid={`card-law-${i}`}
                >
                  <p className="text-xs font-bold text-foreground truncate" data-testid={`text-law-name-${i}`}>
                    {law.name}
                  </p>
                  {law.section && (
                    <p className="text-[10px] text-primary/70 font-semibold mt-0.5" data-testid={`text-law-section-${i}`}>{law.section}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed" data-testid={`text-law-description-${i}`}>
                    {law.description}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {references.judgments.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Gavel size={13} className="text-primary" />
              <span className="text-[10px] font-black uppercase tracking-widest text-primary/80" data-testid="text-relevant-judgments-label">Relevant Judgments</span>
              <ChevronRight size={12} className="text-muted-foreground" />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {references.judgments.map((judgment, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setSelectedJudgment(judgment);
                  }}
                  onTouchEnd={(e) => {
                    e.stopPropagation();
                  }}
                  className="flex-shrink-0 bg-card/80 border border-border/50 rounded-xl p-3 text-left max-w-[260px] transition-all hover:bg-muted/50 hover:border-primary/30 active:scale-[0.98] cursor-pointer select-none"
                  style={{ touchAction: "manipulation" }}
                  data-testid={`card-judgment-${i}`}
                >
                  <p className="text-xs font-bold text-foreground truncate" data-testid={`text-judgment-citation-${i}`}>
                    {judgment.citation}
                  </p>
                  <p className="text-[10px] text-primary/70 font-semibold mt-0.5" data-testid={`text-judgment-court-${i}`}>{judgment.court}</p>
                  <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed" data-testid={`text-judgment-description-${i}`}>
                    {judgment.description}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {selectedLaw && (
        <LawDetailPopup law={selectedLaw} onClose={() => setSelectedLaw(null)} />
      )}

      {selectedJudgment && (
        <JudgmentDetailPopup judgment={selectedJudgment} onClose={() => setSelectedJudgment(null)} />
      )}
    </>
  );
}
