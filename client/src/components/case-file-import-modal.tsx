import { useState, useEffect, useCallback } from "react";
import { X, Search, FolderOpen, FileText, ChevronLeft, Loader2, CheckSquare, Square } from "lucide-react";

/* ─── Local API response types ──────────────────────────────────────────── */

type CaseFileListItem = {
  id: number;
  title: string;
  caseType: string;
  court: string | null;
  caseNumber: string | null;
  status: string;
  documentCount: number;
  clientCount: number;
  primaryClient: string | null;
};

type CaseDocument = {
  id: number;
  caseId: number;
  documentId: number;
  label: string | null;
  addedAt: string;
  docTitle: string;
  docSourceType: string | null;
};

type CaseFileDetail = {
  id: number;
  title: string;
  caseType: string;
  court: string | null;
  documents: CaseDocument[];
};

/* ─── Props ─────────────────────────────────────────────────────────────── */

interface CaseFileImportModalProps {
  open: boolean;
  onClose: () => void;
  onImport: (files: File[]) => void;
}

/* ─── Component ─────────────────────────────────────────────────────────── */

export function CaseFileImportModal({ open, onClose, onImport }: CaseFileImportModalProps) {
  // Step 1 state — case list
  const [cases, setCases] = useState<CaseFileListItem[]>([]);
  const [casesLoading, setCasesLoading] = useState(false);
  const [casesError, setCasesError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Step 2 state — document selection
  const [selectedCase, setSelectedCase] = useState<CaseFileDetail | null>(null);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsError, setDocsError] = useState<string | null>(null);
  const [selectedDocIds, setSelectedDocIds] = useState<Set<number>>(new Set());

  // Import state
  const [importing, setImporting] = useState(false);

  /* ── Fetch case list ─────────────────────────────────────────────────── */

  const fetchCases = useCallback(async () => {
    setCasesLoading(true);
    setCasesError(null);
    try {
      const res = await fetch("/api/case-files", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch case files");
      const data: CaseFileListItem[] = await res.json();
      setCases(data);
    } catch (err) {
      setCasesError(err instanceof Error ? err.message : "Failed to load cases");
    } finally {
      setCasesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchCases();
      // Reset state when opening
      setSelectedCase(null);
      setSelectedDocIds(new Set());
      setSearchQuery("");
      setImporting(false);
    }
  }, [open, fetchCases]);

  /* ── Fetch case detail (step 2) ──────────────────────────────────────── */

  const selectCase = useCallback(async (caseId: number) => {
    setDocsLoading(true);
    setDocsError(null);
    setSelectedDocIds(new Set());
    try {
      const res = await fetch(`/api/case-files/${caseId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch case details");
      const data: CaseFileDetail = await res.json();
      setSelectedCase(data);
    } catch (err) {
      setDocsError(err instanceof Error ? err.message : "Failed to load case details");
    } finally {
      setDocsLoading(false);
    }
  }, []);

  /* ── Document selection helpers ──────────────────────────────────────── */

  const toggleDoc = (docId: number) => {
    setSelectedDocIds((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) {
        next.delete(docId);
      } else {
        next.add(docId);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (!selectedCase) return;
    const docs = selectedCase.documents;
    if (selectedDocIds.size === docs.length) {
      setSelectedDocIds(new Set());
    } else {
      setSelectedDocIds(new Set(docs.map((d) => d.documentId)));
    }
  };

  /* ── Import handler ──────────────────────────────────────────────────── */

  const handleImport = async () => {
    if (!selectedCase || selectedDocIds.size === 0) return;
    setImporting(true);

    const docsToImport = selectedCase.documents.filter((d) => selectedDocIds.has(d.documentId));
    const files: File[] = [];

    for (const doc of docsToImport) {
      try {
        // Try fetching the binary file
        const res = await fetch(`/api/documents/${doc.documentId}/file`, { credentials: "include" });

        if (res.ok) {
          const blob = await res.blob();
          const contentType = res.headers.get("content-type") || "application/octet-stream";

          // Extract filename from Content-Disposition header
          const disposition = res.headers.get("content-disposition") || "";
          const filenameMatch = disposition.match(/filename="([^"]+)"/);
          const filename = filenameMatch
            ? filenameMatch[1]
            : `${doc.docTitle.replace(/[^a-zA-Z0-9._\- ]/g, "_")}.pdf`;

          const file = new File([blob], filename, { type: contentType });
          files.push(file);
        } else {
          // Fallback: create a text file from the document title as placeholder
          // Fetch the document data to get text content
          const docRes = await fetch(`/api/documents/${doc.documentId}`, { credentials: "include" });
          if (docRes.ok) {
            const docData = await docRes.json();
            const textContent = docData.content || `Document: ${doc.docTitle}`;
            const textBlob = new Blob([textContent], { type: "text/plain" });
            const file = new File(
              [textBlob],
              `${doc.docTitle.replace(/[^a-zA-Z0-9._\- ]/g, "_")}.txt`,
              { type: "text/plain" }
            );
            files.push(file);
          }
        }
      } catch {
        // Skip documents that fail to fetch
        console.error(`Failed to fetch document ${doc.documentId}`);
      }
    }

    if (files.length > 0) {
      onImport(files);
    }
    setImporting(false);
  };

  /* ── Render gate ─────────────────────────────────────────────────────── */

  if (!open) return null;

  /* ── Filtered cases ──────────────────────────────────────────────────── */

  const filteredCases = searchQuery.trim()
    ? cases.filter((c) => c.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : cases;

  const allSelected =
    selectedCase !== null &&
    selectedCase.documents.length > 0 &&
    selectedDocIds.size === selectedCase.documents.length;

  /* ── JSX ─────────────────────────────────────────────────────────────── */

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-2xl border border-primary/30 bg-card shadow-[0_24px_60px_-30px_rgba(0,0,0,0.7)] flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            {selectedCase && (
              <button
                type="button"
                onClick={() => {
                  setSelectedCase(null);
                  setSelectedDocIds(new Set());
                  setDocsError(null);
                }}
                className="rounded-lg p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground"
                aria-label="Back to case list"
              >
                <ChevronLeft size={14} />
              </button>
            )}
            <FolderOpen size={16} className="text-primary" />
            <h2 className="text-sm font-bold text-foreground">
              {selectedCase ? selectedCase.title : "Import from Case File"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        {/* ── Body ────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-4">
          {!selectedCase ? (
            /* ── Step 1: Case List ──────────────────────────────────── */
            <>
              {/* Search */}
              <div className="relative mb-3">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search cases..."
                  className="w-full rounded-lg border border-border bg-card text-foreground text-xs pl-9 pr-3 py-2 focus:outline-none focus:border-primary/50"
                />
              </div>

              {casesLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={18} className="animate-spin text-primary" />
                  <span className="ml-2 text-xs text-muted-foreground">Loading cases...</span>
                </div>
              )}

              {casesError && (
                <div className="text-xs text-red-400 py-4 text-center">{casesError}</div>
              )}

              {!casesLoading && !casesError && filteredCases.length === 0 && (
                <div className="text-xs text-muted-foreground py-8 text-center">
                  {searchQuery ? "No cases match your search." : "No case files found."}
                </div>
              )}

              <div className="space-y-1.5">
                {filteredCases.map((caseItem) => (
                  <button
                    key={caseItem.id}
                    type="button"
                    onClick={() => selectCase(caseItem.id)}
                    className="w-full text-left rounded-lg border border-border bg-card/40 p-3 hover:border-primary/40 hover:bg-card/70 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-foreground truncate">{caseItem.title}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                            {caseItem.caseType}
                          </span>
                          {caseItem.court && (
                            <span className="text-[10px] text-muted-foreground truncate">
                              {caseItem.court}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap flex items-center gap-1">
                        <FileText size={10} />
                        {caseItem.documentCount} doc{caseItem.documentCount !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </>
          ) : (
            /* ── Step 2: Document Selection ─────────────────────────── */
            <>
              {docsLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={18} className="animate-spin text-primary" />
                  <span className="ml-2 text-xs text-muted-foreground">Loading documents...</span>
                </div>
              )}

              {docsError && (
                <div className="text-xs text-red-400 py-4 text-center">{docsError}</div>
              )}

              {!docsLoading && !docsError && selectedCase.documents.length === 0 && (
                <div className="text-xs text-muted-foreground py-8 text-center">
                  No documents linked to this case.
                </div>
              )}

              {!docsLoading && !docsError && selectedCase.documents.length > 0 && (
                <>
                  {/* Select All / Deselect All toggle */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] text-muted-foreground">
                      {selectedDocIds.size} of {selectedCase.documents.length} selected
                    </span>
                    <button
                      type="button"
                      onClick={toggleAll}
                      className="text-[11px] text-primary hover:text-primary/80 font-medium"
                    >
                      {allSelected ? "Deselect All" : "Select All"}
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    {selectedCase.documents.map((doc) => {
                      const isChecked = selectedDocIds.has(doc.documentId);
                      return (
                        <button
                          key={doc.documentId}
                          type="button"
                          onClick={() => toggleDoc(doc.documentId)}
                          className={`w-full text-left rounded-lg border p-3 transition-colors flex items-center gap-3 ${
                            isChecked
                              ? "border-primary/50 bg-primary/5"
                              : "border-border bg-card/40 hover:border-primary/30"
                          }`}
                        >
                          {isChecked ? (
                            <CheckSquare size={14} className="text-primary shrink-0" />
                          ) : (
                            <Square size={14} className="text-muted-foreground shrink-0" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-foreground truncate">
                              {doc.docTitle}
                            </p>
                            {doc.docSourceType && (
                              <span className="text-[10px] text-muted-foreground">
                                {doc.docSourceType}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-border shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="text-xs px-3 py-2 rounded-lg border border-border text-foreground hover:bg-muted"
          >
            Cancel
          </button>
          {selectedCase && selectedCase.documents.length > 0 && (
            <button
              type="button"
              onClick={handleImport}
              disabled={selectedDocIds.size === 0 || importing}
              className="text-xs px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  Import Selected ({selectedDocIds.size})
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
