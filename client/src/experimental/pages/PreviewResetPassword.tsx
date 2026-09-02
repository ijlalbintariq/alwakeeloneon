import React, { useState, useMemo } from "react";
import { Lock, Eye, EyeOff, ArrowRight, CheckCircle, AlertTriangle, ShieldCheck, Scale, Check, X } from "lucide-react";
import { Link, useSearch, useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useDocumentHead } from "@/hooks/use-document-head";

export default function PreviewResetPassword() {
  useDocumentHead({
    title: "Set New Chamber Password | Al Wakeelo",
    description: "Set a new password for your Al Wakeelo advocate account.",
    path: "/preview/reset-password",
    index: false,
  });

  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const initialToken = params.get("token");
  const emailParam = params.get("email") || "advocate@chambers.pk";

  const [token, setToken] = useState<string | null>(initialToken);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [success, setSuccess] = useState(false);

  const [, navigate] = useLocation();
  const { toast } = useToast();

  // Password strength calculation
  const strength = useMemo(() => {
    let score = 0;
    const checks = {
      length: password.length >= 8,
      upper: /[A-Z]/.test(password),
      lower: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[^A-Za-z0-9]/.test(password),
    };

    if (checks.length) score += 20;
    if (checks.upper) score += 20;
    if (checks.lower) score += 20;
    if (checks.number) score += 20;
    if (checks.special) score += 20;

    let label = "Too Weak";
    let color = "bg-red-500";
    let textColor = "text-red-600";

    if (score >= 100) {
      label = "Chambers Grade Security";
      color = "bg-[#105B38]";
      textColor = "text-[#105B38]";
    } else if (score >= 80) {
      label = "Strong";
      color = "bg-emerald-500";
      textColor = "text-emerald-600";
    } else if (score >= 60) {
      label = "Good";
      color = "bg-amber-500";
      textColor = "text-amber-600";
    } else if (score >= 40) {
      label = "Fair";
      color = "bg-amber-400";
      textColor = "text-amber-500";
    }

    return { score, label, color, textColor, checks };
  }, [password]);

  const passwordsMatch = useMemo(() => {
    if (!confirmPassword) return null;
    return password === confirmPassword;
  }, [password, confirmPassword]);

  const resetMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/reset-password", {
        token,
        password,
        captchaToken: (window as any).__ALWAKEELO_CAPTCHA_TOKEN || undefined,
      });
      return await res.json();
    },
    onSuccess: () => {
      setSuccess(true);
      toast({
        title: "Password Updated",
        description: "Your advocate password has been successfully reset.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Reset Failed",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({
        title: "Passwords Don't Match",
        description: "Please verify that both password entries are identical.",
        variant: "destructive",
      });
      return;
    }
    if (password.length < 8) {
      toast({
        title: "Password Too Short",
        description: "Password must be at least 8 characters.",
        variant: "destructive",
      });
      return;
    }
    resetMutation.mutate();
  };

  if (!token) {
    return (
      <div className="preview-theme-scope min-h-screen bg-[#F8FAFC] flex items-center justify-center p-3 sm:p-6 relative overflow-hidden text-[#0F172A]">
        <div className="absolute top-[-12%] left-[-12%] w-[48%] h-[48%] bg-[#105B38]/10 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute bottom-[-14%] right-[-12%] w-[40%] h-[40%] bg-[#105B38]/10 rounded-full blur-[130px] pointer-events-none" />

        <div className="w-full max-w-md bg-white border border-[#E2E8F0] shadow-xl shadow-[#105B38]/5 p-6 sm:p-10 rounded-[1.8rem] sm:rounded-[2.2rem] relative z-10">
          <div className="text-center space-y-4">
            <div className="w-14 h-14 bg-red-50 border border-red-200 rounded-full mx-auto flex items-center justify-center">
              <AlertTriangle size={28} className="text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-[#0F172A]">Invalid or Missing Reset Token</h2>
            <p className="text-xs text-[#64748B] leading-relaxed">
              This password recovery token is missing, expired, or has already been consumed. Please request a new recovery link.
            </p>

            <div className="space-y-2 pt-2">
              <Link
                href="/preview/forgot-password"
                data-testid="link-request-new-reset"
                className="w-full bg-[#105B38] text-white font-bold text-xs uppercase tracking-wider py-3.5 rounded-xl hover:bg-[#0D4A2E] transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#105B38]/20 text-center"
              >
                Request New Recovery Link
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="preview-theme-scope min-h-screen bg-[#F8FAFC] flex items-center justify-center p-3 sm:p-6 relative overflow-hidden text-[#0F172A]">
      {/* Background ambient lighting */}
      <div className="absolute top-[-12%] left-[-12%] w-[48%] h-[48%] bg-[#105B38]/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-14%] right-[-12%] w-[40%] h-[40%] bg-[#105B38]/10 rounded-full blur-[130px] pointer-events-none" />

      <div className="w-full max-w-md bg-white border border-[#E2E8F0] shadow-xl shadow-[#105B38]/5 p-6 sm:p-10 rounded-[1.8rem] sm:rounded-[2.2rem] relative z-10">
        {/* Header Branding */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-2xl mx-auto overflow-hidden border border-[#105B38]/30 mb-4 shadow-lg shadow-[#105B38]/15 bg-[#EBF5F0] flex items-center justify-center p-2.5">
            <Scale className="w-8 h-8 text-[#105B38]" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0F172A]" style={{ fontFamily: "'Playfair Display', serif" }}>
            Al Wakeelo
          </h1>
          <p className="text-[11px] uppercase tracking-[0.25em] text-[#105B38] font-bold mt-1">
            Set New Chamber Password
          </p>
        </div>

        {success ? (
          <div className="text-center space-y-4">
            <div className="w-14 h-14 bg-[#EBF5F0] border border-[#A3D4BC] rounded-full mx-auto flex items-center justify-center shadow-inner">
              <CheckCircle size={28} className="text-[#105B38]" />
            </div>
            <h2 className="text-lg font-bold text-[#0F172A]">Password Reset Complete</h2>
            <p className="text-xs text-[#64748B] leading-relaxed">
              Your advocate account password has been updated successfully. You can now sign in with your new credentials.
            </p>
            <Link
              href="/preview/auth"
              data-testid="link-go-to-login"
              className="w-full bg-[#105B38] text-white font-bold text-xs uppercase tracking-wider py-3.5 rounded-xl hover:bg-[#0D4A2E] transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#105B38]/20 mt-4 text-center"
            >
              Sign In to Chambers Now
              <ArrowRight size={14} />
            </Link>
          </div>
        ) : (
          <>
            <p className="text-xs text-[#64748B] text-center mb-5 leading-relaxed">
              Enter your new chamber security password for <span className="font-semibold text-[#0F172A]">{emailParam}</span>.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* New Password */}
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748B]" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="New Password (min 8 characters) *"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  data-testid="input-new-password"
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] placeholder-slate-400 pl-10 pr-11 py-3 rounded-xl text-sm focus:outline-none focus:border-[#105B38] focus:ring-2 focus:ring-[#105B38]/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  data-testid="button-toggle-new-password"
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#0F172A] transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* Password Strength Indicator */}
              {password.length > 0 && (
                <div className="space-y-1.5 p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[#64748B] font-medium">Strength:</span>
                    <span className={`font-bold ${strength.textColor}`}>{strength.label}</span>
                  </div>
                  <div className="w-full bg-[#E2E8F0] h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${strength.color} transition-all duration-300`}
                      style={{ width: `${strength.score}%` }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-1 pt-1 text-[10px] text-[#64748B]">
                    <span className={`flex items-center gap-1 ${strength.checks.length ? "text-emerald-600 font-semibold" : ""}`}>
                      {strength.checks.length ? <Check size={10} /> : <X size={10} />} 8+ Characters
                    </span>
                    <span className={`flex items-center gap-1 ${strength.checks.upper ? "text-emerald-600 font-semibold" : ""}`}>
                      {strength.checks.upper ? <Check size={10} /> : <X size={10} />} Uppercase Letter
                    </span>
                    <span className={`flex items-center gap-1 ${strength.checks.number ? "text-emerald-600 font-semibold" : ""}`}>
                      {strength.checks.number ? <Check size={10} /> : <X size={10} />} Number
                    </span>
                    <span className={`flex items-center gap-1 ${strength.checks.special ? "text-emerald-600 font-semibold" : ""}`}>
                      {strength.checks.special ? <Check size={10} /> : <X size={10} />} Special Character
                    </span>
                  </div>
                </div>
              )}

              {/* Confirm New Password */}
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748B]" />
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm New Password *"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  data-testid="input-confirm-password"
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] placeholder-slate-400 pl-10 pr-11 py-3 rounded-xl text-sm focus:outline-none focus:border-[#105B38] focus:ring-2 focus:ring-[#105B38]/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  data-testid="button-toggle-confirm-password"
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#0F172A] transition-colors"
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* Passwords Match Check */}
              {confirmPassword.length > 0 && (
                <p className={`text-[11px] font-semibold flex items-center gap-1 ${passwordsMatch ? "text-emerald-600" : "text-red-500"}`}>
                  {passwordsMatch ? (
                    <>
                      <Check size={12} /> Passwords match
                    </>
                  ) : (
                    <>
                      <X size={12} /> Passwords do not match
                    </>
                  )}
                </p>
              )}

              <button
                type="submit"
                disabled={resetMutation.isPending || !passwordsMatch || password.length < 8}
                data-testid="button-submit-reset"
                className="w-full bg-[#105B38] text-white font-bold text-xs uppercase tracking-wider py-3.5 rounded-xl hover:bg-[#0D4A2E] transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#105B38]/20 disabled:opacity-50 disabled:cursor-not-allowed mt-4"
              >
                {resetMutation.isPending ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    Save Password & Activate
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </form>
          </>
        )}

        <div className="mt-6 pt-4 border-t border-[#F1F5F9] flex items-center justify-center gap-2 text-[10px] text-[#64748B]">
          <ShieldCheck className="w-3 h-3 text-[#105B38]" />
          <span>Encrypted High Court Chamber Authentication</span>
        </div>
      </div>
    </div>
  );
}
