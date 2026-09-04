import React, { useEffect, useState } from "react";
import {
  FileText,
  X,
  Download,
  ExternalLink,
  Loader2,
  FileCode,
  Sparkles,
} from "lucide-react";

interface DocumentViewerModalProps {
  documentId: number;
  title: string;
  sourceType?: string | null;
  onClose: () => void;
}

export const DocumentViewerModal: React.FC<DocumentViewerModalProps> = ({
  documentId,
  title,
  sourceType,
  onClose,
}) => {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const isPdf = sourceType === "pdf" || title.toLowerCase().endsWith(".pdf");

  useEffect(() => {
    if (isPdf) {
      setLoading(false);
      return;
    }

    setLoading(true);
    fetch(`/api/documents/${documentId}`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load document content");
        return res.json();
      })
      .then((data) => {
        setContent(data.content || "No extracted text preview available.");
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [documentId, isPdf]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />

      <div
        className="relative bg-white dark:bg-[#131E2E] border border-[#E5E4E2] dark:border-[#1E2D44] rounded-2xl shadow-lg w-full max-w-5xl h-[88vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-black/20 border-b border-[#E5E4E2] dark:border-[#1E2D44] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#1A1A1A]/5 dark:bg-[#1A1A1A]/50 border border-[#1A1A1A]/20 dark:border-[#1E2D44] flex items-center justify-center shrink-0 text-[#1A1A1A] dark:text-[#F8FAFC]">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-[#1A1A1A] dark:text-[#F8FAFC] truncate">{title}</h2>
              <p className="text-[10px] text-[#666666] dark:text-[#94A3B8] dark:text-[#475569] font-mono uppercase">
                {sourceType || "Document"} Preview · Alwakeelo Secure Vault
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href={`/api/documents/${documentId}/file`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F5F4F2] dark:bg-[#0B131E] hover:bg-[#EBEBEB] dark:bg-[#1E2D44] text-[#2D2D2D] dark:text-[#CBD5E1] text-xs font-semibold border border-[#E5E4E2] dark:border-[#1E2D44] transition-colors"
              title="Download original file"
            >
              <Download className="w-3.5 h-3.5 text-[#1A1A1A] dark:text-[#F8FAFC]" />
              <span className="hidden sm:inline">Download</span>
            </a>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#666666] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#1A1A1A] dark:text-[#F8FAFC] hover:bg-[#F5F4F2] dark:bg-[#0B131E] transition-colors"
              title="Close Preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-hidden bg-white dark:bg-[#131E2E] relative">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-[#1A1A1A] dark:text-[#F8FAFC]">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="text-xs font-mono">Loading document preview...</span>
            </div>
          ) : isPdf ? (
            <iframe
              src={`/api/documents/${documentId}/file`}
              className="w-full h-full border-0"
              title={title}
            />
          ) : error ? (
            <div className="h-full flex flex-col items-center justify-center p-6 text-center space-y-3">
              <p className="text-sm text-red-400">{error}</p>
              <a
                href={`/api/documents/${documentId}/file`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1A1A1A] text-white font-bold text-xs"
              >
                <Download className="w-4 h-4" />
                <span>Download File Directly</span>
              </a>
            </div>
          ) : (
            <div className="h-full overflow-y-auto p-6 sm:p-8 space-y-4">
              <div className="p-4 rounded-xl bg-[#FAFAF9] border border-[#E5E4E2] dark:border-[#1E2D44] text-xs text-[#666666] dark:text-[#94A3B8] dark:text-[#475569] flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#1A1A1A] dark:text-[#F8FAFC]" />
                  Extracted Text & Document Content
                </span>
                <span className="font-mono text-[10px]">
                  {content?.length || 0} characters
                </span>
              </div>
              <pre className="text-xs sm:text-sm text-[#2D2D2D] dark:text-[#CBD5E1] whitespace-pre-wrap font-mono leading-relaxed bg-[#FAFAF9] p-6 rounded-xl border border-[#E5E4E2] dark:border-[#1E2D44]">
                {content}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default DocumentViewerModal;
