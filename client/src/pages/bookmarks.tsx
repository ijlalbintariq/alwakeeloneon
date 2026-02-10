import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Bookmark, Trash2, ChevronRight, Download, X } from "lucide-react";
import { useState } from "react";

interface BookmarkItem {
  id: number;
  title: string;
  content: string;
  type: string;
  category: string;
  createdAt: string;
}

export default function BookmarksPage() {
  const { data: bookmarks } = useQuery<BookmarkItem[]>({ queryKey: ["/api/bookmarks"] });
  const [previewBookmark, setPreviewBookmark] = useState<BookmarkItem | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/bookmarks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookmarks"] });
    },
  });

  const handleExport = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-10 fade-in" data-testid="bookmarks-page">
      {previewBookmark && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-6 bg-[#0f172a]/95 backdrop-blur-md fade-in">
          <div className="bg-[#1e293b] border border-slate-700 w-full max-w-3xl h-[70vh] rounded-[3rem] shadow-2xl flex flex-col overflow-hidden">
            <div className="p-6 border-b border-slate-800 bg-[#0f172a]/50 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-white italic" style={{ fontFamily: "'Playfair Display', serif" }}>Saved Strategy Preview</h3>
                <p className="text-[9px] font-black uppercase text-amber-500 tracking-widest mt-1">{previewBookmark.category} - {previewBookmark.type}</p>
              </div>
              <button onClick={() => setPreviewBookmark(null)} className="p-3 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-all"><X size={24} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 md:p-12 bg-white/5 scrollbar-hide">
              <div className="legal-draft-font whitespace-pre-wrap leading-relaxed">{previewBookmark.content}</div>
            </div>
            <div className="p-6 border-t border-slate-800 bg-[#0f172a]/50 flex justify-end gap-3">
              <button
                onClick={() => handleExport(previewBookmark.content, `bookmark-${previewBookmark.id}.txt`)}
                className="px-5 py-3 bg-amber-500 text-slate-950 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-400 transition-all flex items-center gap-2"
              >
                <Download size={14} /> Export Text
              </button>
            </div>
          </div>
        </div>
      )}

      <div>
        <h2 className="text-4xl md:text-5xl font-bold text-white italic tracking-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
          Bookmarks
        </h2>
        <p className="text-slate-500 mt-2 font-medium">Your personal strategic vault of saved legal advice and research.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {bookmarks?.map((b) => (
          <div key={b.id} className="p-8 bg-[#1e293b] border border-slate-800 rounded-[3rem] shadow-xl relative group hover:border-amber-500/30 transition-all flex flex-col h-full" data-testid={`bookmark-${b.id}`}>
            <div className="flex justify-between items-start mb-4">
              <p className="text-[9px] font-black uppercase text-amber-500 tracking-[0.2em]">{b.category} - {b.type}</p>
              <button onClick={() => deleteMutation.mutate(b.id)} className="text-slate-700 hover:text-red-500 transition-colors p-1" data-testid={`button-delete-bookmark-${b.id}`}>
                <Trash2 size={14} />
              </button>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed line-clamp-4 italic mb-6">"{b.content.substring(0, 150)}..."</p>
            <div className="mt-auto pt-4 border-t border-slate-800 flex justify-between items-center">
              <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">{new Date(b.createdAt).toLocaleDateString()}</span>
              <button onClick={() => setPreviewBookmark(b)} className="text-amber-500 hover:text-amber-400 text-[9px] font-black uppercase tracking-[0.2em] flex items-center gap-1" data-testid={`button-view-bookmark-${b.id}`}>
                View Strategy <ChevronRight size={12} />
              </button>
            </div>
          </div>
        ))}
        {(!bookmarks || bookmarks.length === 0) && (
          <div className="col-span-full py-20 text-center bg-[#1e293b]/30 border border-dashed border-slate-800 rounded-[3rem]">
            <Bookmark size={48} className="mx-auto text-slate-800 mb-6" />
            <p className="text-slate-600 italic font-medium">Your strategic vault is currently empty. Bookmark advice from Al Wakeelo to save it here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
