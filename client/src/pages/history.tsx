import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { History, MessageSquare, X, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { LegalMarkdown } from "@/components/legal-markdown";
import { parseReferences, ReferenceCards } from "@/components/reference-cards";

interface HistoryItem {
  id: number;
  type: string;
  query: string;
  createdAt: string;
}

interface ThreadItem {
  id: number;
  title: string;
  createdAt: string;
  shareToken?: string | null;
}

interface ThreadMessage {
  id: number;
  role: string;
  content: string;
  createdAt: string;
}

export default function HistoryPage() {
  const { data: history } = useQuery<HistoryItem[]>({ queryKey: ["/api/search-history"] });
  const { data: threads } = useQuery<ThreadItem[]>({ queryKey: ["/api/threads"] });
  const [selectedThread, setSelectedThread] = useState<ThreadItem | null>(null);
  const [threadMessages, setThreadMessages] = useState<ThreadMessage[] | null>(null);
  const [loadingThread, setLoadingThread] = useState(false);
  const [showThreadsPopup, setShowThreadsPopup] = useState(false);

  const openThread = async (thread: ThreadItem) => {
    setSelectedThread(thread);
    setLoadingThread(true);
    try {
      const res = await apiRequest("GET", `/api/threads/${thread.id}`);
      const data = await res.json();
      setThreadMessages(data.messages || []);
    } catch {
      setThreadMessages([]);
    } finally {
      setLoadingThread(false);
    }
  };

  return (
    <div className="space-y-7 md:space-y-10 fade-in" data-testid="history-page">
      <div>
        <h2 className="text-4xl md:text-5xl font-bold text-white italic tracking-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
          Search History
        </h2>
        <p className="text-slate-500 mt-2 font-medium">Your complete activity log across the Chambers Protocols.</p>
      </div>

      {threads && threads.length > 0 && (
        <div className="bg-[#1e293b] rounded-2xl p-5 border border-slate-800 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <MessageSquare size={18} className="text-amber-500" />
              <h3 className="text-sm font-bold text-white uppercase tracking-widest">Chat Threads</h3>
              <span className="text-[10px] bg-amber-500/10 text-amber-500 font-bold px-2 py-0.5 rounded-full">
                {threads.length}
              </span>
            </div>
            <button
              onClick={() => setShowThreadsPopup(true)}
              className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-amber-500 hover:bg-amber-500/10 transition-all"
            >
              View All
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {threads.slice(0, 5).map((t) => (
              <button
                key={t.id}
                onClick={() => openThread(t)}
                className="flex-shrink-0 bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 text-left max-w-[280px] min-w-[220px] hover:bg-slate-700/50 hover:border-amber-500/30 transition-all"
              >
                <p className="text-xs font-bold text-white truncate">{t.title}</p>
                <p className="text-[10px] text-slate-500 mt-1">{new Date(t.createdAt).toLocaleString()}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {history && history.length > 0 ? (
        <div className="bg-[#1e293b] rounded-[1.25rem] md:rounded-[3rem] overflow-hidden shadow-2xl border border-slate-800">
          <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[560px]">
            <thead className="bg-slate-900/50 text-[10px] font-black uppercase text-slate-500 border-b border-slate-800">
              <tr>
                <th className="p-6 md:p-8">Parameter Entry</th>
                <th className="p-6 md:p-8 hidden md:table-cell">Type</th>
                <th className="p-6 md:p-8">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {history.map((h) => (
                <tr key={h.id} className="hover:bg-white/[0.02] transition-colors" data-testid={`history-${h.id}`}>
                  <td className="p-6 md:p-8 text-sm font-bold text-white">
                    {h.query}
                    <span className="text-[9px] text-slate-600 font-black uppercase ml-3 tracking-widest md:hidden">({h.type})</span>
                  </td>
                  <td className="p-6 md:p-8 text-[10px] text-amber-500 font-black uppercase tracking-widest hidden md:table-cell">{h.type}</td>
                  <td className="p-6 md:p-8 text-xs text-slate-500">{new Date(h.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      ) : (
        <div className="py-16 md:py-20 text-center bg-[#1e293b]/30 border border-dashed border-slate-800 rounded-[1.5rem] md:rounded-[3rem]">
          <History size={48} className="mx-auto text-slate-800 mb-6" />
          <p className="text-slate-600 italic font-medium">No search history recorded yet.</p>
        </div>
      )}

      {showThreadsPopup && threads && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowThreadsPopup(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative bg-[#1e293b] border border-slate-700 rounded-xl sm:rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-[#1e293b] border-b border-slate-700 p-4 flex items-center justify-between rounded-t-2xl z-10">
              <div className="flex items-center gap-2">
                <MessageSquare size={16} className="text-amber-500" />
                <h3 className="text-sm font-bold text-white">All Chat Threads</h3>
              </div>
              <button onClick={() => setShowThreadsPopup(false)} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="overflow-y-auto p-4 space-y-2">
              {threads.map((t) => (
                <button
                  key={t.id}
                  onClick={() => { setShowThreadsPopup(false); openThread(t); }}
                  className="w-full bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 text-left hover:bg-slate-700/50 hover:border-amber-500/30 transition-all"
                >
                  <p className="text-sm font-bold text-white truncate">{t.title}</p>
                  <p className="text-[10px] text-slate-500 mt-1">{new Date(t.createdAt).toLocaleString()}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {selectedThread && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => { setSelectedThread(null); setThreadMessages(null); }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative bg-[#1e293b] border border-slate-700 rounded-xl sm:rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-[#1e293b] border-b border-slate-700 p-4 flex items-center justify-between rounded-t-2xl z-10">
              <div>
                <h3 className="text-sm font-bold text-white">{selectedThread.title}</h3>
                <p className="text-[10px] text-slate-500 mt-0.5">{new Date(selectedThread.createdAt).toLocaleString()}</p>
              </div>
              <button onClick={() => { setSelectedThread(null); setThreadMessages(null); }} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="overflow-y-auto p-5 space-y-4">
              {loadingThread ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 size={24} className="text-amber-500 animate-spin" />
                </div>
              ) : threadMessages && threadMessages.length > 0 ? (
                threadMessages.map((m, i) => {
                  const parsed = m.role === "assistant" ? parseReferences(m.content) : null;
                  const displayContent = parsed ? parsed.cleanContent : m.content;
                  return (
                    <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[85%] p-4 rounded-2xl ${
                          m.role === "user"
                            ? "bg-amber-500 text-slate-950 font-bold rounded-tr-sm"
                            : "bg-[#0f172a] border border-slate-700 text-slate-200 rounded-tl-sm"
                        }`}
                      >
                        {m.role === "assistant" ? (
                          <>
                            <LegalMarkdown content={displayContent} />
                            {parsed?.references && <ReferenceCards references={parsed.references} />}
                          </>
                        ) : (
                          <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-center text-slate-500 py-10">No messages found in this thread.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
