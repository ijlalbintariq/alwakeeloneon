import { useState } from "react";
import { Sparkles } from "lucide-react";
import { ChatModule } from "./chat";

const CONTRACT_TYPES = [
  "Employment Agreement",
  "Service Agreement",
  "NDA (Non-Disclosure)",
  "Partnership Deed",
  "Sale & Purchase Agreement",
  "Rental / Lease Deed",
  "Power of Attorney",
  "Affidavit",
  "Gift Deed",
  "Trust Deed",
  "Arbitration Agreement",
  "Consultancy Agreement",
  "Distribution Agreement",
  "Franchise Agreement",
  "Loan Agreement",
  "Mortgage Deed",
];

export default function ContractDraftingPage() {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [chatKey, setChatKey] = useState(0);

  const handleTemplateSelect = (template: string) => {
    setSelectedTemplate(template);
    setChatKey((k) => k + 1);
  };

  return (
    <div className="space-y-8 fade-in" data-testid="contract-drafting-page">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl md:text-5xl font-bold text-white italic tracking-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
            Contract Drafting
          </h2>
          <p className="text-slate-500 mt-2 font-medium">Precision-engineered legal agreements for the Pakistani jurisdiction.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-[#1e293b] border border-slate-800 rounded-[2rem] p-6 shadow-xl">
            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-500 mb-4">Agreement Vault</h4>
            <div className="space-y-2 overflow-y-auto max-h-[50vh] scrollbar-hide pr-1">
              {CONTRACT_TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => handleTemplateSelect(type)}
                  data-testid={`contract-type-${type.toLowerCase().replace(/\s+/g, '-')}`}
                  className={`w-full text-left p-3 rounded-xl text-[10px] font-bold transition-all border ${
                    selectedTemplate === type
                      ? "bg-amber-500 text-slate-950 border-amber-500 shadow-lg"
                      : "bg-[#0f172a] text-slate-400 border-slate-800 hover:border-slate-600"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2 text-amber-500">
              <Sparkles size={16} />
              <span className="text-[9px] font-black uppercase tracking-widest">Airtight Move</span>
            </div>
            <p className="text-[9px] text-slate-500 leading-relaxed italic">
              Strategic contracts don't just protect -- they win disputes before they start.
            </p>
          </div>
        </div>

        <div className="lg:col-span-3">
          <ChatModule
            key={chatKey}
            type="contract-drafting"
            title="Contract Drafting"
            initialMessage={
              selectedTemplate
                ? `I need to draft an airtight ${selectedTemplate}. Please guide me through the required clauses and Pakistani legal specifics.`
                : undefined
            }
          />
        </div>
      </div>
    </div>
  );
}
