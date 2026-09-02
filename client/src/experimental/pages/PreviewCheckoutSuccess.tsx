import React, { useEffect, useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import {
  CheckCircle2,
  ShieldCheck,
  ArrowRight,
  Printer,
  Download,
  Copy,
  Check,
  Scale,
  Sparkles,
  Calendar,
  Users,
  FileText,
  BookOpen,
  Cpu,
  Layers,
  Settings,
} from "lucide-react";
import "@/experimental/styles/preview-theme.css";

interface StoredOrderRecord {
  orderId: string;
  planKey: string;
  planTitle: string;
  billingCycle: string;
  cycleMonths: number;
  basePrice: number;
  cycleSavings: number;
  promoDiscount: number;
  taxProvince: string;
  taxAuthority: string;
  taxRate: number;
  taxAmount: number;
  finalTotal: number;
  paymentMethod: string;
  counselName: string;
  counselEmail: string;
  barId: string;
  autoRenew: boolean;
  timestamp: string;
  status: string;
}

const PLAN_NAME_MAP: Record<string, string> = {
  starter: "Free Starter",
  standard: "Standard",
  pro: "Senior Counsel Pro",
  chamber: "Chamber Team",
  enterprise: "Enterprise Chamber",
};

export default function PreviewCheckoutSuccess() {
  const [location, navigate] = useLocation();
  const [copiedRef, setCopiedRef] = useState<boolean>(false);

  // Read query parameters
  const queryParams = useMemo(() => {
    const search = window.location.search || (location.includes("?") ? `?${location.split("?")[1]}` : "");
    return new URLSearchParams(search);
  }, [location]);

  const queryRef = queryParams.get("ref") || "";
  const queryPlan = queryParams.get("plan") || "pro";
  const queryCycle = queryParams.get("cycle") || "monthly";
  const queryAmount = queryParams.get("amount") || "";

  // Attempt to recover complete order details from localStorage
  const [order, setOrder] = useState<StoredOrderRecord | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("alwakeelo_preview_last_order");
      if (stored) {
        const parsed = JSON.parse(stored);
        setOrder(parsed);
      }
    } catch (e) {
      console.error("Could not parse stored order", e);
    }
  }, []);

  const orderId = order?.orderId || queryRef || "";
  const planKey = order?.planKey || queryPlan;
  const planTitle = order?.planTitle || PLAN_NAME_MAP[planKey.toLowerCase()] || "Senior Counsel Pro";
  const billingCycle = order?.billingCycle || queryCycle;
  const cycleMonths = order?.cycleMonths || (billingCycle === "quarterly" ? 3 : billingCycle === "yearly" ? 12 : 1);
  const totalAmount = order?.finalTotal ?? (queryAmount ? parseInt(queryAmount, 10) : 1000);
  const taxAmount = order?.taxAmount ?? Math.round(totalAmount * 0.16);
  const taxProvince = order?.taxProvince || "Punjab (PRA 16%)";
  const counselName = order?.counselName || "Adv. Muhammad Hashim Khan";
  const counselEmail = order?.counselEmail || "hashim.khan@chambers.pk";
  const barId = order?.barId || "HC/LHR/8921/2020";
  const paymentMethodLabel =
    order?.paymentMethod === "kuickpay"
      ? "1Bill / Kuickpay (1Link Clearing)"
      : order?.paymentMethod === "wallet"
      ? "JazzCash / Mobile Wallet"
      : order?.paymentMethod === "wire"
      ? "HBL Corporate Bank Wire"
      : "Safepay Debit/Credit Card (Visa/Mastercard)";

  // Format dates
  const invoiceDate = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const nextRenewalDate = new Date();
  nextRenewalDate.setMonth(nextRenewalDate.getMonth() + cycleMonths);
  const renewalDateString = nextRenewalDate.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const handleCopyRef = () => {
    navigator.clipboard.writeText(orderId);
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="preview-theme-scope min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans selection:bg-[#105B38]/20 selection:text-[#0F172A]">
      {/* 1. Header Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#E2E8F0] px-4 sm:px-8 py-3.5 flex items-center justify-between print:hidden">
        <div className="flex items-center gap-2">
          <img src="/logo.svg" alt="Al Wakeelo" className="w-5 h-5 object-contain" />
          <span className="font-bold text-[#0F172A] font-serif text-sm">AL WAKEELO INVOICE & ORDER RECEIPT</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handlePrint}
            className="px-3 py-1.5 rounded-lg border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] text-xs font-semibold text-[#475569] flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Receipt</span>
          </button>

          <Link
            href="/preview/dashboard"
            className="px-4 py-1.5 rounded-lg bg-[#105B38] hover:bg-[#0D4A2E] text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
          >
            <span>Open Workstation</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* 2. Main Success Card */}
      <main className="flex-1 px-4 sm:px-8 py-10 max-w-4xl mx-auto w-full">
        <div className="space-y-6">
          {/* Celebratory Banner */}
          <div className="bg-white rounded-3xl border border-[#A3D4BC] p-6 sm:p-8 shadow-sm text-center relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#EBF5F0] rounded-full blur-2xl opacity-60" />
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-[#EBF5F0] rounded-full blur-2xl opacity-60" />

            <div className="relative z-10 space-y-4">
              <div className="w-16 h-16 rounded-full bg-[#EBF5F0] border-2 border-[#A3D4BC] flex items-center justify-center mx-auto text-[#105B38]">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EBF5F0] border border-[#A3D4BC] text-[#105B38] text-xs font-mono font-bold">
                <span className="w-2 h-2 rounded-full bg-[#105B38] animate-pulse" />
                <span>SUBSCRIPTION ACTIVATED · ALLOCATION LIVE</span>
              </div>

              <h1 className="text-2xl sm:text-4xl font-extrabold font-serif tracking-tight text-[#0F172A]">
                Welcome to Alwakeelo Chamber Suite!
              </h1>
              <p className="text-xs sm:text-sm text-[#475569] max-w-lg mx-auto leading-relaxed">
                Your <strong className="text-[#0F172A]">{planTitle}</strong> plan is now active. All 83,117 Pakistani statutes, 600k+ Supreme Court & High Court precedents, and drafting tools are unlocked.
              </p>

              {/* Order Reference Badge */}
              <div className="inline-flex items-center gap-3 p-2 px-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-mono">
                <span className="text-[#64748B]">Order Ref ID:</span>
                <span className="font-bold text-[#105B38] text-sm">{orderId}</span>
                <button
                  type="button"
                  onClick={handleCopyRef}
                  className="text-[11px] text-[#105B38] hover:underline flex items-center gap-1 font-sans"
                >
                  {copiedRef ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedRef ? "Copied" : "Copy"}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Official Tax Invoice & Receipt Card */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 sm:p-8 shadow-sm">
            {/* Invoice Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-[#E2E8F0]">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <img src="/logo.svg" alt="Al Wakeelo" className="w-5 h-5 object-contain" />
                  <span className="font-bold text-lg font-serif text-[#0F172A]">AL WAKEELO LEGAL TECHNOLOGIES (PVT) LTD</span>
                </div>
                <p className="text-[11px] text-[#64748B] font-mono">
                  National Tax No. (NTN): 9842104-7 · STRN: 3277876123456
                </p>
                <p className="text-[11px] text-[#64748B]">
                  Supreme Court Chambers Annex, Blue Area, Islamabad, Pakistan
                </p>
              </div>

              <div className="text-left sm:text-right">
                <span className="text-xs font-mono font-bold uppercase tracking-widest text-[#105B38] block">
                  OFFICIAL TAX INVOICE
                </span>
                <span className="text-sm font-mono font-bold text-[#0F172A] block mt-0.5">
                  INV-{orderId.replace("TRK-PK-", "")}
                </span>
                <span className="text-xs text-[#64748B] block mt-0.5">Date: {invoiceDate}</span>
              </div>
            </div>

            {/* Billed To & Subscription Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-6 border-b border-[#E2E8F0] text-xs">
              <div>
                <span className="font-bold font-mono text-[#64748B] uppercase tracking-wider block mb-1">
                  BILLED TO (COUNSEL / CHAMBER)
                </span>
                <p className="font-bold text-sm text-[#0F172A]">{counselName}</p>
                <p className="text-[#475569]">{counselEmail}</p>
                <p className="font-mono text-[#105B38] font-semibold mt-1">Bar License: {barId}</p>
              </div>

              <div className="sm:text-right">
                <span className="font-bold font-mono text-[#64748B] uppercase tracking-wider block mb-1">
                  SUBSCRIPTION PERIOD & RENEWAL
                </span>
                <p className="text-[#475569]">
                  Billing Frequency: <strong className="text-[#0F172A] capitalize">{billingCycle}</strong>
                </p>
                <p className="text-[#475569]">
                  Period Start: <strong className="text-[#0F172A]">{invoiceDate}</strong>
                </p>
                <p className="text-[#475569]">
                  Next Scheduled Renewal: <strong className="text-[#105B38]">{renewalDateString}</strong>
                </p>
              </div>
            </div>

            {/* Itemized Line Items Table */}
            <div className="py-6 border-b border-[#E2E8F0]">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E2E8F0] text-[#64748B] font-mono uppercase tracking-wider">
                    <th className="pb-3">Description</th>
                    <th className="pb-3 text-center">Cycle Duration</th>
                    <th className="pb-3 text-right">Amount (PKR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9] text-[#334155]">
                  <tr>
                    <td className="py-3.5">
                      <p className="font-bold text-[#0F172A]">{planTitle} Subscription</p>
                      <p className="text-[11px] text-[#64748B]">
                        Chamber AI token pool, 83,117 Pakistani statutes, 600k+ judgments & Word Add-in
                      </p>
                    </td>
                    <td className="py-3.5 text-center font-mono">{cycleMonths} Month(s)</td>
                    <td className="py-3.5 text-right font-mono font-semibold">
                      PKR {(totalAmount - taxAmount).toLocaleString("en-US")}
                    </td>
                  </tr>

                  <tr>
                    <td className="py-3.5">
                      <p className="font-bold text-[#0F172A]">Provincial Sales Tax</p>
                      <p className="text-[11px] text-[#64748B]">{taxProvince}</p>
                    </td>
                    <td className="py-3.5 text-center font-mono">—</td>
                    <td className="py-3.5 text-right font-mono font-semibold">
                      PKR {taxAmount.toLocaleString("en-US")}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Total Paid & Payment Method */}
            <div className="pt-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="text-xs space-y-1">
                <span className="font-semibold text-[#64748B]">Payment Method:</span>
                <p className="font-bold text-[#0F172A]">{paymentMethodLabel}</p>
                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-mono font-bold">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                  <span>TRANSACTION CLEARED & SETTLED</span>
                </span>
              </div>

              <div className="text-left sm:text-right">
                <span className="text-xs text-[#64748B] block">Total Amount Paid</span>
                <span className="text-2xl font-mono font-black text-[#105B38] block">
                  PKR {totalAmount.toLocaleString("en-US")}
                </span>
              </div>
            </div>
          </div>

          {/* 3. Action Hub Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 print:hidden">
            <Link
              href="/preview/dashboard"
              className="p-4 rounded-2xl bg-[#105B38] hover:bg-[#0D4A2E] text-white flex items-center justify-between shadow-md transition-all group"
            >
              <div>
                <span className="text-xs font-bold block">Open Chambers Workstation</span>
                <span className="text-[11px] text-emerald-100 block">Launch your daily docket & AI chat</span>
              </div>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>

            <Link
              href="/preview/statutes"
              className="p-4 rounded-2xl bg-white border border-[#E2E8F0] hover:border-[#A3D4BC] text-[#0F172A] flex items-center justify-between shadow-sm transition-all group"
            >
              <div>
                <span className="text-xs font-bold block">Explore 83,117 Statutes</span>
                <span className="text-[11px] text-[#64748B] block">Full 5,887 Acts index & calculators</span>
              </div>
              <BookOpen className="w-5 h-5 text-[#105B38]" />
            </Link>

            <Link
              href="/preview/settings"
              className="p-4 rounded-2xl bg-white border border-[#E2E8F0] hover:border-[#A3D4BC] text-[#0F172A] flex items-center justify-between shadow-sm transition-all group"
            >
              <div>
                <span className="text-xs font-bold block">Configure AI Models</span>
                <span className="text-[11px] text-[#64748B] block">Apex, Turbo & Chamber voice</span>
              </div>
              <Settings className="w-5 h-5 text-[#105B38]" />
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
