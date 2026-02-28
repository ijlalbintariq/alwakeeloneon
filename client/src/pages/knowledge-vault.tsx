import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Upload, Trash2, Eye, FileText, AlertCircle, Download, X, Loader2 } from "lucide-react";

interface Doc {
  id: number;
  title: string;
  content?: string;
  summary?: string;
  createdAt: string;
}

export default function KnowledgeVaultPage() {
  const { data: documents, isLoading } = useQuery<Doc[]>({ queryKey: ["/api/documents"] });
  const [previewDoc, setPreviewDoc] = useState<Doc | null>(null);
  const [statusMsg, setStatusMsg] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/documents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      setStatusMsg("Document removed from vault.");
      setTimeout(() => setStatusMsg(""), 3000);
    },
  });

  const handleDownload = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.endsWith(".txt") ? filename : `${filename}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  async function handleUpload() {
    if (selectedFiles.length === 0) {
      setStatusMsg("Please select files to upload.");
      setTimeout(() => setStatusMsg(""), 3000);
      return;
    }

    setIsUploading(true);
    try {
      for (const file of selectedFiles) {
        const text = await file.text();
        await apiRequest("POST", "/api/documents", {
          title: file.name.replace(/\.[^/.]+$/, ""),
          content: text,
        });
      }

      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      setSelectedFiles([]);
      setIsAdding(false);
      const fileInput = document.querySelector('[data-testid="input-vault-files"]') as HTMLInputElement;
      if (fileInput) fileInput.value = "";
      setStatusMsg(`${selectedFiles.length} document${selectedFiles.length !== 1 ? "s" : ""} added to vault.`);
      setTimeout(() => setStatusMsg(""), 3000);
    } catch {
      setStatusMsg("Upload failed. Please try again.");
      setTimeout(() => setStatusMsg(""), 3000);
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="space-y-10 fade-in" data-testid="knowledge-vault-page">
      {previewDoc && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-6 bg-[#0f172a]/90 backdrop-blur-sm fade-in">
          <div className="bg-[#1e293b] border border-slate-700 w-full max-w-5xl h-[90vh] rounded-[3rem] shadow-2xl flex flex-col overflow-hidden">
            <div className="p-6 border-b border-slate-800 bg-[#0f172a]/50 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl"><FileText size={24} /></div>
                <div>
                  <h3 className="text-xl font-bold text-white line-clamp-1" style={{ fontFamily: "'Playfair Display', serif" }}>{previewDoc.title}</h3>
                  <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Vault Document</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleDownload(previewDoc.content || "", previewDoc.title)} className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-all" data-testid="button-download-doc"><Download size={20} /></button>
                <button onClick={() => setPreviewDoc(null)} className="p-2 hover:bg-red-500/10 rounded-xl text-slate-400 hover:text-red-500 transition-all" data-testid="button-close-preview"><X size={24} /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-8 md:p-12 bg-white/5 scrollbar-hide">
              <div className="max-w-3xl mx-auto bg-white/[0.02] p-8 md:p-12 rounded-2xl border border-white/5">
                <div className="legal-draft-font whitespace-pre-wrap">{previewDoc.content || "Document indexed..."}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl md:text-5xl font-bold text-white italic tracking-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
            Knowledge Vault
          </h2>
          <p className="text-slate-500 mt-2 font-medium">Manage the Intelligence Registry of Your Own Al Wakeelo Counsel Engine.</p>
        </div>
        <button
          onClick={() => setIsAdding(!isAdding)}
          data-testid="button-add-document"
          className="px-6 py-3 bg-amber-500 text-slate-950 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-amber-400 transition-all shadow-xl flex items-center gap-2"
        >
          <Upload size={14} /> {isAdding ? "Cancel" : "Upload Files"}
        </button>
      </div>

      {isAdding && (
        <div className="bg-[#1e293b] border border-slate-800 rounded-[2.5rem] p-8 shadow-xl space-y-4 fade-in">
          <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-500">Upload Files to Vault</h4>
          <p className="text-xs text-slate-400">Select one or more .txt, .json, .csv, .pdf, or .docx files. Each file will be added as a separate vault entry.</p>
          <input
            type="file"
            accept=".txt,.json,.csv,.pdf,.doc,.docx"
            multiple
            onChange={(e) => setSelectedFiles(Array.from(e.target.files || []))}
            className="w-full bg-[#0f172a] border border-slate-700 rounded-xl px-6 py-4 text-sm text-white focus:ring-2 focus:ring-amber-500/50 transition-all outline-none file:text-slate-400 file:mr-4 file:bg-transparent file:border-0"
            data-testid="input-vault-files"
          />
          {selectedFiles.length > 0 && (
            <p className="text-[10px] text-amber-400 font-bold">
              {selectedFiles.length} file{selectedFiles.length !== 1 ? "s" : ""} selected: {selectedFiles.map(f => f.name).join(", ")}
            </p>
          )}
          <button
            onClick={handleUpload}
            disabled={selectedFiles.length === 0 || isUploading}
            data-testid="button-upload-files"
            className="px-6 py-3 bg-amber-500 text-slate-950 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-amber-400 transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {isUploading ? "Uploading..." : `Upload ${selectedFiles.length || ""} File${selectedFiles.length !== 1 ? "s" : ""}`}
          </button>
        </div>
      )}

      {statusMsg && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center gap-3 text-xs font-bold text-amber-500 uppercase tracking-widest">
          <AlertCircle size={16} /> {statusMsg}
        </div>
      )}

      <div className="bg-[#1e293b] border border-slate-800 rounded-[3rem] overflow-hidden shadow-2xl">
        <table className="w-full text-left">
          <thead className="bg-slate-900/50 border-b border-slate-800">
            <tr>
              <th className="p-6 md:p-8 text-[10px] font-black uppercase tracking-widest text-slate-500">Document</th>
              <th className="p-6 md:p-8 text-[10px] font-black uppercase tracking-widest text-slate-500 hidden md:table-cell">Status</th>
              <th className="p-6 md:p-8 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Vault Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {documents?.map((doc) => (
              <tr key={doc.id} className="hover:bg-white/[0.02] transition-colors group" data-testid={`vault-doc-${doc.id}`}>
                <td className="p-6 md:p-8">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-slate-800 rounded-xl text-amber-500"><FileText size={16} /></div>
                    <div>
                      <p className="text-sm font-bold text-white">{doc.title}</p>
                      <p className="text-[8px] uppercase tracking-widest text-slate-600">Indexed Registry Entry</p>
                    </div>
                  </div>
                </td>
                <td className="p-6 md:p-8 text-[10px] font-black uppercase tracking-widest text-emerald-500 hidden md:table-cell">Live in Vault</td>
                <td className="p-6 md:p-8">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => setPreviewDoc(doc)} className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-all" data-testid={`button-preview-doc-${doc.id}`}><Eye size={16} /></button>
                    <button onClick={() => deleteMutation.mutate(doc.id)} className="p-2 hover:bg-red-500/10 rounded-xl text-slate-500 hover:text-red-500 transition-all" data-testid={`button-delete-doc-${doc.id}`}><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {(!documents || documents.length === 0) && !isLoading && (
              <tr>
                <td colSpan={3} className="p-12 text-center text-slate-600 italic">No documents in the vault.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
