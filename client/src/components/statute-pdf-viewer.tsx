import React, { useState, useEffect, useRef, useCallback } from "react";
import { Document, Page, Outline, pdfjs } from "react-pdf";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  ZoomIn,
  ZoomOut,
  AlertCircle,
  List,
  X,
  ChevronsUp,
  RotateCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

// Configure the PDF.js worker to use the local build
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

interface StatutePdfViewerProps {
  fileUrl: string;
  onNavigateToSection?: (sectionId: string) => void;
}

export function StatutePdfViewer({
  fileUrl,
  onNavigateToSection,
}: StatutePdfViewerProps) {
  const { toast } = useToast();
  const [numPages, setNumPages] = useState<number>(0);
  const [scale, setScale] = useState<number>(1.0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showOutline, setShowOutline] = useState(false);
  const [hasOutline, setHasOutline] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const pdfDocRef = useRef<any>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    setLoading(true);
    setLoadError(null);
    setCurrentPage(1);
    setPageInput("1");
    setShowOutline(false);
    setHasOutline(false);
    pageRefs.current.clear();
  }, [fileUrl]);

  // Track which page is currently visible via IntersectionObserver
  useEffect(() => {
    if (numPages === 0) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        // Find the most visible page
        let bestEntry: IntersectionObserverEntry | null = null;
        for (const entry of entries) {
          if (
            entry.isIntersecting &&
            (!bestEntry ||
              entry.intersectionRatio > bestEntry.intersectionRatio)
          ) {
            bestEntry = entry;
          }
        }
        if (bestEntry) {
          const pageNum = Number(
            (bestEntry.target as HTMLElement).dataset.pageNumber
          );
          if (pageNum && pageNum !== currentPage) {
            setCurrentPage(pageNum);
            setPageInput(String(pageNum));
          }
        }
      },
      {
        root: containerRef.current,
        threshold: [0.1, 0.3, 0.5, 0.7],
      }
    );

    pageRefs.current.forEach((el) => {
      observerRef.current?.observe(el);
    });

    return () => {
      observerRef.current?.disconnect();
    };
  }, [numPages, loading]);

  function onDocumentLoadSuccess(pdf: any) {
    setNumPages(pdf.numPages);
    setLoading(false);
    setLoadError(null);
    pdfDocRef.current = pdf;

    // Check if the PDF has an outline/bookmarks
    pdf.getOutline().then((outline: any) => {
      if (outline && outline.length > 0) {
        setHasOutline(true);
      }
    });
  }

  function onDocumentLoadError(error: Error) {
    setLoading(false);
    setLoadError(error.message || "Failed to parse PDF file.");
    console.error("PDF Load Error:", error);
  }

  // Scroll to a specific page in the continuous scroll view
  const scrollToPage = useCallback(
    (pageNum: number) => {
      if (pageNum < 1 || pageNum > numPages) return;
      const el = pageRefs.current.get(pageNum);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        setCurrentPage(pageNum);
        setPageInput(String(pageNum));
      }
    },
    [numPages]
  );

  function handlePageInputSubmit(e: React.FormEvent) {
    e.preventDefault();
    const num = parseInt(pageInput, 10);
    if (!isNaN(num) && num >= 1 && num <= numPages) {
      scrollToPage(num);
    } else {
      setPageInput(String(currentPage));
    }
  }

  function zoomIn() {
    setScale((prev) => Math.min(prev + 0.25, 4.0));
  }

  function zoomOut() {
    setScale((prev) => Math.max(prev - 0.25, 0.5));
  }

  function resetZoom() {
    setScale(1.0);
  }

  // Register page refs for the intersection observer
  const setPageRef = useCallback(
    (pageNumber: number, el: HTMLDivElement | null) => {
      if (el) {
        pageRefs.current.set(pageNumber, el);
        observerRef.current?.observe(el);
      } else {
        pageRefs.current.delete(pageNumber);
      }
    },
    []
  );

  // Handle clicks on the outline/bookmark sidebar items
  function handleOutlineItemClick({ dest, pageNumber: destPage }: any) {
    if (typeof destPage === "number" && destPage >= 1 && destPage <= numPages) {
      scrollToPage(destPage);
    } else if (dest) {
      // pdfjs named destination — resolve to page number
      pdfDocRef.current?.getDestination(dest).then((resolvedDest: any) => {
        if (resolvedDest) {
          pdfDocRef.current?.getPageIndex(resolvedDest[0]).then((idx: number) => {
            scrollToPage(idx + 1);
          });
        }
      });
    }
  }

  // Intercept clicks on annotation layer links
  function handleContainerClick(e: React.MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    const anchor = target.closest("a");

    if (!anchor) return;

    const href = anchor.getAttribute("href");
    const internalDest = anchor.getAttribute("data-dest");

    // Internal named destination (set by react-pdf annotation layer)
    if (internalDest) {
      e.preventDefault();
      e.stopPropagation();
      try {
        const dest = JSON.parse(internalDest);
        if (dest && pdfDocRef.current) {
          pdfDocRef.current.getPageIndex(dest[0]).then((idx: number) => {
            scrollToPage(idx + 1);
          });
        }
      } catch {
        // Not a valid JSON dest, ignore
      }
      return;
    }

    if (!href) return;

    e.preventDefault();
    e.stopPropagation();

    // Internal page hash links (e.g., #page=5, #section-10)
    if (href.startsWith("#")) {
      const pageMatch = href.match(/page=(\d+)/i);
      if (pageMatch) {
        scrollToPage(parseInt(pageMatch[1], 10));
        return;
      }
      // Section/article references
      const sectionMatch = href.match(
        /(?:section|article|part)[\s-]*([a-z0-9]+)/i
      );
      if (sectionMatch && onNavigateToSection) {
        onNavigateToSection(sectionMatch[0]);
        return;
      }
      return;
    }

    // Check if it's a same-origin link that should stay internal
    try {
      const url = new URL(href, window.location.origin);

      if (url.origin === window.location.origin) {
        // Likely a broken internal link encoded as absolute URL
        const hashSection = url.hash.match(
          /(?:section|article|part)[\s-]*([a-z0-9]+)/i
        );
        if (hashSection && onNavigateToSection) {
          onNavigateToSection(hashSection[0]);
          return;
        }
        const hashPage = url.hash.match(/page=(\d+)/i);
        if (hashPage) {
          scrollToPage(parseInt(hashPage[1], 10));
          return;
        }
        // Block same-origin links that would navigate away
        toast({
          title: "Internal Reference",
          description:
            "This link appears to be an internal document reference.",
        });
        return;
      }

      // Genuine external link — open safely
      toast({
        title: "Opening External Link",
        description: `Navigating to ${url.hostname}`,
      });
      window.open(url.toString(), "_blank", "noopener,noreferrer");
    } catch {
      toast({
        title: "Invalid Hyperlink",
        description: "This document contains a broken or invalid hyperlink.",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="flex h-full bg-slate-50 dark:bg-slate-900 overflow-hidden relative">
      {/* Outline Sidebar */}
      {showOutline && (
        <div className="w-[280px] min-w-[240px] border-r border-border bg-card flex flex-col overflow-hidden z-20">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-border bg-background">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
              Document Outline
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setShowOutline(false)}
            >
              <X size={14} />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 text-sm outline-sidebar">
            {hasOutline ? (
              <Outline
                onItemClick={handleOutlineItemClick}
                className="react-pdf-outline"
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-4 text-muted-foreground">
                <List size={24} className="mb-2 opacity-40" />
                <p className="text-xs">
                  No bookmarks or outline available in this document.
                </p>
                <p className="text-[10px] mt-1 opacity-60">
                  Page navigation is available via the toolbar above.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Viewer Area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Viewer Toolbar */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-card border-b border-border shadow-sm z-10 gap-2 flex-wrap">
          {/* Left: Outline + Page Nav */}
          <div className="flex items-center gap-1.5">
            <Button
              variant={showOutline ? "default" : "outline"}
              size="icon"
              className="h-8 w-8"
              onClick={() => setShowOutline((v) => !v)}
              title="Toggle document outline"
            >
              <List size={15} />
            </Button>

            <div className="h-5 w-px bg-border mx-1" />

            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => scrollToPage(currentPage - 1)}
              disabled={currentPage <= 1}
            >
              <ChevronLeft size={15} />
            </Button>

            <form
              onSubmit={handlePageInputSubmit}
              className="flex items-center gap-1"
            >
              <input
                type="text"
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value)}
                onBlur={() => setPageInput(String(currentPage))}
                className="w-10 h-7 text-center text-xs bg-background border border-border rounded-md text-foreground focus:outline-none focus:border-primary/50"
              />
              <span className="text-xs text-muted-foreground">
                / {numPages || "—"}
              </span>
            </form>

            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => scrollToPage(currentPage + 1)}
              disabled={!numPages || currentPage >= numPages}
            >
              <ChevronRight size={15} />
            </Button>
          </div>

          {/* Right: Zoom Controls */}
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={zoomOut}
              disabled={scale <= 0.5}
            >
              <ZoomOut size={15} />
            </Button>

            <button
              onClick={resetZoom}
              className="text-xs font-medium text-muted-foreground hover:text-foreground w-12 text-center transition-colors"
              title="Reset to 100%"
            >
              {Math.round(scale * 100)}%
            </button>

            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={zoomIn}
              disabled={scale >= 4.0}
            >
              <ZoomIn size={15} />
            </Button>

            <div className="h-5 w-px bg-border mx-0.5" />

            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={resetZoom}
              title="Reset zoom to 100%"
            >
              <RotateCw size={13} />
            </Button>

            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => scrollToPage(1)}
              title="Scroll to top"
            >
              <ChevronsUp size={15} />
            </Button>
          </div>
        </div>

        {/* PDF Document Container — continuous vertical scroll with horizontal overflow */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto"
          onClick={handleContainerClick}
          style={{
            scrollBehavior: "smooth",
          }}
        >
          <Document
            file={{ url: fileUrl, withCredentials: true }}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={
              <div className="flex flex-col items-center justify-center mt-32 space-y-4">
                <Loader2 className="animate-spin text-primary w-8 h-8" />
                <p className="text-sm text-muted-foreground font-medium">
                  Processing PDF document...
                </p>
              </div>
            }
            error={
              <div className="flex flex-col items-center justify-center mt-32 space-y-4 text-destructive p-8 bg-destructive/10 rounded-xl border border-destructive/20 text-center mx-4">
                <AlertCircle className="w-10 h-10 mb-2" />
                <p className="text-sm font-bold uppercase tracking-wider">
                  PDF Load Error
                </p>
                <p className="text-xs max-w-sm leading-relaxed opacity-80">
                  {loadError ||
                    "The document could not be loaded. Please verify the file exists."}
                </p>
              </div>
            }
          >
            {/* Render ALL pages for continuous scroll */}
            {numPages > 0 &&
              Array.from({ length: numPages }, (_, i) => i + 1).map(
                (pageNum) => (
                  <div
                    key={`page-${pageNum}`}
                    ref={(el) => setPageRef(pageNum, el)}
                    data-page-number={pageNum}
                    className="flex justify-center py-2"
                  >
                    <div className="shadow-lg bg-white border border-border/30">
                      <Page
                        pageNumber={pageNum}
                        scale={scale}
                        renderTextLayer={true}
                        renderAnnotationLayer={true}
                        className="bg-white"
                        loading={
                          <div
                            className="bg-white animate-pulse flex items-center justify-center"
                            style={{
                              width: `${612 * scale}px`,
                              height: `${792 * scale}px`,
                            }}
                          >
                            <Loader2
                              size={20}
                              className="animate-spin text-muted-foreground/30"
                            />
                          </div>
                        }
                      />
                    </div>
                  </div>
                )
              )}
          </Document>
        </div>
      </div>
    </div>
  );
}
