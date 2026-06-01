import React, { useState, useEffect, useRef, useCallback } from "react";
import { Document, Page, Outline, pdfjs } from "react-pdf";
import { List as WindowedList } from "react-window";
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

// Configure the PDF.js worker to use the CDN-hosted build
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

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
  const currentPageRef = useRef(1);
  const [displayPage, setDisplayPage] = useState("1");
  const [pageCount, setPageCount] = useState("—");
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<{
    scrollToRow(config: {
      align?: "auto" | "center" | "end" | "smart" | "start";
      behavior?: "auto" | "instant" | "smooth";
      index: number;
    }): void;
  }>(null);
  const pdfDocRef = useRef<any>(null);
  const debounceTimerRef = useRef<any>(null);

  const [containerHeight, setContainerHeight] = useState(600);

  useEffect(() => {
    if (!wrapperRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });
    observer.observe(wrapperRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setLoading(true);
    setLoadError(null);
    currentPageRef.current = 1;
    setDisplayPage("1");
    setPageCount("—");
    setShowOutline(false);
    setHasOutline(false);
  }, [fileUrl]);

  // Debounced page display update
  const updatePageDisplay = useCallback((pageNum: number) => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      setDisplayPage(String(pageNum));
    }, 150);
  }, []);

  const onRowsRendered = useCallback((visibleRows: { startIndex: number; stopIndex: number }) => {
    const pageNum = visibleRows.startIndex + 1;
    if (pageNum !== currentPageRef.current) {
      currentPageRef.current = pageNum;
      updatePageDisplay(pageNum);
    }
  }, [updatePageDisplay]);

  const getItemSize = useCallback(
    (index: number) => {
      return 792 * scale + 24;
    },
    [scale]
  );

  function onDocumentLoadSuccess(pdf: any) {
    const n = pdf.numPages;
    setNumPages(n);
    setPageCount(String(n));
    setLoading(false);
    setLoadError(null);
    pdfDocRef.current = pdf;

    pdf
      .getOutline()
      .then((outline: any) => {
        if (outline && outline.length > 0) setHasOutline(true);
      })
      .catch(() => {});
  }

  function onDocumentLoadError(error: Error) {
    setLoading(false);
    setLoadError(error.message || "Failed to parse PDF file.");
    console.error("PDF Load Error:", error);
  }

  const scrollToPage = useCallback((pageNum: number) => {
    if (listRef.current) {
      listRef.current.scrollToRow({ index: pageNum - 1, align: "start" });
      currentPageRef.current = pageNum;
      setDisplayPage(String(pageNum));
    }
  }, []);

  const Row = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const pageNum = index + 1;
    return (
      <div
        style={style}
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
    );
  }, [scale]);

  function handlePageInputSubmit(e: React.FormEvent) {
    e.preventDefault();
    const num = parseInt(displayPage, 10);
    if (!isNaN(num) && num >= 1 && num <= numPages) {
      scrollToPage(num);
    } else {
      setDisplayPage(String(currentPageRef.current));
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



  // Outline item click — prevent default, scroll to page
  function handleOutlineItemClick(item: any) {
    const destPage = item.pageNumber ?? item.pageIndex;
    if (typeof destPage === "number" && destPage >= 1 && destPage <= numPages) {
      scrollToPage(destPage);
      return;
    }
    if (item.dest && pdfDocRef.current) {
      const destName = typeof item.dest === "string" ? item.dest : item.dest;
      pdfDocRef.current
        .getDestination(destName)
        .then((resolvedDest: any) => {
          if (resolvedDest)
            return pdfDocRef.current.getPageIndex(resolvedDest[0]);
          return null;
        })
        .then((idx: number | null) => {
          if (idx !== null && idx !== undefined) scrollToPage(idx + 1);
        })
        .catch(() => {});
    }
  }

  // Intercept annotation layer link clicks
  function handleContainerClick(e: React.MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    const anchor = target.closest("a");
    if (!anchor) return;

    const href = anchor.getAttribute("href");
    if (!href) return;

    e.preventDefault();
    e.stopPropagation();

    if (href.startsWith("#")) {
      const pageMatch = href.match(/page=(\d+)/i);
      if (pageMatch) {
        scrollToPage(parseInt(pageMatch[1], 10));
        return;
      }
      const sectionMatch = href.match(
        /(?:section|article|part)[\s-]*([a-z0-9]+)/i
      );
      if (sectionMatch && onNavigateToSection) {
        onNavigateToSection(sectionMatch[0]);
        return;
      }
      return;
    }

    try {
      const url = new URL(href, window.location.origin);
      if (url.origin === window.location.origin) {
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
        toast({
          title: "Internal Reference",
          description:
            "This link appears to be an internal document reference.",
        });
        return;
      }
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

  const pageNumbers = React.useMemo(
    () => Array.from({ length: numPages }, (_, i) => i + 1),
    [numPages]
  );

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 overflow-hidden relative">
      {/* Toolbar — always on top, outside <Document> */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-card border-b border-border shadow-sm z-10 gap-2 flex-wrap">
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
            onClick={() => scrollToPage(currentPageRef.current - 1)}
            disabled={currentPageRef.current <= 1}
          >
            <ChevronLeft size={15} />
          </Button>
          <form
            onSubmit={handlePageInputSubmit}
            className="flex items-center gap-1"
          >
            <input
              type="text"
              value={displayPage}
              onChange={(e) => setDisplayPage(e.target.value)}
              onBlur={() => setDisplayPage(String(currentPageRef.current))}
              className="w-10 h-7 text-center text-xs bg-background border border-border rounded-md text-foreground focus:outline-none focus:border-primary/50"
            />
            <span className="text-xs text-muted-foreground">/ {pageCount}</span>
          </form>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => scrollToPage(currentPageRef.current + 1)}
            disabled={numPages === 0 || currentPageRef.current >= numPages}
          >
            <ChevronRight size={15} />
          </Button>
        </div>

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

      {/* Document wrapper — contains BOTH outline sidebar and pages so
          the <Outline> component can access the PDF document context */}
      <Document
        file={fileUrl}
        options={{ withCredentials: true }}
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
              {loadError || "The document could not be loaded."}
            </p>
          </div>
        }
        className="flex-1 flex overflow-hidden min-h-0 relative"
      >
        {/* Outline Sidebar — slides in from the left over the PDF content */}
        <div
          className={`absolute top-0 left-0 h-full z-30 transition-transform duration-300 ease-in-out ${
            showOutline ? "translate-x-0" : "-translate-x-full"
          }`}
          style={{ width: 280 }}
        >
          <div className="h-full w-full bg-card border-r border-border shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-border bg-background flex-shrink-0">
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
                  <p className="text-xs">No outline available.</p>
                  <p className="text-[10px] mt-1 opacity-60">
                    Use the toolbar to navigate pages.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div
          ref={wrapperRef}
          className="flex-1 overflow-hidden min-w-0"
          onClick={handleContainerClick}
        >
          {numPages > 0 && (
            <WindowedList
              listRef={listRef as any}
              style={{ height: containerHeight, overflowY: "auto" }}
              rowCount={numPages}
              rowHeight={getItemSize}
              rowComponent={Row as any}
              onRowsRendered={onRowsRendered}
              rowProps={{}}
            />
          )}
        </div>
      </Document>
    </div>
  );
}
