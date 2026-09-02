import React, { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  FileText,
  Upload,
  Link2,
  Eye,
  Download,
  Trash2,
  Loader2,
  FileCode,
  FileSpreadsheet,
  File,
  Plus,
  Sparkles,
  Copy,
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { DocumentViewerModal } from "./DocumentViewerModal";
import { LinkDocumentModal } from "./LinkDocumentModal";
import { cn } from "@/lib/utils";

export interface CaseDocument {
  id: number;
  caseId: number;
  documentId: number;
  label?: string | null;
  addedAt?: string;
  docTitle?: string;
  docSourceType?: string | null;
  fileSize?: number;
}

interface DocumentsVaultProps {
  caseId: number;
  documents: CaseDocument[];
}

export const DocumentsVault: React.FC<DocumentsVaultProps> = ({
  caseId,
  documents,
}) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [previewDoc, setPreviewDoc] = useState<{
    documentId: number;
    title: string;
    sourceType?: string | null;
  } | null>(null);

  const [showLinkModal, setShowLinkModal] = useState<boolean>(false);
  const [dragOver, setDragOver] = useState<boolean>(false);

  // Upload file & link
  const uploadAndLinkMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const uploadedDocIds: number[] = [];

      for (const file of files) {
        const formData = new FormData();
        formData.append("files", file);
        const res = await fetch("/api/documents/upload", {
          method: "POST",
          body: formData,
          credentials: "include",
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.message || "Upload failed");
        }

        const payload = await res.json();
        const docs = payload?.documents || [];
        for (const doc of docs) {
          uploadedDocIds.push(doc.id);
        }
      }

      for (const docId of uploadedDocIds) {
        await apiRequest("POST", `/api/case-files/${caseId}/documents`, {
          documentId: docId,
        });
      }

      return uploadedDocIds.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: [`/api/case-files/${caseId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/case-files"] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({
        title: "Documents Vault Updated",
        description: `Uploaded and linked ${count} document${count > 1 ? "s" : ""}.`,
      });
    },
    onError: (err: any) => {
      toast({
        title: "Upload Failed",
        description: err?.message || "Failed to upload and link document.",
        variant: "destructive",
      });
    },
  });

  // Unlink document
  const unlinkMutation = useMutation({
    mutationFn: async (documentId: number) => {
      return apiRequest("DELETE", `/api/case-files/${caseId}/documents/${documentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/case-files/${caseId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/case-files"] });
      toast({ title: "Document unlinked from case" });
    },
    onError: (err: any) => {
      toast({
        title: "Failed to unlink document",
        description: err?.message || "Could not unlink document from case.",
        variant: "destructive",
      });
    },
  });

  const getDocIcon = (title: string, sourceType?: string | null) => {
    const ext = (sourceType || title.split(".").pop() || "").toLowerCase();
    if (ext === "pdf") return "text-rose-600 bg-rose-50 border-rose-200";
    if (ext === "docx" || ext === "doc")
      return "text-blue-600 bg-blue-50 border-blue-200";
    if (ext === "xlsx" || ext === "xls")
      return "text-emerald-700 bg-emerald-50 border-emerald-200";
    return "text-[#105B38] bg-emerald-50 border-emerald-200";
  };

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    uploadAndLinkMutation.mutate(files);
  };

  return (
    <div className="space-y-4">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.doc,.docx,.txt"
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {/* 1. Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white border border-[#E2E8F0] shadow-xs">
        <div>
          <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#105B38]" />
            <span>Case Documents Vault & Annexures</span>
          </h3>
          <p className="text-xs text-[#64748B] mt-0.5">
            Secure cloud storage for pleadings, Vakalatnamas, impugned orders, and evidence.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowLinkModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#0F172A] text-xs font-bold border border-[#E2E8F0] transition-colors"
          >
            <Link2 className="w-3.5 h-3.5 text-[#105B38]" />
            <span>Link from Vault</span>
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadAndLinkMutation.isPending}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#105B38] hover:bg-[#0D4A2E] text-white font-bold text-xs transition-colors shadow-xs disabled:opacity-50"
          >
            {uploadAndLinkMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5" />
            )}
            <span>Upload Document</span>
          </button>
        </div>
      </div>

      {/* 2. Drag & Drop Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "p-6 rounded-2xl border-2 border-dashed transition-all cursor-pointer text-center space-y-2",
          dragOver
            ? "border-[#105B38] bg-emerald-50/40 shadow-xs"
            : "border-[#E2E8F0] hover:border-[#105B38]/50 bg-white"
        )}
      >
        <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto text-[#105B38]">
          <Upload className="w-5 h-5" />
        </div>
        <p className="text-xs font-semibold text-[#0F172A]">
          Drag & drop PDF, Word DOCX, or scanned legal files here, or{" "}
          <span className="text-[#105B38] underline font-bold">browse</span>
        </p>
        <p className="text-xs text-[#64748B]">
          Automatic OCR indexing for Pakistani court documents
        </p>
      </div>

      {/* 3. Linked Documents List */}
      {documents.length === 0 ? (
        <div className="p-8 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] text-center space-y-2">
          <FileText className="w-8 h-8 text-[#94A3B8] mx-auto" />
          <p className="text-xs font-bold text-[#0F172A]">
            No documents linked to this case file yet.
          </p>
          <p className="text-xs text-[#64748B]">
            Upload your Vakalatnama, impugned orders, or petition drafts.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {documents.map((doc) => {
            const title = doc.docTitle || doc.label || "Document";
            const iconStyle = getDocIcon(title, doc.docSourceType);

            return (
              <div
                key={doc.id}
                className="p-3.5 rounded-2xl bg-white border border-[#E2E8F0] hover:border-[#105B38]/40 hover:shadow-xs transition-all flex items-center justify-between gap-3 group"
              >
                <div
                  className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                  onClick={() =>
                    setPreviewDoc({
                      documentId: doc.documentId,
                      title,
                      sourceType: doc.docSourceType,
                    })
                  }
                >
                  <div
                    className={cn(
                      "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border",
                      iconStyle
                    )}
                  >
                    <FileText className="w-4 h-4" />
                  </div>

                  <div className="min-w-0 space-y-0.5">
                    <p className="text-xs font-bold text-[#0F172A] group-hover:text-[#105B38] truncate transition-colors">
                      {title}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-[#64748B]">
                      {doc.label && (
                        <span className="font-semibold text-[#105B38]">
                          {doc.label}
                        </span>
                      )}
                      {doc.addedAt && (
                        <span>
                          Added{" "}
                          {new Date(doc.addedAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(`${title}`);
                      toast({
                        title: "Citation Copied",
                        description: "Document reference copied to clipboard.",
                      });
                    }}
                    className="p-2 rounded-xl text-[#64748B] hover:text-[#105B38] hover:bg-[#F8FAFC] transition-colors"
                    title="Copy Citation"
                  >
                    <Copy className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setPreviewDoc({
                        documentId: doc.documentId,
                        title,
                        sourceType: doc.docSourceType,
                      })
                    }
                    className="p-2 rounded-xl text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC] transition-colors"
                    title="Preview Document & OCR"
                  >
                    <Eye className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("Unlink this document from the case file?")) {
                        unlinkMutation.mutate(doc.documentId);
                      }
                    }}
                    disabled={unlinkMutation.isPending}
                    className="p-2 rounded-xl text-[#64748B] hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50"
                    title="Unlink from Case"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Document Viewer Modal */}
      {previewDoc && (
        <DocumentViewerModal
          documentId={previewDoc.documentId}
          title={previewDoc.title}
          sourceType={previewDoc.sourceType}
          onClose={() => setPreviewDoc(null)}
        />
      )}

      {/* Link Document Modal */}
      {showLinkModal && (
        <LinkDocumentModal
          caseId={caseId}
          linkedDocumentIds={new Set(documents.map((d) => d.documentId))}
          onClose={() => setShowLinkModal(false)}
        />
      )}
    </div>
  );
};

export default DocumentsVault;
