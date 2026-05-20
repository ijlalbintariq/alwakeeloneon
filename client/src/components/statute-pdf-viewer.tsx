import React, { useState, useEffect, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { ChevronLeft, ChevronRight, Loader2, ZoomIn, ZoomOut, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

// Configure the PDF.js worker using unpkg CDN to avoid bundler issues
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

interface StatutePdfViewerProps {
  fileUrl: string;
  onNavigateToSection?: (sectionId: string) => void;
}

export function StatutePdfViewer({ fileUrl, onNavigateToSection }: StatutePdfViewerProps) {
  const { toast } = useToast();
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.2);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Reset when file changes
    setPageNumber(1);
    setLoading(true);
    setLoadError(null);
  }, [fileUrl]);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setLoading(false);
    setLoadError(null);
  }

  function onDocumentLoadError(error: Error) {
    setLoading(false);
    setLoadError(error.message || "Failed to parse PDF file.");
    console.error("PDF Load Error:", error);
  }

  function handlePrevious() {
    setPageNumber((prev) => Math.max(prev - 1, 1));
  }

  function handleNext() {
    setPageNumber((prev) => Math.min(prev + 1, numPages));
  }

  function zoomIn() {
    setScale((prev) => Math.min(prev + 0.5, 3.0));
  }

  function zoomOut() {
    setScale((prev) => Math.max(prev - 0.5, 0.5));
  }

  // Intercept clicks on the container to catch hyperlink clicks in the annotation layer
  function handleContainerClick(e: React.MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    const anchor = target.closest("a");

    if (anchor) {
      e.preventDefault();
      const href = anchor.getAttribute("href");

      if (!href) return;

      // 1. Check if it's an internal hash or recognizable section reference
      if (href.startsWith("#") || href.toLowerCase().includes("section") || href.toLowerCase().includes("article")) {
        // If we have an external handler (e.g. to switch to text view), call it
        if (onNavigateToSection) {
          // Extract a section hint from the href
          const match = href.match(/(?:section|article|part)[\s-]*([a-z0-9]+)/i);
          if (match && match[1]) {
            onNavigateToSection(match[0]);
            toast({
              title: "Navigating to Reference",
              description: `Redirecting to ${match[0]}...`,
            });
            return;
          }
        }
      }

      // 2. External links validation
      try {
        const url = new URL(href, window.location.origin);
        
        // Prevent broken internal links disguised as root redirects (e.g., http://localhost:5001/#section-5)
        if (url.origin === window.location.origin) {
           const hashMatch = url.hash.match(/(?:section|article|part)[\s-]*([a-z0-9]+)/i);
           if (hashMatch && onNavigateToSection) {
             onNavigateToSection(hashMatch[0]);
             return;
           }
        }

        // Allow actual external links but warn the user
        toast({
          title: "External Link Verification",
          description: "Opening verified external reference in a new tab.",
        });
        window.open(url.toString(), "_blank", "noopener,noreferrer");

      } catch (err) {
        toast({
          title: "Invalid Hyperlink",
          description: "This document contains a broken or invalid hyperlink.",
          variant: "destructive",
        });
      }
    }
  }

  // Handle native PDF.js internal destination routing (e.g., #page=5)
  function handleItemClick({ pageNumber: destPage }: { destPage?: number }) {
    if (destPage && destPage >= 1 && destPage <= numPages) {
      setPageNumber(destPage);
      toast({
        title: "Internal Navigation",
        description: `Jumped to page ${destPage}`,
      });
    }
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 overflow-hidden relative">
      {/* Viewer Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-card border-b border-border shadow-sm z-10">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handlePrevious} disabled={pageNumber <= 1}>
            <ChevronLeft size={16} />
          </Button>
          <span className="text-sm font-medium text-muted-foreground w-24 text-center">
            {loading ? "Loading..." : `Page ${pageNumber} of ${numPages || "-"}`}
          </span>
          <Button variant="outline" size="icon" onClick={handleNext} disabled={!numPages || pageNumber >= numPages}>
            <ChevronRight size={16} />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={zoomOut} disabled={scale <= 0.5}>
            <ZoomOut size={16} />
          </Button>
          <span className="text-xs font-medium text-muted-foreground w-12 text-center">
            {Math.round(scale * 100)}%
          </span>
          <Button variant="outline" size="icon" onClick={zoomIn} disabled={scale >= 3.0}>
            <ZoomIn size={16} />
          </Button>
        </div>
      </div>

      {/* PDF Document Container */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-auto custom-scrollbar flex justify-center p-4 md:p-8"
        onClick={handleContainerClick}
      >
        <Document
          file={{ url: fileUrl, withCredentials: true }}
          onItemClick={handleItemClick}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={
            <div className="flex flex-col items-center justify-center mt-32 space-y-4">
              <Loader2 className="animate-spin text-primary w-8 h-8" />
              <p className="text-sm text-muted-foreground font-medium">Processing PDF document...</p>
            </div>
          }
          error={
            <div className="flex flex-col items-center justify-center mt-32 space-y-4 text-destructive p-8 bg-destructive/10 rounded-xl border border-destructive/20 text-center mx-4">
              <AlertCircle className="w-10 h-10 mb-2" />
              <p className="text-sm font-bold uppercase tracking-wider">PDF Load Error</p>
              <p className="text-xs max-w-sm leading-relaxed opacity-80">{loadError || "The document could not be loaded. Please verify the file exists."}</p>
              {loadError?.includes("CORS") && (
                <p className="text-xs text-muted-foreground mt-2 border-t border-destructive/20 pt-3">
                  This appears to be a Cross-Origin Resource Sharing (CORS) issue. The server hosting the PDF must allow access from this domain.
                </p>
              )}
            </div>
          }
          className="shadow-xl rounded-sm overflow-hidden border border-border/50 bg-white"
        >
          {numPages > 0 && (
            <Page
              pageNumber={pageNumber}
              scale={scale}
              renderTextLayer={true}
              renderAnnotationLayer={true}
              className="bg-white"
              loading={<div className="w-full h-full min-h-[600px] bg-white animate-pulse" />}
            />
          )}
        </Document>
      </div>
    </div>
  );
}
