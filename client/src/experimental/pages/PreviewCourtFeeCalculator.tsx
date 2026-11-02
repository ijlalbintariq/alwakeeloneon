import React, { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useDocumentHead } from "@/hooks/use-document-head";
import { PublicPreviewShell } from "@/experimental/components/public/PublicPreviewShell";
import { 
  Calculator, Scale, Copy, Check, Info, FileText, ArrowRight, 
  Sparkles, ShieldAlert, BookOpen 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  calculateCourtFee, 
  SUIT_TYPES, 
  type SuitType, 
  type CourtFeeResult 
} from "@/lib/court-fee";

export default function PreviewCourtFeeCalculator() {
  useDocumentHead({
    title: "Court Fee & Suits Valuation Calculator | Al Wakeelo — Pakistan's AI Legal Assistant",
    description: "Free Pakistani court fee calculator under Court Fees Act 1870 and Suits Valuation Act 1887. Automatically calculate ad valorem 7.5% fees, High Court writ fees, family court fees, and generate ready-to-paste valuation paragraphs for court pleadings.",
    path: "/court-fee-calculator",
  });

  const [, setLocation] = useLocation();
  const [suitType, setSuitType] = useState<SuitType>("money");
  const [suitValue, setSuitValue] = useState<number>(500000);
  const [copied, setCopied] = useState(false);

  const meta = SUIT_TYPES[suitType];

  const calculation = useMemo<CourtFeeResult>(() => {
    return calculateCourtFee(suitType, meta.needsValue ? suitValue : 0);
  }, [suitType, suitValue, meta.needsValue]);

  const handleCopy = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(calculation.draftText).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  return (
    <PublicPreviewShell>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="text-center space-y-3 mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#105B38]/10 border border-[#105B38]/20 rounded-full text-xs text-[#105B38] font-bold uppercase tracking-wider">
            <Calculator className="w-3.5 h-3.5" />
            <span>Pakistani Procedural Law Utility</span>
          </div>
          <h1
            className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Court Fee &amp; Suits Valuation Calculator
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Compute payable court fees under the Court Fees Act, 1870 and Suits Valuation Act, 1887. 
            Generate court-ready valuation paragraphs for plaints, petitions, and appeals across Pakistani courts.
          </p>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Controls Column */}
          <div className="lg:col-span-7 space-y-6">
            <Card className="border border-slate-200 dark:border-slate-800 shadow-sm">
              <CardHeader className="pb-4 border-b border-slate-100 dark:border-slate-800">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Scale className="w-5 h-5 text-[#105B38]" />
                  <span>Suit &amp; Valuation Parameters</span>
                </CardTitle>
                <CardDescription>
                  Select the category of your plaint or proceeding to apply statutory schedules
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-5">
                <div>
                  <label htmlFor="suit-category" className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                    Category of Suit / Plaint / Proceeding
                  </label>
                  <select
                    id="suit-category"
                    value={suitType}
                    onChange={(e) => setSuitType(e.target.value as SuitType)}
                    className="w-full h-11 px-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-sm font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#105B38] cursor-pointer"
                  >
                    {(Object.keys(SUIT_TYPES) as SuitType[]).map((key) => (
                      <option key={key} value={key}>
                        {SUIT_TYPES[key].label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                    {meta.description}
                  </p>
                </div>

                {meta.needsValue && (
                  <div>
                    <label htmlFor="suit-valuation" className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                      Subject Matter Valuation (PKR)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs font-bold text-slate-500">
                        PKR
                      </span>
                      <input
                        id="suit-valuation"
                        type="number"
                        min={0}
                        step={10000}
                        value={suitValue}
                        onChange={(e) => setSuitValue(Math.max(0, Number(e.target.value)))}
                        className="w-full h-11 pl-12 pr-4 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-sm font-mono font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#105B38]"
                        placeholder="500000"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {[100000, 500000, 1000000, 2500000, 5000000].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setSuitValue(preset)}
                          className="px-2.5 py-1 text-xs rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        >
                          Rs. {(preset / 100000).toLocaleString()} Lakh
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Calculation Summary Box */}
                <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/60 dark:bg-emerald-950/20 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-900 dark:text-emerald-300">
                      Payable Court Fee:
                    </span>
                    <span className="text-2xl font-extrabold font-mono text-[#105B38] dark:text-emerald-400">
                      PKR {calculation.feeRs.toLocaleString()}/-
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-emerald-200 dark:border-emerald-800/30 text-xs">
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block text-[11px] font-semibold">Rule Applied:</span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {calculation.formula}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block text-[11px] font-semibold">Statutory Authority:</span>
                      <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                        {calculation.legalCitation}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Statutory Information Box */}
                <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 flex items-start gap-3">
                  <Info className="w-4 h-4 text-[#105B38] shrink-0 mt-0.5" />
                  <div className="leading-relaxed">
                    <strong className="text-slate-900 dark:text-slate-200">Ad Valorem Fee Structure: </strong>
                    Under Section 7 and Schedule I of the Court Fees Act 1870, claims exceeding Rs. 25,000 carry a 7.5% ad valorem court fee. 
                    Provincial amendments impose statutory maximum caps (e.g. Punjab ceiling Rs. 15,000 for standard plaints, subject to current provincial schedules).
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Plaint Valuation Output Column */}
          <div className="lg:col-span-5 space-y-6">
            <Card className="border border-slate-200 dark:border-slate-800 shadow-sm">
              <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#105B38]" />
                    <span>Plaint Valuation Paragraph</span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Ready to paste into court pleadings
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopy}
                  className="gap-1.5 h-8 text-xs border-slate-300 dark:border-slate-700"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Text</span>
                    </>
                  )}
                </Button>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-serif text-xs text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap select-all">
                  {calculation.draftText}
                </div>

                <div className="mt-5 space-y-3">
                  <Button
                    onClick={() => setLocation("/preview/drafting")}
                    className="w-full bg-[#105B38] hover:bg-[#0D4B2E] text-white text-xs font-bold gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Open in AI Legal Drafting Studio</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-auto" />
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => setLocation("/preview/statutes")}
                    className="w-full text-xs border-slate-300 dark:border-slate-700 gap-2"
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>View Court Fees Act, 1870 Sections</span>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Quick Reference Notes */}
            <Card className="border border-slate-200 dark:border-slate-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Provincial Jurisdiction Notes
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-2.5 text-slate-600 dark:text-slate-400">
                <div className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#105B38] mt-1.5 shrink-0" />
                  <p><strong>Punjab:</strong> Court Fees Act 1870 applies with Punjab Finance Acts amendments.</p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#105B38] mt-1.5 shrink-0" />
                  <p><strong>Sindh:</strong> Court Fees (Sindh Amendment) Act schedules applied by High Court of Sindh.</p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#105B38] mt-1.5 shrink-0" />
                  <p><strong>High Court Writs:</strong> Fixed Rs. 500 court fee on Article 199 petitions.</p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#105B38] mt-1.5 shrink-0" />
                  <p><strong>Family Courts:</strong> Fixed Rs. 15 fee under Family Courts Act 1964; exempted from ad valorem.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PublicPreviewShell>
  );
}
