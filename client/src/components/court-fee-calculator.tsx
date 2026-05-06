import { useState, useMemo } from "react";
import { X, Calculator, Copy, ArrowRight } from "lucide-react";
import {
  calculateCourtFee,
  SUIT_TYPES,
  type SuitType,
  type CourtFeeResult,
} from "@/lib/court-fee";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called when user clicks "Insert into draft" — receives the ready-to-paste paragraph */
  onInsert?: (draftText: string) => void;
}

export function CourtFeeCalculator({ open, onClose, onInsert }: Props) {
  const [suitType, setSuitType] = useState<SuitType>("money");
  const [valueStr, setValueStr] = useState<string>("500000");
  const [copied, setCopied] = useState(false);

  const meta = SUIT_TYPES[suitType];
  const valueNum = useMemo(() => {
    const cleaned = valueStr.replace(/[^0-9]/g, "");
    return Number(cleaned) || 0;
  }, [valueStr]);

  const result: CourtFeeResult = useMemo(
    () => calculateCourtFee(suitType, meta.needsValue ? valueNum : 0),
    [suitType, valueNum, meta.needsValue],
  );

  if (!open) return null;

  const formatRs = (n: number) => `Rs. ${n.toLocaleString("en-PK")}`;
  const handleCopy = () => {
    navigator.clipboard.writeText(result.draftText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
      onClick={onClose}
      data-testid="modal-court-fee"
    >
      <div
        className="w-full max-w-xl rounded-2xl border border-primary/30 bg-card shadow-[0_24px_60px_-30px_rgba(0,0,0,0.7)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Calculator size={16} className="text-primary" />
            <h2 className="text-sm font-bold text-foreground">Court Fee Calculator</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground"
            aria-label="Close"
            data-testid="button-court-fee-close"
          >
            <X size={14} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              Suit / Petition Type
            </label>
            <select
              value={suitType}
              onChange={(e) => setSuitType(e.target.value as SuitType)}
              className="mt-1 w-full rounded-lg border border-border bg-card text-foreground text-xs px-3 py-2 focus:outline-none focus:border-primary/50"
              data-testid="select-suit-type"
            >
              {Object.entries(SUIT_TYPES).map(([key, m]) => (
                <option key={key} value={key}>{m.label}</option>
              ))}
            </select>
            <p className="text-[10.5px] text-muted-foreground mt-1.5 leading-snug">
              {meta.description}
            </p>
          </div>

          {meta.needsValue && (
            <div>
              <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Suit Value (PKR)
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={valueStr}
                onChange={(e) => setValueStr(e.target.value)}
                placeholder="e.g. 500000"
                className="mt-1 w-full rounded-lg border border-border bg-card text-foreground text-sm px-3 py-2 font-mono focus:outline-none focus:border-primary/50"
                data-testid="input-suit-value"
              />
              <p className="text-[10.5px] text-muted-foreground mt-1">
                Entered: {formatRs(valueNum)}
              </p>
            </div>
          )}

          <div className="rounded-xl border border-primary/30 bg-primary/5 p-3.5">
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-primary/80">
                Calculated Court Fee
              </span>
              <span className="text-2xl font-bold text-primary font-mono">
                {formatRs(result.feeRs)}
              </span>
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground space-y-1">
              <p><span className="font-semibold text-foreground/70">Formula:</span> {result.formula}</p>
              <p><span className="font-semibold text-foreground/70">Citation:</span> {result.legalCitation}</p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-muted/40 p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Ready-to-paste draft text
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="text-[10px] flex items-center gap-1 text-primary hover:text-primary/80"
                data-testid="button-copy-fee-text"
              >
                <Copy size={11} />
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <p className="text-[11.5px] text-foreground/90 font-serif leading-relaxed">
              {result.draftText}
            </p>
          </div>

          <p className="text-[10px] text-muted-foreground italic leading-snug">
            ⚠️ This is a baseline calculator. Verify the exact applicable Schedule with your
            registrar — provincial amendments to the Court Fees Act 1870 vary slightly between
            Punjab, Sindh, KP, Balochistan, Islamabad and AJK.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="text-xs px-3 py-2 rounded-lg border border-border text-foreground hover:bg-muted"
            data-testid="button-court-fee-cancel"
          >
            Close
          </button>
          {onInsert && (
            <button
              type="button"
              onClick={() => { onInsert(result.draftText); onClose(); }}
              className="text-xs px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5 font-semibold"
              data-testid="button-insert-fee-text"
            >
              Insert into draft
              <ArrowRight size={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
