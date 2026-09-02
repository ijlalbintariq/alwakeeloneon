import React, { useState } from "react";
import { Link } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Check,
  Zap,
  Sparkles,
  Shield,
  CreditCard,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import {
  SUBSCRIPTION_PLANS,
  getPlanCyclePricing,
  BillingCycle,
  SubscriptionPlan,
} from "@/lib/subscription-plans";

interface UpgradePlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTier?: string;
}

export const UpgradePlanModal: React.FC<UpgradePlanModalProps> = ({
  isOpen,
  onClose,
  currentTier = "standard",
}) => {
  const [cycle, setCycle] = useState<BillingCycle>("monthly");

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-4xl bg-white border-[#E2E8F0] text-[#0F172A] p-6 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-center sm:text-left">
          <div className="flex items-center gap-2 text-[#105B38] font-mono text-xs mb-1 font-semibold">
            <Sparkles className="w-4 h-4" />
            <span>AL WAKEELO CHAMBERS QUOTA & UPGRADE</span>
          </div>
          <DialogTitle className="text-2xl font-bold font-serif text-[#0F172A]">
            Chambers Subscriptions & AI Action Quotas
          </DialogTitle>
          <DialogDescription className="text-xs text-[#64748B]">
            Transparent PKR pricing with instant Safepay settlement, unlimited 83k statutory search, and multi-advocate pooled quotas.
          </DialogDescription>
        </DialogHeader>

        {/* Cycle Selector */}
        <div className="flex justify-center my-3">
          <div className="inline-flex items-center p-1 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs">
            <button
              onClick={() => setCycle("monthly")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                cycle === "monthly"
                  ? "bg-[#105B38] text-white font-bold shadow-sm"
                  : "text-[#64748B] hover:text-[#0F172A]"
              }`}
            >
              Monthly Retainer
            </button>
            <button
              onClick={() => setCycle("quarterly")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1 ${
                cycle === "quarterly"
                  ? "bg-[#105B38] text-white font-bold shadow-sm"
                  : "text-[#64748B] hover:text-[#0F172A]"
              }`}
            >
              <span>Quarterly</span>
              <span
                className={`text-[9px] px-1 py-0.2 rounded font-mono font-bold ${
                  cycle === "quarterly" ? "bg-white/20 text-white" : "bg-[#EBF5F0] text-[#105B38]"
                }`}
              >
                Save 10%
              </span>
            </button>
            <button
              onClick={() => setCycle("yearly")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1 ${
                cycle === "yearly"
                  ? "bg-[#105B38] text-white font-bold shadow-sm"
                  : "text-[#64748B] hover:text-[#0F172A]"
              }`}
            >
              <span>Annual Chambers</span>
              <span
                className={`text-[9px] px-1 py-0.2 rounded font-mono font-bold ${
                  cycle === "yearly" ? "bg-white/20 text-white" : "bg-[#EBF5F0] text-[#105B38]"
                }`}
              >
                Save 20%
              </span>
            </button>
          </div>
        </div>

        {/* Plan Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
          {SUBSCRIPTION_PLANS.map((plan: SubscriptionPlan) => {
            const pricing = getPlanCyclePricing(plan, cycle);
            const isCurrent =
              currentTier.toLowerCase() === plan.key.toLowerCase();

            return (
              <div
                key={plan.key}
                className={`relative flex flex-col justify-between rounded-xl p-4 border transition-all ${
                  plan.highlighted
                    ? "bg-white border-[#105B38] shadow-md ring-1 ring-[#105B38]/30"
                    : isCurrent
                    ? "bg-white border-emerald-500/50"
                    : "bg-[#F8FAFC] border-[#E2E8F0] hover:border-[#CBD5E1]"
                }`}
              >
                {plan.highlighted && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#105B38] text-white shadow-sm">
                    MOST POPULAR
                  </span>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-bold text-sm text-[#0F172A] font-serif">
                      {plan.title}
                    </h3>
                    {isCurrent && (
                      <span className="text-[9px] font-mono text-[#105B38] bg-[#EBF5F0] border border-[#A3D4BC] px-1.5 py-0.5 rounded font-bold">
                        Current
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#64748B] mb-3">
                    {plan.subtitle}
                  </p>

                  <div className="mb-4">
                    <span className="text-xl font-bold font-mono text-[#0F172A]">
                      {pricing.totalLabel}
                    </span>
                    {cycle !== "monthly" && (
                      <p className="text-[10px] text-[#105B38] font-mono mt-0.5 font-semibold">
                        {pricing.effectiveMonthlyLabel}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2 text-[11px] text-[#334155]">
                    {plan.features.map((feat: string, idx: number) => (
                      <div key={idx} className="flex items-start gap-1.5">
                        <Check className="w-3.5 h-3.5 text-[#105B38] shrink-0 mt-0.5" />
                        <span className="leading-snug">{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-[#E2E8F0]">
                  <Link
                    href={`/preview/checkout?plan=${plan.key}&cycle=${cycle}`}
                    onClick={() => onClose()}
                    className={`w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-all ${
                      plan.highlighted
                        ? "bg-[#105B38] hover:bg-[#0D4A2E] text-white font-bold shadow-sm"
                        : "bg-[#E2E8F0] hover:bg-[#CBD5E1] text-[#0F172A]"
                    }`}
                  >
                    <span>{plan.cta}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Link to Full Pricing Matrix */}
        <div className="mt-4 pt-3 border-t border-[#E2E8F0] flex items-center justify-between text-xs text-[#64748B]">
          <span>Need custom enterprise seats or on-premise deployment?</span>
          <Link
            href="/preview/pricing"
            onClick={() => onClose()}
            className="text-[#105B38] hover:underline font-bold flex items-center gap-1"
          >
            <span>View Full 20+ Feature Matrix & FAQ</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
};

