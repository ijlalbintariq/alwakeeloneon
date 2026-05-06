import { useState } from "react";
import { X, FileText, ChevronUp, ChevronDown, Search, ZoomIn, ZoomOut } from "lucide-react";
import { createPortal } from "react-dom";

interface DocumentViewerProps {
  title: string;
  filename?: string;
  content: string;
  sourceLabel?: string;
  onClose: () => void;
}

export function DocumentViewer({ title, filename, content, sourceLabel, onClose }: DocumentViewerProps) {
  const [fontSize, setFontSize] = useState(13);
  const [searchTerm, setSearchTerm] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  const pages = splitIntoPages(content, 3000);

  const highlightText = (text: string) => {
    if (!searchTerm.trim()) return escapeHtml(text);
    const parts = text.split(new RegExp(`(${escapeRegex(searchTerm)})`, "gi"));
    return parts.map((part, i) =>
      part.toLowerCase() === searchTerm.toLowerCase()
        ? `<mark class="bg-primary/40 text-foreground rounded px-0.5">${escapeHtml(part)}</mark>`
        : escapeHtml(part)
    ).join("");
  };

  return createPortal(
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4"
      style={{ zIndex: 10000 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-[#1a1f2e] border border-border rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-3 sm:px-4 py-3 bg-[#151a28] border-b border-border/80 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
              <FileText size={16} className="text-primary" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-foreground truncate">{title}</h2>
              <div className="flex items-center gap-2">
                {filename && <p className="text-[10px] text-muted-foreground truncate">{filename}</p>}
                {sourceLabel && (
                  <span className="text-[8px] px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full font-bold uppercase tracking-widest flex-shrink-0">
                    {sourceLabel}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Search"
            >
              <Search size={14} />
            </button>
            <button
              onClick={() => setFontSize(Math.max(10, fontSize - 1))}
              className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Zoom out"
            >
              <ZoomOut size={14} />
            </button>
            <button
              onClick={() => setFontSize(Math.min(20, fontSize + 1))}
              className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Zoom in"
            >
              <ZoomIn size={14} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors ml-1"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {showSearch && (
          <div className="px-4 py-2 bg-[#151a28] border-b border-border/50 flex-shrink-0">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search in document..."
              className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              autoFocus
            />
          </div>
        )}

        <div className="flex-1 overflow-y-auto bg-[#2a2f3e] p-4 sm:p-8">
          <div className="max-w-3xl mx-auto space-y-6">
            {pages.map((pageContent, pageIndex) => (
              <div
                key={pageIndex}
                className="bg-white rounded-lg shadow-xl relative"
                style={{ minHeight: "400px" }}
              >
                <div className="absolute top-3 right-4 text-[9px] text-muted-foreground font-mono select-none">
                  Page {pageIndex + 1} of {pages.length}
                </div>

                <div className="p-8 sm:p-12 pt-10">
                  {pageIndex === 0 && (
                    <div className="mb-6 pb-4 border-b-2 border-border">
                      <h1 className="text-lg font-bold text-foreground leading-snug" style={{ fontFamily: "'Playfair Display', serif" }}>
                        {title}
                      </h1>
                      {sourceLabel && (
                        <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-widest font-bold">{sourceLabel}</p>
                      )}
                    </div>
                  )}

                  <div
                    className="text-foreground leading-[1.8] whitespace-pre-wrap break-words"
                    style={{ fontSize: `${fontSize}px`, fontFamily: "'Georgia', 'Times New Roman', serif" }}
                    dangerouslySetInnerHTML={{
                      __html: highlightText(pageContent)
                    }}
                  />
                </div>

                <div className="absolute bottom-3 left-0 right-0 text-center">
                  <span className="text-[8px] text-muted-foreground font-mono">— {pageIndex + 1} —</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="px-3 sm:px-4 py-2 bg-[#151a28] border-t border-border/80 flex items-center justify-between text-[10px] text-muted-foreground flex-shrink-0">
          <span>{pages.length} page{pages.length !== 1 ? "s" : ""}</span>
          <span className="font-bold uppercase tracking-widest hidden sm:inline">Al Wakeelo Digital Chambers</span>
          <span className="hidden sm:inline">Font: {fontSize}px</span>
        </div>
      </div>
    </div>,
    document.body
  );
}

function splitIntoPages(content: string, charsPerPage: number): string[] {
  const pages: string[] = [];
  const lines = content.split("\n");
  let currentPage = "";

  for (const line of lines) {
    if (currentPage.length + line.length + 1 > charsPerPage && currentPage.length > 0) {
      pages.push(currentPage.trimEnd());
      currentPage = line + "\n";
    } else {
      currentPage += line + "\n";
    }
  }

  if (currentPage.trim()) {
    pages.push(currentPage.trimEnd());
  }

  return pages.length > 0 ? pages : ["No content available."];
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
