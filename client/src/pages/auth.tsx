import { useState, useEffect, useCallback } from "react";
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, Phone } from "lucide-react";
import { SiGoogle } from "react-icons/si";
import { useLocation, Link, useSearch } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useDocumentHead } from "@/hooks/use-document-head";

type AuthMode = "login" | "register";

export default function AuthPage() {
  useDocumentHead({
    title: "Sign in or create account",
    description: "Sign in to Al Wakeelo to access AI-powered Pakistani legal research, judgment search, and drafting tools.",
    path: "/auth",
    index: true,
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
      const res = await fetch("/api/auth/google/status");
      return res.json();
    },
  });

  const handleGoogleStart = useCallback(() => {
    if (mode === "register" && !acceptedTerms) return;
    setGoogleLoading(true);
    const params = new URLSearchParams();
    params.set("mode", mode);
    params.set("termsVersion", TERMS_VERSION);
    const captchaToken = getCaptchaToken();
    if (captchaToken) {
      params.set("captchaToken", captchaToken);
    }
    window.location.assign(`/api/auth/google/start?${params.toString()}`);
  }, [acceptedTerms, mode]);

  const loginMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/login", { email, password, captchaToken: getCaptchaToken() });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      const searchParams = new URLSearchParams(window.location.search);
      const redirect = searchParams.get("redirect");
      if (redirect) {
        // Redirect to authorization flow with query parameters preserved
        window.location.href = `${redirect}?${searchParams.toString()}`;
      } else {
        navigate("/dashboard");
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
        acceptedTerms,
        termsVersion: TERMS_VERSION,
        captchaToken: getCaptchaToken(),
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      setMode("login");
      setPassword("");
      setPhoneNumber("");
      setVerificationHintEmail(String(data?.email || email || "").trim());
      toast({
        title: "Verify your email",
        description: "Account created. Please verify your email before signing in.",
      });
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
      const res = await apiRequest("POST", "/api/auth/resend-verification", { email: targetEmail, captchaToken: getCaptchaToken() });
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
          title: "Verification failed",
          description: "Could not verify email right now. Please try again.",
          variant: "destructive",
        });
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
    let description =
      googleErrorDetail ||
      "Something went wrong while signing in with Google. Please try again.";
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
    } else if (normalized === "db_unavailable") {
      description = "Database is unavailable right now. Please retry in a moment.";
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
    <div className="min-h-screen preview-bg flex items-center justify-center p-3 sm:p-6 relative overflow-hidden">
      <div className="absolute top-[-12%] left-[-12%] w-[44%] h-[44%] bg-primary/10 rounded-full blur-[130px]" />
      <div className="absolute bottom-[-14%] right-[-12%] w-[36%] h-[36%] bg-emerald-500/10 rounded-full blur-[120px]" />

      <div className="w-full max-w-md preview-elevated p-6 sm:p-10 rounded-[1.4rem] sm:rounded-[2.2rem] relative z-10 fade-in">
        <div className="text-center mb-8 pb-6 border-b border-[hsl(var(--preview-border))]">
          <div className="w-16 h-16 rounded-2xl mx-auto overflow-hidden border border-amber-400/40 mb-5 shadow-lg shadow-amber-500/30">
            <img src="/logo.svg" alt="Al Wakeelo logo" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-3xl font-bold preview-title uppercase tracking-tighter italic" style={{ fontFamily: "'Playfair Display', serif" }}>
            Al Wakeelo
          </h1>
          <p className="text-[10px] uppercase tracking-[0.35em] preview-muted font-black mt-2">
            {mode === "login" ? "Enter the Chambers" : "Join the Chambers"}
          </p>
          <p className="text-xs preview-subtitle mt-3">
            Secure legal workspace access for advocates and teams.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "register" && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="relative">
                  <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="First Name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    data-testid="input-first-name"
                    className="w-full bg-background/75 border border-[hsl(var(--preview-border))] text-foreground placeholder-slate-500 pl-11 pr-4 py-3.5 rounded-xl text-sm transition-all preview-focus"
                  />
                </div>
                <div className="relative">
                  <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Last Name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    data-testid="input-last-name"
                    className="w-full bg-background/75 border border-[hsl(var(--preview-border))] text-foreground placeholder-slate-500 pl-11 pr-4 py-3.5 rounded-xl text-sm transition-all preview-focus"
                  />
                </div>
              </div>
              <div className="relative animate-fadeIn">
                <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="tel"
                  placeholder="Phone Number"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  required
                  data-testid="input-phone-number"
                  className="w-full bg-background/75 border border-[hsl(var(--preview-border))] text-foreground placeholder-slate-500 pl-11 pr-4 py-3.5 rounded-xl text-sm transition-all preview-focus"
                />
              </div>
            </>
          )}

          <div className="relative">
            <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="email"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              data-testid="input-email"
              className="w-full bg-background/75 border border-[hsl(var(--preview-border))] text-foreground placeholder-slate-500 pl-11 pr-4 py-3.5 rounded-xl text-sm transition-all preview-focus"
            />
          </div>

          <div className="relative">
            <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type={showPassword ? "text" : "password"}
              placeholder={mode === "register" ? "Password (min 8 characters)" : "Password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={mode === "register" ? 8 : undefined}
              data-testid="input-password"
              className="w-full bg-background/75 border border-[hsl(var(--preview-border))] text-foreground placeholder-slate-500 pl-11 pr-12 py-3.5 rounded-xl text-sm transition-all preview-focus"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              data-testid="button-toggle-password"
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {mode === "register" && (
            <label className="flex items-start gap-2.5 rounded-xl border border-[hsl(var(--preview-border))] bg-background/55 px-3 py-2.5">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-amber-500"
                data-testid="input-accept-terms"
              />
              <span className="text-[11px] text-foreground leading-relaxed">
                I agree to the{" "}
                <Link href="/terms" className="text-primary hover:text-primary underline underline-offset-2" data-testid="link-terms-signup">
                  Terms and Conditions
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="text-primary hover:text-primary underline underline-offset-2" data-testid="link-privacy-signup">
                  Privacy Policy
                </Link>
                .
              </span>
            </label>
          )}

          {mode === "login" && (
            <div className="flex justify-end">
              <Link
                href="/forgot-password"
                data-testid="link-forgot-password"
                className="text-xs preview-muted hover:text-primary transition-colors"
              >
                Forgot Password?
              </Link>
            </div>
          )}

          <button
            type="submit"
            disabled={isPending || !isRegisterReady}
            data-testid="button-submit-auth"
            className="w-full bg-gradient-to-r from-primary to-primary text-primary-foreground font-black uppercase tracking-[0.22em] text-[11px] py-4 rounded-xl hover:from-primary hover:to-primary transition-all flex items-center justify-center gap-2 shadow-xl shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed mt-6"
          >
            {isPending ? (
              <div className="w-4 h-4 border-2 border-border border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                {mode === "login" ? "Sign In" : "Create Account"}
                <ArrowRight size={14} />
              </>
            )}
          </button>
        </form>

        {mode === "login" && verificationHintEmail && (
          <div className="mt-3 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wider font-black text-primary mb-1">Email Verification</p>
            <p className="text-[11px] text-foreground leading-relaxed mb-2">
              If you have not received your verification link, request a new one.
            </p>
            <button
              type="button"
              onClick={() => resendVerificationMutation.mutate()}
              disabled={resendVerificationMutation.isPending}
              className="text-[10px] font-black uppercase tracking-wider text-primary hover:text-foreground disabled:opacity-60"
              data-testid="button-resend-verification"
            >
              {resendVerificationMutation.isPending ? "Sending..." : "Resend Verification Email"}
            </button>
          </div>
        )}

        <>
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-[hsl(var(--preview-border))]" />
            <span className="text-[10px] preview-muted uppercase tracking-widest font-black">or continue with</span>
            <div className="flex-1 h-px bg-[hsl(var(--preview-border))]" />
          </div>

          {googleStatus?.available ? (
            googleLoading ? (
              <div className="w-full bg-background/75 border border-[hsl(var(--preview-border))] text-foreground font-semibold text-xs py-3.5 rounded-xl flex items-center justify-center gap-3">
                <div className="w-4 h-4 border-2 border-slate-300 dark:border-slate-500/30 border-t-transparent rounded-full animate-spin" />
                Signing in with Google...
              </div>
            ) : mode === "register" && !acceptedTerms ? (
              <button
                type="button"
                disabled
                data-testid="button-google-terms-required"
                className="w-full bg-background/70 border border-[hsl(var(--preview-border))] text-muted-foreground font-semibold text-xs py-3.5 rounded-xl flex items-center justify-center gap-2 cursor-not-allowed"
              >
                <SiGoogle size={14} />
                Agree to Terms to continue with Google
              </button>
            ) : (
              <button
                type="button"
                onClick={handleGoogleStart}
                data-testid="google-signin-button"
                className="mx-auto w-full max-w-[380px] bg-white dark:bg-[#131E2E] text-gray-900 font-semibold text-xs py-3.5 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-100 transition-colors border border-gray-200 dark:border-gray-500/20"
              >
                <SiGoogle size={14} />
                {mode === "register" ? "Continue with Google" : "Sign in with Google"}
              </button>
            )
          ) : (
            <button
              type="button"
              disabled
              data-testid="button-google-unavailable"
              className="mx-auto w-full max-w-[380px] bg-background/70 border border-[hsl(var(--preview-border))] text-muted-foreground font-semibold text-xs py-3.5 rounded-xl flex items-center justify-center gap-2 cursor-not-allowed"
            >
              <SiGoogle size={14} />
              Continue with Google
            </button>
          )}

          {!googleStatus?.available && (
            <p className="mt-2 text-[10px] text-muted-foreground text-center">
              Google sign-in is currently unavailable.
            </p>
          )}
        </>

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              const nextMode: AuthMode = mode === "login" ? "register" : "login";
              setMode(nextMode);
              setPassword("");
              setPhoneNumber("");
              setAcceptedTerms(false);
              if (typeof window !== "undefined") {
                const next = new URLSearchParams(window.location.search);
                next.set("mode", nextMode);
                const nextQuery = next.toString();
                const cleanUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash || ""}`;
                window.history.replaceState({}, document.title, cleanUrl);
              }
            }}
            data-testid="button-toggle-auth-mode"
            className="text-xs preview-muted hover:text-primary transition-colors"
          >
            {mode === "login"
              ? "Don't have an account? Create one"
              : "Already have an account? Sign in"}
          </button>
        </div>

        <p className="text-[9px] text-center text-muted-foreground uppercase tracking-widest font-black mt-5">
          Secured Authentication Protocol
        </p>
      </div>
    </div>
  );
}
