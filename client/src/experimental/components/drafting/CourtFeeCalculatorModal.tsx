import React, { useState, useMemo } from "react";
import {
  Calculator,
  Scale,
  X,
  PlusCircle,
  Info,
  CheckCircle2,
  Receipt,
  Building2,
  DollarSign,
} from "lucide-react";
import {
  calculateCourtFee,
  SUIT_TYPES,
  type SuitType,
  type CourtFeeResult,
} from "@/lib/court-fee";

interface CourtFeeCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertValuationClause?: (clauseText: string) => void;
}

export const CourtFeeCalculatorModal: React.FC<CourtFeeCalculatorModalProps> = ({
  isOpen,
  onClose,
  onInsertValuationClause,
}) => {
  const [suitType, setSuitType] = useState<SuitType>("money");
  const [suitValue, setSuitValue] = useState<number>(2500000);

  const meta = SUIT_TYPES[suitType];

  const calculation = useMemo<CourtFeeResult>(() => {
    return calculateCourtFee(suitType, meta.needsValue ? suitValue : 0);
  }, [suitType, suitValue, meta.needsValue]);

  if (!isOpen) return null;

  const handleInsert = () => {
    if (onInsertValuationClause) {
      onInsertValuationClause(calculation.draftText);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] rounded-2xl max-w-xl w-full flex flex-col shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-[#E2E8F0] dark:border-[#1E2D44] flex items-start justify-between gap-3 bg-[#F8FAFC] dark:bg-[#0B131E]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-[#105B38] border border-emerald-200 dark:border-emerald-500/20">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                Pakistani Court Fee & Valuation Calculator
              </h2>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] mt-0.5">
                Court Fees Act, 1870 & Suits Valuation Act, 1887 computation
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F1F5F9] dark:bg-[#1E2D44] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Suit Type Selector */}
          <div>
            <label className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC] block mb-1.5">
              Category of Suit / Plaint
            </label>
            <select
              value={suitType}
              onChange={(e) => setSuitType(e.target.value as SuitType)}
              className="w-full h-10 px-3 rounded-xl bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] text-[#0F172A] dark:text-[#F8FAFC] text-xs font-medium focus:outline-none focus:border-[#105B38] transition-colors cursor-pointer"
            >
              {(Object.keys(SUIT_TYPES) as SuitType[]).map((key) => (
                <option key={key} value={key}>
                  {SUIT_TYPES[key].label}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] mt-1">{meta.description}</p>
          </div>

          {/* Ad Valorem Value Input (Conditional) */}
          {meta.needsValue && (
            <div>
              <label className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC] block mb-1.5">
                Subject Matter Valuation (PKR)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">
                  PKR
                </span>
                <input
                  type="number"
                  min={0}
                  step={10000}
                  value={suitValue}
                  onChange={(e) => setSuitValue(Number(e.target.value))}
                  className="w-full h-10 pl-12 pr-3 rounded-xl bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] text-[#0F172A] dark:text-[#F8FAFC] font-mono text-sm focus:outline-none focus:border-[#105B38]"
                />
              </div>
            </div>
          )}

          {/* Calculation Result Summary Card */}
          <div className="p-4 rounded-xl bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] font-semibold">Total Payable Court Fee:</span>
              <span className="text-base font-bold font-mono text-[#105B38]">
                PKR {calculation.feeRs.toLocaleString()}/-
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-2 border-t border-[#E2E8F0] dark:border-[#1E2D44]">
              <div>
                <span className="text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] block text-[11px]">Calculation Rule:</span>
                <span className="font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                  {calculation.formula}
                </span>
              </div>

              <div>
                <span className="text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] block text-[11px]">Statutory Basis:</span>
                <span className="font-mono font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                  {calculation.legalCitation}
                </span>
              </div>
            </div>

            {/* Generated Draft Paragraph Preview */}
            <div className="pt-2 border-t border-[#E2E8F0] dark:border-[#1E2D44]">
              <span className="text-[11px] font-bold text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] block mb-1">Valuation Paragraph for Plaint:</span>
              <div className="p-3 rounded-xl bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] font-serif text-xs text-[#334155] dark:text-[#CBD5E1] whitespace-pre-wrap leading-relaxed">
                {calculation.draftText}
              </div>
            </div>
          </div>

          {/* Notice */}
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-start gap-2.5 text-xs text-emerald-900 dark:text-emerald-300">
            <Info className="w-4 h-4 text-[#105B38] shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-[#105B38]">Section 7 & Schedule I Compliance: </span>
              In suits for money or property value exceeding PKR 25,000, 7.5% ad valorem applies subject to provincial maximum ceilings (e.g. PKR 15,000 in Punjab).
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#E2E8F0] dark:border-[#1E2D44] bg-[#F8FAFC] dark:bg-[#0B131E] flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:bg-[#F1F5F9] dark:bg-[#1E2D44] border border-[#E2E8F0] dark:border-[#1E2D44] transition-colors"
          >
            Close
          </button>

          {onInsertValuationClause && (
            <button
              type="button"
              onClick={handleInsert}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#105B38] hover:bg-[#0D4A2E] text-white text-xs font-bold shadow-xs transition-all active:scale-95"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Insert Clause into Plaint</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

