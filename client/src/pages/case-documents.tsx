import { useQuery } from "@tanstack/react-query";
import { FileText, Eye, Download, FileSearch, X } from "lucide-react";
import { useState } from "react";

interface Doc {
  id: number;
  title: string;
  content?: string;
  createdAt: string;
}

export default function CaseDocumentsPage() {
  const { data: documents, isLoading } = useQuery<Doc[]>({ queryKey: ["/api/documents"] });
  const [previewDoc, setPreviewDoc] = useState<Doc | null>(null);

  const handleDownload = (doc: Doc) => {
    const blob = new Blob([doc.content || ""], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${doc.title}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-10 fade-in" data-testid="case-documents-page">
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
                <button onClick={() => handleDownload(previewDoc)} className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-all"><Download size={20} /></button>
                <button onClick={() => setPreviewDoc(null)} className="p-2 hover:bg-red-500/10 rounded-xl text-slate-400 hover:text-red-500 transition-all"><X size={24} /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-8 md:p-12 bg-white/5 scrollbar-hide">
              <div className="max-w-3xl mx-auto bg-white/[0.02] p-8 md:p-12 rounded-2xl border border-white/5">
                <div className="legal-draft-font whitespace-pre-wrap">{previewDoc.content || "Document indexed..."}</div>
              </div>
            </div>
            <div className="p-4 border-t border-slate-800 bg-[#0f172a]/50 text-center">
              <p className="text-[8px] font-black uppercase tracking-[0.3em] text-slate-600">Al Wakeelo Digital Chambers Vault</p>
            </div>
          </div>
        </div>
      )}

      <div>
        <h2 className="text-4xl md:text-5xl font-bold text-white italic tracking-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
          Case Documents
        </h2>
        <p className="text-slate-500 mt-2 font-medium">Browse verified legal materials and indexed evidence from the Chambers Registry.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {documents?.map((doc) => (
          <div key={doc.id} className="p-8 bg-[#1e293b] border border-slate-800 rounded-[2.5rem] shadow-xl hover:border-amber-500/40 transition-all group relative overflow-hidden" data-testid={`document-${doc.id}`}>
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl"><FileText size={20} /></div>
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-white line-clamp-1">{doc.title}</h4>
                <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Vault Document</p>
              </div>
            </div>
            <p className="text-xs text-slate-500 line-clamp-3 mb-6 italic">
              Registry entry indexed on {new Date(doc.createdAt).toLocaleDateString()}.
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPreviewDoc(doc)} className="flex-1 px-4 py-3 bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-700 transition-all flex items-center justify-center gap-2" data-testid={`button-view-doc-${doc.id}`}>
                <Eye size={14} /> View
              </button>
              <button onClick={() => handleDownload(doc)} className="p-3 bg-slate-800 text-slate-400 rounded-xl hover:text-white transition-all"><Download size={14} /></button>
            </div>
          </div>
        ))}
        {(!documents || documents.length === 0) && !isLoading && (
          <div className="col-span-full py-20 text-center bg-[#1e293b]/50 border border-dashed border-slate-800 rounded-[3rem]">
            <FileSearch size={48} className="mx-auto text-slate-700 mb-6" />
            <p className="text-slate-500 italic font-medium">No documents currently indexed in the Chambers Registry.</p>
          </div>
        )}
      </div>
    </div>
  );
}
