import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";

interface HistoryItem {
  id: number;
  type: string;
  query: string;
  createdAt: string;
}

export default function HistoryPage() {
  const { data: history } = useQuery<HistoryItem[]>({ queryKey: ["/api/search-history"] });

  return (
    <div className="space-y-10 fade-in" data-testid="history-page">
      <div>
        <h2 className="text-4xl md:text-5xl font-bold text-white italic tracking-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
          Search History
        </h2>
        <p className="text-slate-500 mt-2 font-medium">Your complete activity log across the Chambers Protocols.</p>
      </div>

      {history && history.length > 0 ? (
        <div className="bg-[#1e293b] rounded-[3rem] overflow-hidden shadow-2xl border border-slate-800">
          <table className="w-full text-left">
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
      ) : (
        <div className="py-20 text-center bg-[#1e293b]/30 border border-dashed border-slate-800 rounded-[3rem]">
          <History size={48} className="mx-auto text-slate-800 mb-6" />
          <p className="text-slate-600 italic font-medium">No search history recorded yet.</p>
        </div>
      )}
    </div>
  );
}
