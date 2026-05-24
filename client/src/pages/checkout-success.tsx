import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, Mail, PhoneCall, XCircle, ArrowRight, ShieldCheck } from "lucide-react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";

type VerificationState = "loading" | "success" | "failed";

type VerificationData = {
  success: boolean;
  planKey: string;
  billingCycle: string;
  amountPkr: number;
  status: string;
};

const PLAN_LABELS: Record<string, string> = {
  standard: "Standard",
  pro: "Pro",
  chamber: "Chamber",
  enterprise: "Enterprise",
};

const CYCLE_LABELS: Record<string, string> = {
  monthly: "Monthly",
  quarterly: "3 Months",
  yearly: "Yearly",
};

function formatPkr(value: number): string {
  return `PKR ${Math.max(0, Math.round(value)).toLocaleString("en-US")}`;
}

export default function CheckoutSuccessPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [state, setState] = useState<VerificationState>("loading");
  const [data, setData] = useState<VerificationData | null>(null);
  const [error, setError] = useState<string>("");

  const tracker = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("tracker") || "";
  }, []);

  useEffect(() => {
    if (!tracker) {
      setState("failed");
      setError("No payment tracker found. Please check your checkout link.");
      return;
    }

    let cancelled = false;

    async function verify() {
      try {
        const res = await apiRequest("GET", `/api/safepay/verify?tracker=${encodeURIComponent(tracker)}`);
        if (cancelled) return;
        const result = await res.json();

        if (result.success) {
          setState("success");
          setData(result);
        } else {
          setState("failed");
          setError("Payment was not completed successfully. Please try again or contact support.");
          setData(result);
        }
      } catch (err: any) {
        if (cancelled) return;
        setState("failed");
        setError(err?.message || "Unable to verify payment status.");
      }
    }

    verify();
    return () => { cancelled = true; };
  }, [tracker]);

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        {/* Loading State */}
        {state === "loading" && (
          <div className="rounded-3xl border border-border bg-card p-8 text-center space-y-5">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 border border-primary/20 mx-auto">
              <Loader2 size={28} className="text-primary animate-spin" />
            </div>
            <h1 className="text-xl font-bold italic" style={{ fontFamily: "'Playfair Display', serif" }}>
              Verifying your payment...
            </h1>
            <p className="text-sm text-muted-foreground">
              Please wait while we confirm your payment with Safepay.
            </p>
          </div>
        )}

        {/* Success State */}
        {state === "success" && data && (
          <div className="rounded-3xl border border-border bg-card p-8 space-y-6">
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 mx-auto">
                <CheckCircle2 size={36} className="text-emerald-400" />
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-300 mx-auto">
                <ShieldCheck size={13} />
                Payment Confirmed
              </div>
              <h1 className="text-2xl font-bold italic" style={{ fontFamily: "'Playfair Display', serif" }}>
                Subscription Activated!
              </h1>
              <p className="text-sm text-muted-foreground">
                Your <span className="text-primary font-semibold">{PLAN_LABELS[data.planKey] || data.planKey}</span> plan
                has been activated on the <span className="font-semibold text-foreground">{CYCLE_LABELS[data.billingCycle] || data.billingCycle}</span> cycle.
              </p>
            </div>

            {/* Payment Receipt */}
            <div className="rounded-2xl border border-border bg-background p-5 space-y-3">
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-primary">Payment Receipt</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Plan</span>
                  <span className="text-sm font-bold text-foreground">{PLAN_LABELS[data.planKey] || data.planKey}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Billing Cycle</span>
                  <span className="text-sm font-semibold text-foreground">{CYCLE_LABELS[data.billingCycle] || data.billingCycle}</span>
                </div>
                <div className="border-t border-border pt-2 flex items-center justify-between">
                  <span className="text-sm font-bold text-foreground">Amount Paid</span>
                  <span className="text-lg font-bold text-primary">{formatPkr(data.amountPkr)}</span>
                </div>
              </div>
            </div>

            {/* Account Info */}
            {user && (
              <div className="rounded-2xl border border-border bg-background p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground mb-1">Account</p>
                <p className="text-sm text-foreground font-semibold">
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => navigate("/settings")}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-xs font-black uppercase tracking-widest text-primary-foreground hover:bg-primary/90 transition-colors"
                data-testid="checkout-success-settings"
              >
                <ArrowRight size={14} />
                Go to Account Settings
              </button>
              <button
                type="button"
                onClick={() => navigate("/")}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-3 text-xs font-black uppercase tracking-widest text-foreground hover:border-primary hover:text-primary transition-colors"
                data-testid="checkout-success-dashboard"
              >
                Continue to Dashboard
              </button>
            </div>
          </div>
        )}

        {/* Failed State */}
        {state === "failed" && (
          <div className="rounded-3xl border border-border bg-card p-8 space-y-6">
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-500/10 border-2 border-red-500/30 mx-auto">
                <XCircle size={36} className="text-red-400" />
              </div>
              <h1 className="text-2xl font-bold italic" style={{ fontFamily: "'Playfair Display', serif" }}>
                Payment Not Confirmed
              </h1>
              <p className="text-sm text-muted-foreground">
                {error || "We couldn't verify your payment. Please try again or contact support."}
              </p>
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => navigate(`/checkout?plan=${data?.planKey || "pro"}&cycle=${data?.billingCycle || "monthly"}`)}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-xs font-black uppercase tracking-widest text-primary-foreground hover:bg-primary/90 transition-colors"
                data-testid="checkout-failed-retry"
              >
                Try Again
              </button>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <a
                  href="mailto:support@alwakeelo.com?subject=Payment%20Issue"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-3 text-xs font-black uppercase tracking-widest text-foreground hover:border-primary hover:text-primary transition-colors"
                  data-testid="checkout-failed-email"
                >
                  <Mail size={14} /> Email Support
                </a>
                <a
                  href="tel:00923096875797"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-3 text-xs font-black uppercase tracking-widest text-foreground hover:border-primary hover:text-primary transition-colors"
                  data-testid="checkout-failed-call"
                >
                  <PhoneCall size={14} /> Call Support
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
