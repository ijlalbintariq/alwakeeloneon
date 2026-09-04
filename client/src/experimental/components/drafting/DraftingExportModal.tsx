import React, { useState } from "react";
import {
  Download,
  FileText,
  Printer,
  Copy,
  Check,
  X,
  FileDown,
  Sparkles,
  Shield,
  Layers,
} from "lucide-react";
import { generateLegalPDF } from "@/lib/generate-legal-pdf";
import { generateLegalDocx } from "@/lib/generate-legal-docx";
import { useToast } from "@/hooks/use-toast";
import type { LegalPageProfileId } from "@/lib/legal-page-layout";

interface DraftingExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentTitle: string;
  documentHtml: string;
  documentText: string;
  pageProfileId: LegalPageProfileId;
}

export const DraftingExportModal: React.FC<DraftingExportModalProps> = ({
  isOpen,
  onClose,
  documentTitle,
  documentHtml,
  documentText,
  pageProfileId,
}) => {
  const { toast } = useToast();
  const [selectedFormat, setSelectedFormat] = useState<"pdf" | "docx" | "print" | "text">("pdf");
  const [watermark, setWatermark] = useState<string>("none");
  const [includeLineNumbers, setIncludeLineNumbers] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  if (!isOpen) return null;

  const handleExport = async () => {
    setIsExporting(true);
    try {
      if (selectedFormat === "pdf") {
        generateLegalPDF({
          title: documentTitle || "Legal_Pleading",
          html: documentHtml,
          pageProfileId: pageProfileId,
          isDraft: watermark === "DRAFT",
        });
        toast({
          title: "PDF Export Complete",
          description: `Downloaded court-formatted PDF (${pageProfileId === "court-legal" ? "Court Legal" : "A4"}).`,
        });
        onClose();
      } else if (selectedFormat === "docx") {
        await generateLegalDocx({
          title: documentTitle || "Legal_Pleading",
          html: documentHtml,
          pageProfileId: pageProfileId,
        });
        toast({
          title: "DOCX Export Complete",
          description: "Downloaded Word (.docx) document formatted to Times New Roman 13pt.",
        });
        onClose();
      } else if (selectedFormat === "print") {
        window.print();
        onClose();
      } else if (selectedFormat === "text") {
        await navigator.clipboard.writeText(documentText);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
        toast({
          title: "Copied to Clipboard",
          description: "Document text copied in standard legal plaintext format.",
        });
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to generate document export.";
      toast({
        title: "Export Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const getExportButtonLabel = () => {
    if (selectedFormat === "text") {
      return isCopied ? "Copied!" : "Copy Text";
    }
    if (selectedFormat === "print") {
      return "Open Print Dialog";
    }
    return `Download ${selectedFormat.toUpperCase()}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/20 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] rounded-2xl max-w-lg w-full flex flex-col shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="p-4 border-b border-[#E2E8F0] dark:border-[#1E2D44] flex items-start justify-between gap-3 bg-[#F8FAFC] dark:bg-[#0B131E]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-[#105B38] border border-emerald-200 dark:border-emerald-500/20 shadow-xs">
              <FileDown className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                Export Court Document
              </h2>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">
                Pakistani Court Legal & Commercial standard formatting
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F1F5F9] dark:bg-[#1E2D44] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Format Selector Grid */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">
              Select Export Format
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSelectedFormat("pdf")}
                className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                  selectedFormat === "pdf"
                    ? "bg-emerald-50/7 dark:bg-emerald-500/100 dark:bg-emerald-500/10 border-[#105B38] text-[#0F172A] dark:text-[#F8FAFC] shadow-xs"
                    : "bg-white dark:bg-[#131E2E] border-[#E2E8F0] dark:border-[#1E2D44] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F8FAFC] dark:bg-[#0B131E]"
                }`}
              >
                <FileText className={`w-5 h-5 ${selectedFormat === "pdf" ? "text-[#105B38]" : "text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]"}`} />
                <div>
                  <div className="text-xs font-bold">Court PDF (.pdf)</div>
                  <div className="text-[10px] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">1.25&quot; margin, pagination & seal</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedFormat("docx")}
                className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                  selectedFormat === "docx"
                    ? "bg-emerald-50/7 dark:bg-emerald-500/100 dark:bg-emerald-500/10 border-[#105B38] text-[#0F172A] dark:text-[#F8FAFC] shadow-xs"
                    : "bg-white dark:bg-[#131E2E] border-[#E2E8F0] dark:border-[#1E2D44] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F8FAFC] dark:bg-[#0B131E]"
                }`}
              >
                <Download className={`w-5 h-5 ${selectedFormat === "docx" ? "text-[#105B38]" : "text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]"}`} />
                <div>
                  <div className="text-xs font-bold">Microsoft Word (.docx)</div>
                  <div className="text-[10px] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">Times New Roman 13pt editable</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedFormat("print")}
                className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                  selectedFormat === "print"
                    ? "bg-emerald-50/7 dark:bg-emerald-500/100 dark:bg-emerald-500/10 border-[#105B38] text-[#0F172A] dark:text-[#F8FAFC] shadow-xs"
                    : "bg-white dark:bg-[#131E2E] border-[#E2E8F0] dark:border-[#1E2D44] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F8FAFC] dark:bg-[#0B131E]"
                }`}
              >
                <Printer className={`w-5 h-5 ${selectedFormat === "print" ? "text-[#105B38]" : "text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]"}`} />
                <div>
                  <div className="text-xs font-bold">Direct Print Preview</div>
                  <div className="text-[10px] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">Send directly to court printer</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedFormat("text")}
                className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                  selectedFormat === "text"
                    ? "bg-emerald-50/7 dark:bg-emerald-500/100 dark:bg-emerald-500/10 border-[#105B38] text-[#0F172A] dark:text-[#F8FAFC] shadow-xs"
                    : "bg-white dark:bg-[#131E2E] border-[#E2E8F0] dark:border-[#1E2D44] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F8FAFC] dark:bg-[#0B131E]"
                }`}
              >
                <Copy className={`w-5 h-5 ${selectedFormat === "text" ? "text-[#105B38]" : "text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]"}`} />
                <div>
                  <div className="text-xs font-bold">Copy Plaintext / Markdown</div>
                  <div className="text-[10px] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">Quick copy for filings/WhatsApp</div>
                </div>
              </button>
            </div>
          </div>

          {/* PDF Options */}
          {selectedFormat === "pdf" && (
            <div className="p-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#334155] dark:text-[#CBD5E1] font-semibold">Watermark:</span>
                <select
                  value={watermark}
                  onChange={(e) => setWatermark(e.target.value)}
                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] text-xs text-[#0F172A] dark:text-[#F8FAFC] font-semibold focus:outline-none"
                >
                  <option value="none">None (Final Filing)</option>
                  <option value="DRAFT">DRAFT</option>
                  <option value="COURT COPY">COURT COPY</option>
                  <option value="CONFIDENTIAL">CONFIDENTIAL</option>
                  <option value="OFFICE COPY">OFFICE COPY</option>
                </select>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-[#E2E8F0] dark:border-[#1E2D44]">
                <span className="text-xs text-[#334155] dark:text-[#CBD5E1] font-semibold">Paper Standard:</span>
                <span className="text-xs font-mono font-bold text-[#105B38]">
                  {pageProfileId === "court-legal" ? "Court Legal (8.5×14 in)" : "A4 Court (210×297 mm)"}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-[#E2E8F0] dark:border-[#1E2D44] bg-[#F8FAFC] dark:bg-[#0B131E] flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-[#475569] hover:bg-[#F1F5F9] dark:bg-[#1E2D44] border border-[#E2E8F0] dark:border-[#1E2D44] transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#105B38] hover:bg-[#0D4A2E] text-white text-xs font-bold shadow-xs transition-all active:scale-95 disabled:opacity-50"
          >
            {selectedFormat === "text" ? (
              isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>{getExportButtonLabel()}</span>
          </button>
        </div>
      </div>
    </div>
  );
};


