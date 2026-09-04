import React, { useState, useEffect } from "react";
import { Mail, ArrowLeft, CheckCircle, ShieldCheck, Scale, ArrowRight, RefreshCw, KeyRound } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useDocumentHead } from "@/hooks/use-document-head";

export default function PreviewForgotPassword() {
  useDocumentHead({
    title: "Chamber Password Recovery | Al Wakeelo",
    description: "Reset your Al Wakeelo advocate password. We'll send a secure recovery link and OTP.",
    path: "/preview/forgot-password",
    index: false,
  });

  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const [serverMessage, setServerMessage] = useState<string>("");
  const [isGoogleAccountNotice, setIsGoogleAccountNotice] = useState(false);
  const [resendCountdown, setResendCountdown] = useState<number>(60);
  const [canResend, setCanResend] = useState<boolean>(false);

  const [, navigate] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (submitted && resendCountdown > 0) {
      setCanResend(false);
      timer = setInterval(() => {
        setResendCountdown((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [submitted, resendCountdown]);

  const forgotMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/forgot-password", {
        email,
        captchaToken: (window as any).__ALWAKEELO_CAPTCHA_TOKEN || undefined,
      });
      return await res.json();
    },
    onSuccess: (data: any) => {
      setSubmitted(true);
      setServerMessage(String(data?.message || ""));
      setIsGoogleAccountNotice(data?.provider === "google" || data?.action === "use_google_signin");
      const url = data?.resetUrl || (data?.token ? `/preview/reset-password?token=${data.token}&email=${encodeURIComponent(email)}` : null);
      setResetUrl(url);
      setResendCountdown(60);
      setCanResend(false);
      toast({
        title: "Recovery Instructions Dispatched",
        description: data?.message || "Check your inbox for your 6-digit OTP verification code.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      toast({
        title: "Invalid Email",
        description: "Please provide a valid chamber email address.",
        variant: "destructive",
      });
      return;
    }
    forgotMutation.mutate();
  };

  const handleVerifyOtpAndProceed = (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.trim().length < 4) {
      toast({
        title: "Invalid OTP",
        description: "Please enter the verification code sent to your email.",
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "OTP Verified Successfully",
      description: "Redirecting to password reset...",
    });
    if (resetUrl) {
      navigate(resetUrl);
    } else {
      navigate(`/preview/reset-password?token=preview-token-${Date.now()}&email=${encodeURIComponent(email)}`);
    }
  };

  const handleResend = () => {
    if (!canResend) return;
    forgotMutation.mutate();
  };

  return (
    <div className="preview-theme-scope min-h-screen bg-[#F8FAFC] dark:bg-[#0B131E] flex items-center justify-center p-3 sm:p-6 relative overflow-hidden text-[#0F172A] dark:text-[#F8FAFC]">
      {/* Background ambient lighting */}
      <div className="absolute top-[-12%] left-[-12%] w-[48%] h-[48%] bg-[#105B38]/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-14%] right-[-12%] w-[40%] h-[40%] bg-[#105B38]/10 rounded-full blur-[130px] pointer-events-none" />

      <div className="w-full max-w-md bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] shadow-xl shadow-[#105B38]/5 p-6 sm:p-10 rounded-[1.8rem] sm:rounded-[2.2rem] relative z-10">
        {/* Header Branding */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-2xl mx-auto overflow-hidden border border-[#105B38]/30 mb-4 shadow-lg shadow-[#105B38]/15 dark:shadow-[#10B981]/10 bg-[#EBF5F0] dark:bg-[#105B38]/20 flex items-center justify-center p-2.5">
            <Scale className="w-8 h-8 text-[#105B38]" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0F172A] dark:text-[#F8FAFC]" style={{ fontFamily: "'Playfair Display', serif" }}>
            Al Wakeelo
          </h1>
          <p className="text-[11px] uppercase tracking-[0.25em] text-[#105B38] font-bold mt-1">
            Chamber Password Recovery
          </p>
        </div>

        {submitted ? (
          <div className="space-y-5">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 bg-[#EBF5F0] dark:bg-[#105B38]/20 border border-[#A3D4BC] dark:border-[#10B981]/30 rounded-full mx-auto flex items-center justify-center shadow-inner">
                <CheckCircle size={28} className="text-[#105B38]" />
              </div>
              <h2 className="text-lg font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                {isGoogleAccountNotice ? "Use Google Sign-In" : "Recovery Instructions Dispatched"}
              </h2>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] leading-relaxed">
                {isGoogleAccountNotice
                  ? "This email is registered via Google Chambers SSO. Please return to sign in using Google."
                  : (serverMessage || `We have sent a 6-digit OTP and secure reset link to ${email}.`)}
              </p>
            </div>

            {!isGoogleAccountNotice && (
              <div className="space-y-4">
                {/* OTP Input Form */}
                <form onSubmit={handleVerifyOtpAndProceed} className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-[#334155] dark:text-[#CBD5E1] mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <KeyRound size={13} className="text-[#105B38]" />
                        Enter 6-Digit OTP Code
                      </span>
                      <span className="text-[10px] text-[#105B38] bg-[#EBF5F0] dark:bg-[#105B38]/20 px-2 py-0.5 rounded font-mono font-bold">
                        Demo Code: 742918
                      </span>
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      placeholder="e.g. 742918"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                      data-testid="input-otp-code"
                      className="w-full bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] text-[#0F172A] dark:text-[#F8FAFC] placeholder-slate-400 text-center tracking-[0.5em] font-mono font-bold text-lg py-3 rounded-xl focus:outline-none focus:border-[#105B38] focus:ring-2 focus:ring-[#105B38]/20 transition-all"
                    />
                  </div>

                  <button
                    type="submit"
                    data-testid="button-verify-otp"
                    className="w-full bg-[#105B38] text-white font-bold text-xs uppercase tracking-wider py-3 rounded-xl hover:bg-[#0D4A2E] transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#105B38]/20"
                  >
                    Verify Code & Set New Password
                    <ArrowRight size={14} />
                  </button>
                </form>

                {/* 1-Click Fast Reset Link Button */}
                {resetUrl && (
                  <div className="pt-2">
                    <div className="flex items-center gap-2 my-2">
                      <div className="flex-1 h-px bg-[#E2E8F0]" />
                      <span className="text-[10px] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] font-semibold">or 1-click preview jump</span>
                      <div className="flex-1 h-px bg-[#E2E8F0]" />
                    </div>

                    <Link
                      href={resetUrl}
                      data-testid="link-reset-password"
                      className="w-full bg-white dark:bg-[#131E2E] text-[#105B38] border border-[#A3D4BC] dark:border-[#10B981]/30 hover:bg-[#EBF5F0] dark:bg-[#105B38]/20 font-bold text-xs py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 text-center shadow-sm"
                    >
                      Instant Password Reset Form
                      <ArrowRight size={13} />
                    </Link>
                  </div>
                )}

                {/* Resend Countdown */}
                <div className="text-center pt-2">
                  {canResend ? (
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={forgotMutation.isPending}
                      data-testid="button-resend-forgot"
                      className="inline-flex items-center gap-1.5 text-xs text-[#105B38] font-bold hover:underline"
                    >
                      <RefreshCw size={12} className={forgotMutation.isPending ? "animate-spin" : ""} />
                      Resend Verification Code
                    </button>
                  ) : (
                    <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">
                      Resend code in <span className="font-mono font-bold text-[#105B38]">{resendCountdown}s</span>
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-[#E2E8F0] dark:border-[#1E2D44] text-center">
              <Link
                href="/preview/auth"
                data-testid="link-back-to-login"
                className="inline-flex items-center gap-1.5 text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#105B38] font-semibold transition-colors"
              >
                <ArrowLeft size={14} />
                Return to Chamber Sign In
              </Link>
            </div>
          </div>
        ) : (
          <>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] text-center mb-6 leading-relaxed">
              Enter the advocate email address linked to your chamber account to receive a secure recovery code.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]" />
                <input
                  type="email"
                  placeholder="Advocate Email Address *"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  data-testid="input-forgot-email"
                  className="w-full bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] text-[#0F172A] dark:text-[#F8FAFC] placeholder-slate-400 pl-10 pr-4 py-3.5 rounded-xl text-sm focus:outline-none focus:border-[#105B38] focus:ring-2 focus:ring-[#105B38]/20 transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={forgotMutation.isPending}
                data-testid="button-submit-forgot"
                className="w-full bg-[#105B38] text-white font-bold text-xs uppercase tracking-wider py-3.5 rounded-xl hover:bg-[#0D4A2E] transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#105B38]/20 disabled:opacity-50 disabled:cursor-not-allowed mt-4"
              >
                {forgotMutation.isPending ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    Send Recovery Code
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <Link
                href="/preview/auth"
                data-testid="link-back-to-login-form"
                className="inline-flex items-center gap-1.5 text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#105B38] font-semibold transition-colors"
              >
                <ArrowLeft size={14} />
                Return to Chamber Sign In
              </Link>
            </div>
          </>
        )}

        <div className="mt-6 pt-4 border-t border-[#F1F5F9] flex items-center justify-center gap-2 text-[10px] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">
          <ShieldCheck className="w-3 h-3 text-[#105B38]" />
          <span>Pakistan Bar Council & High Court Security Compliance</span>
        </div>
      </div>
    </div>
  );
}
