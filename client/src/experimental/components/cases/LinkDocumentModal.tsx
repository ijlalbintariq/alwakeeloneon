import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Link2,
  Search,
  FileText,
  X,
  Loader2,
  Calendar,
  Check,
  Building,
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface LinkDocumentModalProps {
  caseId: number;
  linkedDocumentIds: Set<number>;
  onClose: () => void;
}

interface VaultDocument {
  id: number;
  title: string;
  sourceType?: string | null;
  createdAt: string;
  fileSize?: number;
}

export const LinkDocumentModal: React.FC<LinkDocumentModalProps> = ({
  caseId,
  linkedDocumentIds,
  onClose,
}) => {
  const { toast } = useToast();
  const [search, setSearch] = useState<string>("");
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [label, setLabel] = useState<string>("");

  const { data: allDocs = [], isLoading } = useQuery<VaultDocument[]>({
    queryKey: ["/api/documents"],
  });

  const linkMutation = useMutation({
    mutationFn: async ({
      docId,
      docLabel,
    }: {
      docId: number;
      docLabel?: string;
    }) => {
      return apiRequest("POST", `/api/case-files/${caseId}/documents`, {
        documentId: docId,
        label: docLabel || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/case-files/${caseId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/case-files"] });
      toast({ title: "Document linked to case file" });
      onClose();
    },
    onError: (err: any) => {
      toast({
        title: "Link failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const availableDocs = allDocs.filter(
    (d) =>
      !linkedDocumentIds.has(d.id) &&
      (!search.trim() ||
        d.title.toLowerCase().includes(search.toLowerCase().trim()))
  );

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />

      <div
        className="relative bg-white dark:bg-[#131E2E] border border-[#E5E4E2] dark:border-[#1E2D44] rounded-2xl shadow-lg max-w-lg w-full p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-[#E5E4E2] dark:border-[#1E2D44]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#1A1A1A]/5 dark:bg-[#1A1A1A]/50 border border-[#1A1A1A]/20 dark:border-[#1E2D44] flex items-center justify-center text-[#1A1A1A] dark:text-[#F8FAFC]">
              <Link2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold font-serif text-[#1A1A1A] dark:text-[#F8FAFC]">
                Link Document from Knowledge Vault
              </h2>
              <p className="text-[11px] text-[#666666] dark:text-[#94A3B8] dark:text-[#475569]">
                Attach pleadings, annexures, or orders to this case
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#666666] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#2D2D2D] dark:text-[#CBD5E1]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-[#666666] dark:text-[#94A3B8] dark:text-[#475569] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search documents by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white dark:bg-[#131E2E] border border-[#E5E4E2] dark:border-[#1E2D44] rounded-xl pl-9 pr-4 py-2 text-xs text-[#1A1A1A] dark:text-[#F8FAFC] placeholder:text-[#666666] dark:text-[#94A3B8] dark:text-[#475569] outline-none focus:border-[#1A1A1A]/50"
          />
        </div>

        {/* Optional Label */}
        {selectedDocId && (
          <div className="p-3 rounded-xl bg-white dark:bg-[#131E2E] border border-[#1A1A1A]/20 dark:border-[#1E2D44] space-y-1.5">
            <label className="text-[10px] font-mono uppercase text-[#1A1A1A] dark:text-[#F8FAFC] block font-semibold">
              Case Document Tag / Role (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Impugned Order, Annexure-A, FIR Copy, Plaint"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full bg-white dark:bg-[#131E2E] border border-[#E5E4E2] dark:border-[#1E2D44] rounded-lg px-3 py-1.5 text-xs text-[#1A1A1A] dark:text-[#F8FAFC] placeholder:text-[#666666] dark:text-[#94A3B8] dark:text-[#475569] outline-none focus:border-[#1A1A1A]/50"
            />
          </div>
        )}

        {/* Document List */}
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {isLoading ? (
            <div className="py-8 flex flex-col items-center justify-center gap-2 text-[#666666] dark:text-[#94A3B8] dark:text-[#475569]">
              <Loader2 className="w-5 h-5 animate-spin text-[#1A1A1A] dark:text-[#F8FAFC]" />
              <span className="text-xs font-mono">Loading Knowledge Vault...</span>
            </div>
          ) : availableDocs.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#666666] dark:text-[#94A3B8] dark:text-[#475569] space-y-1">
              <p>No available documents to link.</p>
              <p className="text-[10px] text-[#666666] dark:text-[#94A3B8] dark:text-[#475569]">
                Upload a new document or search with a different query.
              </p>
            </div>
          ) : (
            availableDocs.map((doc) => {
              const isSelected = selectedDocId === doc.id;
              return (
                <div
                  key={doc.id}
                  onClick={() => setSelectedDocId(isSelected ? null : doc.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-3 ${
                    isSelected
                      ? "bg-[#1A1A1A]/8 border-[#1A1A1A]/50 text-[#1A1A1A] dark:text-[#F8FAFC] shadow-md"
                      : "bg-white dark:bg-[#131E2E] border-[#E5E4E2] dark:border-[#1E2D44] text-[#4A4A4A] dark:text-[#94A3B8] dark:text-[#475569] hover:bg-[#F5F4F2] dark:bg-[#0B131E]"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileText
                      className={`w-4 h-4 shrink-0 ${
                        isSelected ? "text-[#1A1A1A] dark:text-[#F8FAFC]" : "text-[#666666] dark:text-[#94A3B8] dark:text-[#475569]"
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate">{doc.title}</p>
                      <p className="text-[10px] text-[#666666] dark:text-[#94A3B8] dark:text-[#475569] font-mono">
                        {new Date(doc.createdAt).toLocaleDateString()} ·{" "}
                        {doc.sourceType || "vault file"}
                      </p>
                    </div>
                  </div>

                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center border shrink-0 ${
                      isSelected
                        ? "bg-[#1A1A1A] border-[#1A1A1A] text-white"
                        : "border-[#E5E4E2] dark:border-[#1E2D44]"
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E5E4E2] dark:border-[#1E2D44]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs text-[#666666] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#2D2D2D] dark:text-[#CBD5E1]"
          >
            Cancel
          </button>
          <button
            onClick={() =>
              selectedDocId &&
              linkMutation.mutate({
                docId: selectedDocId,
                docLabel: label.trim(),
              })
            }
            disabled={!selectedDocId || linkMutation.isPending}
            className="px-5 py-2 rounded-xl bg-[#1A1A1A] hover:bg-[#2D2D2D] text-white font-bold text-xs transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {linkMutation.isPending && (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            )}
            <span>Link Document</span>
          </button>
        </div>
      </div>
    </div>
  );
};
export default LinkDocumentModal;
