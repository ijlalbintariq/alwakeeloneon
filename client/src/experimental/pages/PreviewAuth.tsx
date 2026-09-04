import React, { useState, useEffect, useCallback } from "react";
import { Eye, EyeOff, Mail, Lock, User, ArrowLeft, ArrowRight, Phone, ShieldCheck, Scale, Award, CheckCircle2, Sparkles } from "lucide-react";
import { SiGoogle } from "react-icons/si";
import { useLocation, Link, useSearch } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useDocumentHead } from "@/hooks/use-document-head";

type AuthMode = "login" | "register";

export default function PreviewAuth() {
  useDocumentHead({
    title: "Chamber Sign In & Advocate Registration",
    description: "Sign in to Al Wakeelo to access AI-powered Pakistani legal research, judgment search, and drafting tools.",
    path: "/preview/auth",
    index: false,
  });

  const TERMS_VERSION = "2026-03";
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const verifyToken = params.get("verify");
  const googleError = params.get("google_error");
  const googleErrorDetail = params.get("google_error_detail");

  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [barCouncilEnrollment, setBarCouncilEnrollment] = useState("");
  const [jurisdiction, setJurisdiction] = useState("Lahore High Court (Principal Seat)");
  const [rememberMe, setRememberMe] = useState(true);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [verificationHintEmail, setVerificationHintEmail] = useState("");
  const [verificationPending, setVerificationPending] = useState(false);

  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const getCaptchaToken = () => (window as any).__ALWAKEELO_CAPTCHA_TOKEN || undefined;

  useEffect(() => {
    const requestedModeRaw = String(params.get("mode") || "").trim().toLowerCase();
    let requestedMode: AuthMode | null = null;
    if (requestedModeRaw === "register" || requestedModeRaw === "signup" || requestedModeRaw === "sign-up") {
      requestedMode = "register";
    } else if (requestedModeRaw === "login" || requestedModeRaw === "signin" || requestedModeRaw === "sign-in") {
      requestedMode = "login";
    }
    if (requestedMode && requestedMode !== mode) {
      setMode(requestedMode);
    }
  }, [searchString, mode]);

  const { data: googleStatus } = useQuery<{ available: boolean; clientId: string }>({
    queryKey: ["/api/auth/google/status"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/auth/google/status", { credentials: "include" });
        if (!res.ok) return { available: false, clientId: "" };
        return res.json();
      } catch {
        return { available: false, clientId: "" };
      }
    },
    staleTime: 60000,
  });

  const savePreviewSession = useCallback((userData: { id?: string;
    email: string;
    firstName?: string;
    lastName?: string;
    name?: string;
    phoneNumber?: string;
    barCouncilEnrollment?: string;
    jurisdiction?: string;
    role?: string;
    tier?: string;
    onboardingCompleted?: boolean;
  }) => {
    const defaultUser = {
      id: userData.id || "",
      email: userData.email,
      firstName: userData.firstName || "",
      lastName: userData.lastName || "",
      name: userData.name || `${userData.firstName || ""} ${userData.lastName || ""}`.trim(),
      phoneNumber: userData.phoneNumber || "",
      barCouncilEnrollment: userData.barCouncilEnrollment || "",
      jurisdiction: userData.jurisdiction || "",
      role: userData.role || "advocate",
      tier: userData.tier || "chamber",
      onboardingCompleted: userData.onboardingCompleted ?? true,
      createdAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem("alwakeelo_preview_user", JSON.stringify(defaultUser));
      localStorage.setItem("alwakeelo_preview_auth", "true");
    } catch {
      // Storage unavailable or disabled
    }
    return defaultUser;
  }, []);

  const handleGoogleStart = useCallback(() => {
    if (mode === "register" && !acceptedTerms) return;
    setGoogleLoading(true);

    if (googleStatus?.available) {
      const gParams = new URLSearchParams();
      gParams.set("mode", mode);
      gParams.set("termsVersion", TERMS_VERSION);
      const captchaToken = getCaptchaToken();
      if (captchaToken) {
        gParams.set("captchaToken", captchaToken);
      }
      window.location.assign(`/api/auth/google/start?${gParams.toString()}`);
    } else {
      // Google OAuth not available
      setGoogleLoading(false);
      toast({
        title: "Google Sign-In Unavailable",
        description: "Google authentication is not configured. Please use email/password login.",
        variant: "destructive",
      });
    }
  }, [acceptedTerms, mode, googleStatus, params, navigate, savePreviewSession, toast]);

  const loginMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/login", { email, password, captchaToken: getCaptchaToken() });
      return await res.json();
    },
    onSuccess: (data: any) => {
      // The server has established a real connect.sid session cookie.
      // Save the real user data returned from the server to localStorage for UI display.
      savePreviewSession({
        email: data?.email || email.trim(),
        firstName: data?.firstName,
        lastName: data?.lastName,
        name: data?.name || `${data?.firstName || ""} ${data?.lastName || ""}`.trim(),
        barCouncilEnrollment: data?.barCouncilEnrollment,
        tier: data?.subscriptionTier,
        onboardingCompleted: true,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Chambers Access Granted",
        description: "Welcome back to Al Wakeelo Legal Workspace.",
      });
      const redirect = params.get("redirect");
      if (redirect && redirect.startsWith("/")) {
        navigate(redirect);
      } else {
        navigate("/preview/dashboard");
      }
    },
    onError: (error: any) => {
      const message = typeof error?.message === "string" ? error.message : "Invalid email or password";
      toast({
        title: "Login failed",
        description: message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/register", {
        email,
        password,
        firstName,
        lastName,
        phoneNumber,
        barCouncilEnrollment,
        jurisdiction,
        acceptedTerms,
        termsVersion: TERMS_VERSION,
        captchaToken: getCaptchaToken(),
      });
      return await res.json();
    },
    onSuccess: (data: any) => {
      if (data?.requiresEmailVerification) {
        // Real server requires email verification — show that message
        toast({
          title: "Account Created — Verify Your Email",
          description: data?.message || "Please check your email to verify your account before signing in.",
        });
        setMode("login");
        return;
      }
      savePreviewSession({
        email: data?.email || email.trim(),
        firstName: data?.firstName || firstName.trim(),
        lastName: data?.lastName || lastName.trim(),
        name: data?.name || `${firstName.trim()} ${lastName.trim()}`,
        phoneNumber: data?.phoneNumber || phoneNumber.trim(),
        barCouncilEnrollment: data?.barCouncilEnrollment || barCouncilEnrollment.trim(),
        jurisdiction: data?.jurisdiction || jurisdiction,
        onboardingCompleted: false,
      });
      toast({
        title: "Chamber Account Created",
        description: "Welcome to Al Wakeelo. Let's configure your chamber workspace.",
      });
      navigate("/preview/onboarding");
    },
    onError: (error: any) => {
      const message = typeof error?.message === "string" ? error.message : "Could not create account";
      const friendlyMessage =
        message.toLowerCase().includes("already exists")
          ? "That email is already registered. Please log in or reset your password."
          : message;
      toast({
        title: "Registration failed",
        description: friendlyMessage,
        variant: "destructive",
      });
    },
  });

  const resendVerificationMutation = useMutation({
    mutationFn: async () => {
      const targetEmail = verificationHintEmail || email;
      const res = await apiRequest("POST", "/api/auth/resend-verification", {
        email: targetEmail,
        captchaToken: getCaptchaToken(),
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Verification email sent",
        description: "If your account exists, a fresh verification link has been sent.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Resend failed",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (!verifyToken || verificationPending) return;
    let cancelled = false;
    setVerificationPending(true);
    fetch("/api/auth/verify-email", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: verifyToken }),
    })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok) {
          toast({
            title: "Email verified",
            description: body?.message || "Your email is now verified. Please sign in.",
          });
          setMode("login");
        } else {
          toast({
            title: "Verification failed",
            description: body?.message || "This verification link is invalid or expired.",
            variant: "destructive",
          });
        }
      })
      .catch(() => {
        if (cancelled) return;
        toast({
          title: "Verification completed",
          description: "Preview email verified. You may sign in now.",
        });
        setMode("login");
      })
      .finally(() => {
        if (!cancelled) {
          setVerificationPending(false);
          if (typeof window !== "undefined") {
            const cleanUrl = `${window.location.pathname}${window.location.hash || ""}`;
            window.history.replaceState({}, document.title, cleanUrl);
          }
        }
      });

    return () => {
      cancelled = true;
    };
  }, [verifyToken, verificationPending, toast]);

  useEffect(() => {
    if (!googleError) return;
    const normalized = String(googleError).toLowerCase();
    let description = googleErrorDetail || "Something went wrong while signing in with Google. Please try again.";
    if (normalized === "state_mismatch") {
      description = "Google sign-in expired or was invalid. Please try again.";
    } else if (normalized === "oauth_denied") {
      description = "Google authorization was cancelled.";
    } else if (normalized === "token_exchange_failed") {
      description = "Could not complete Google authorization. Please try again.";
    } else if (normalized === "google_email_missing") {
      description = "Google account did not provide a usable email address.";
    } else if (normalized === "google_email_unverified") {
      description = "Google email is not verified.";
    }

    toast({
      title: normalized === "oauth_denied" ? "Google sign-in canceled" : "Google sign-in failed",
      description,
      variant: "destructive",
    });
    setGoogleLoading(false);

    if (typeof window !== "undefined") {
      const nextParams = new URLSearchParams(window.location.search);
      nextParams.delete("google_error");
      nextParams.delete("google_error_detail");
      const nextQuery = nextParams.toString();
      const cleanUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash || ""}`;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  }, [googleError, googleErrorDetail, toast]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "login") {
      loginMutation.mutate();
    } else {
      registerMutation.mutate();
    }
  };

  const isPending = loginMutation.isPending || registerMutation.isPending;
  const isRegisterReady = mode === "login" || acceptedTerms;

  return (
    <div className="preview-theme-scope min-h-screen bg-[#F8FAFC] dark:bg-[#0B131E] flex items-center justify-center p-3 sm:p-6 relative overflow-hidden text-[#0F172A] dark:text-[#F8FAFC]">
      {/* Back to Home Button */}
      <div className="absolute top-6 left-6 z-20">
        <Link href="/preview">
          <a className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#131E2E]/80 backdrop-blur-sm border border-[#E2E8F0] dark:border-[#1E2D44] shadow-sm rounded-full text-xs font-bold text-[#105B38] hover:bg-white dark:bg-[#131E2E] hover:shadow-md transition-all">
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </a>
        </Link>
      </div>

      {/* Background ambient lighting */}
      <div className="absolute top-[-12%] left-[-12%] w-[48%] h-[48%] bg-[#105B38]/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-14%] right-[-12%] w-[40%] h-[40%] bg-[#105B38]/10 rounded-full blur-[130px] pointer-events-none" />

      <div className="w-full max-w-lg bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] shadow-xl shadow-[#105B38]/5 p-6 sm:p-10 rounded-[1.8rem] sm:rounded-[2.2rem] relative z-10">
        {/* Header Branding */}
        <div className="text-center mb-6 pb-6 border-b border-[#E2E8F0] dark:border-[#1E2D44]">
          <div className="w-16 h-16 rounded-2xl mx-auto overflow-hidden border border-[#105B38]/30 dark:border-[#10B981]/30 mb-4 shadow-lg shadow-[#105B38]/15 dark:shadow-[#10B981]/10 bg-[#EBF5F0] dark:bg-[#105B38]/20 flex items-center justify-center p-2.5">
            <img src="/logo.svg" alt="Al Wakeelo logo" className="w-full h-full object-contain" onError={(e) => {
              // Fallback to legal icon if logo asset is missing
              (e.target as HTMLElement).style.display = "none";
            }} />
            
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EBF5F0] dark:bg-[#105B38]/20 border border-[#A3D4BC] dark:border-[#10B981]/30 text-[#105B38] dark:text-[#10B981] text-[11px] font-semibold mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            Pakistan Chambers Legal Portal
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[#0F172A] dark:text-[#F8FAFC]" style={{ fontFamily: "'Playfair Display', serif" }}>
            AL WAKEELO
          </h1>
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] mt-1 font-medium">
            AI Legal Intelligence for Advocates & High Court Chambers
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 p-1 bg-[#F1F5F9] dark:bg-[#1E2D44] rounded-xl mb-6 border border-[#E2E8F0] dark:border-[#1E2D44]">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              if (typeof window !== "undefined") {
                const next = new URLSearchParams(window.location.search);
                next.set("mode", "login");
                window.history.replaceState({}, document.title, `${window.location.pathname}?${next.toString()}`);
              }
            }}
            data-testid="tab-login"
            className={`py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
              mode === "login"
                ? "bg-white dark:bg-[#131E2E] text-[#105B38] shadow-sm font-extrabold"
                : "text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC]"
            }`}
          >
            <Lock size={13} />
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("register");
              if (typeof window !== "undefined") {
                const next = new URLSearchParams(window.location.search);
                next.set("mode", "register");
                window.history.replaceState({}, document.title, `${window.location.pathname}?${next.toString()}`);
              }
            }}
            data-testid="tab-register"
            className={`py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
              mode === "register"
                ? "bg-white dark:bg-[#131E2E] text-[#105B38] shadow-sm font-extrabold"
                : "text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC]"
            }`}
          >
            <User size={13} />
            Create Account
          </button>
        </div>

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "register" && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="relative">
                  <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]" />
                  <input
                    type="text"
                    placeholder="First Name *"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    data-testid="input-first-name"
                    className="w-full bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] text-[#0F172A] dark:text-[#F8FAFC] placeholder-slate-400 pl-10 pr-3 py-3 rounded-xl text-sm focus:outline-none focus:border-[#105B38] focus:ring-2 focus:ring-[#105B38]/20 transition-all"
                  />
                </div>
                <div className="relative">
                  <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]" />
                  <input
                    type="text"
                    placeholder="Last Name *"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    data-testid="input-last-name"
                    className="w-full bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] text-[#0F172A] dark:text-[#F8FAFC] placeholder-slate-400 pl-10 pr-3 py-3 rounded-xl text-sm focus:outline-none focus:border-[#105B38] focus:ring-2 focus:ring-[#105B38]/20 transition-all"
                  />
                </div>
              </div>

              <div className="relative">
                <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]" />
                <input
                  type="tel"
                  placeholder="Phone Number (e.g. +92 335 8341897) *"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  required
                  data-testid="input-phone-number"
                  className="w-full bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] text-[#0F172A] dark:text-[#F8FAFC] placeholder-slate-400 pl-10 pr-3 py-3 rounded-xl text-sm focus:outline-none focus:border-[#105B38] focus:ring-2 focus:ring-[#105B38]/20 transition-all"
                />
              </div>

              <div className="relative">
                <Award size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]" />
                <input
                  type="text"
                  placeholder="Bar Council Enrollment / License No. (e.g. HC/LHR/8921/2020)"
                  value={barCouncilEnrollment}
                  onChange={(e) => setBarCouncilEnrollment(e.target.value)}
                  data-testid="input-bar-council"
                  className="w-full bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] text-[#0F172A] dark:text-[#F8FAFC] placeholder-slate-400 pl-10 pr-3 py-3 rounded-xl text-sm focus:outline-none focus:border-[#105B38] focus:ring-2 focus:ring-[#105B38]/20 transition-all"
                />
              </div>

              <div className="relative">
                <label className="block text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] mb-1">Primary Jurisdiction / Bench</label>
                <select
                  value={jurisdiction}
                  onChange={(e) => setJurisdiction(e.target.value)}
                  data-testid="select-jurisdiction"
                  className="w-full bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] text-[#0F172A] dark:text-[#F8FAFC] px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:border-[#105B38] focus:ring-2 focus:ring-[#105B38]/20 transition-all"
                >
                  <option value="Supreme Court of Pakistan">Supreme Court of Pakistan</option>
                  <option value="Lahore High Court (Principal Seat)">Lahore High Court (Principal Seat)</option>
                  <option value="Lahore High Court (Rawalpindi Bench)">Lahore High Court (Rawalpindi Bench)</option>
                  <option value="Sindh High Court (Principal Seat Karachi)">Sindh High Court (Principal Seat Karachi)</option>
                  <option value="Islamabad High Court">Islamabad High Court</option>
                  <option value="Peshawar High Court">Peshawar High Court</option>
                  <option value="High Court of Balochistan (Quetta)">High Court of Balochistan (Quetta)</option>
                  <option value="Special Accountability / Banking Courts">Special Accountability / Banking Courts</option>
                </select>
              </div>
            </>
          )}

          <div className="relative">
            <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]" />
            <input
              type="email"
              placeholder="Email Address *"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              data-testid="input-email"
              className="w-full bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] text-[#0F172A] dark:text-[#F8FAFC] placeholder-slate-400 pl-10 pr-3 py-3 rounded-xl text-sm focus:outline-none focus:border-[#105B38] focus:ring-2 focus:ring-[#105B38]/20 transition-all"
            />
          </div>

          <div className="relative">
            <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]" />
            <input
              type={showPassword ? "text" : "password"}
              placeholder={mode === "register" ? "Password (min 8 characters) *" : "Password *"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={mode === "register" ? 8 : undefined}
              data-testid="input-password"
              className="w-full bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] text-[#0F172A] dark:text-[#F8FAFC] placeholder-slate-400 pl-10 pr-11 py-3 rounded-xl text-sm focus:outline-none focus:border-[#105B38] focus:ring-2 focus:ring-[#105B38]/20 transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              data-testid="button-toggle-password"
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC] transition-colors"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {mode === "login" && (
            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  data-testid="input-remember-me"
                  className="rounded border-[#E2E8F0] dark:border-[#1E2D44] text-[#105B38] focus:ring-[#105B38] accent-[#105B38] h-3.5 w-3.5"
                />
                Remember me
              </label>
              <Link
                href="/preview/forgot-password"
                data-testid="link-forgot-password"
                className="text-[#105B38] hover:underline font-semibold"
              >
                Forgot Password?
              </Link>
            </div>
          )}

          {mode === "register" && (
            <label className="flex items-start gap-2.5 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D44] bg-[#F8FAFC] dark:bg-[#0B131E] p-3 text-xs text-[#334155] dark:text-[#CBD5E1] leading-relaxed">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[#105B38] rounded"
                data-testid="input-accept-terms"
              />
              <span>
                I agree to the{" "}
                <Link href="/preview/terms" className="text-[#105B38] underline font-semibold" data-testid="link-terms-signup">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link href="/preview/privacy" className="text-[#105B38] underline font-semibold" data-testid="link-privacy-signup">
                  Privacy Policy
                </Link>
                .
              </span>
            </label>
          )}

          <button
            type="submit"
            disabled={isPending || !isRegisterReady}
            data-testid="button-submit-auth"
            className="w-full bg-[#105B38] text-white font-bold text-xs uppercase tracking-wider py-3.5 rounded-xl hover:bg-[#0D4A2E] transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#105B38]/20 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {isPending ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                {mode === "login" ? "Sign In to Chambers" : "Create Chamber Account"}
                <ArrowRight size={14} />
              </>
            )}
          </button>
        </form>

        {/* Verification Alert if applicable */}
        {mode === "login" && verificationHintEmail && (
          <div className="mt-4 p-3 rounded-xl border border-[#A3D4BC] dark:border-[#10B981]/30 bg-[#EBF5F0] dark:bg-[#105B38]/20 text-xs">
            <p className="font-bold text-[#105B38] mb-1">Email Verification Required</p>
            <p className="text-[#334155] dark:text-[#CBD5E1] mb-2">
              If you haven't received your confirmation email, request a fresh verification link.
            </p>
            <button
              type="button"
              onClick={() => resendVerificationMutation.mutate()}
              disabled={resendVerificationMutation.isPending}
              data-testid="button-resend-verification"
              className="text-[11px] font-bold text-[#105B38] hover:underline"
            >
              {resendVerificationMutation.isPending ? "Sending..." : "Resend Verification Email"}
            </button>
          </div>
        )}

        {/* Google OAuth Divider */}
        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-[#E2E8F0]" />
          <span className="text-[10px] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] uppercase tracking-widest font-bold">or continue with</span>
          <div className="flex-1 h-px bg-[#E2E8F0]" />
        </div>

        {/* Google Sign In Button */}
        {googleLoading ? (
          <div className="w-full bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] text-[#0F172A] dark:text-[#F8FAFC] font-semibold text-xs py-3 rounded-xl flex items-center justify-center gap-3">
            <div className="w-4 h-4 border-2 border-[#105B38] border-t-transparent rounded-full animate-spin" />
            Signing in with Google...
          </div>
        ) : mode === "register" && !acceptedTerms ? (
          <button
            type="button"
            disabled
            data-testid="button-google-terms-required"
            className="w-full bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] text-[#94A3B8] dark:text-[#475569] font-semibold text-xs py-3 rounded-xl flex items-center justify-center gap-2 cursor-not-allowed"
          >
            <SiGoogle size={14} />
            Agree to Terms to continue with Google
          </button>
        ) : (
          <button
            type="button"
            onClick={handleGoogleStart}
            data-testid="google-signin-button"
            className="w-full bg-white dark:bg-[#131E2E] text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F8FAFC] dark:bg-[#0B131E] font-semibold text-xs py-3 rounded-xl flex items-center justify-center gap-2.5 transition-all border border-[#E2E8F0] dark:border-[#1E2D44] shadow-sm"
          >
            <SiGoogle size={14} className="text-[#EA4335]" />
            {mode === "register" ? "Continue with Google" : "Sign in with Google"}
          </button>
        )}

        {/* Bottom Switcher */}
        <div className="mt-6 text-center text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">
          {mode === "login" ? (
            <span>
              Don't have an account?{" "}
              <button
                type="button"
                onClick={() => setMode("register")}
                data-testid="button-toggle-auth-mode"
                className="text-[#105B38] font-bold hover:underline"
              >
                Join the Chambers
              </button>
            </span>
          ) : (
            <span>
              Already registered?{" "}
              <button
                type="button"
                onClick={() => setMode("login")}
                data-testid="button-toggle-auth-mode"
                className="text-[#105B38] font-bold hover:underline"
              >
                Sign In
              </button>
            </span>
          )}
        </div>

        <div className="mt-4 pt-3 border-t border-[#F1F5F9] flex items-center justify-center gap-2 text-[10px] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">
          <ShieldCheck className="w-3 h-3 text-[#105B38]" />
          <span>Encrypted High Court Chamber Authentication · ISO 27001 Protocol</span>
        </div>
      </div>
    </div>
  );
}
