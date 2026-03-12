import { useState, useEffect, useRef, useCallback } from "react";
import { Eye, EyeOff, Mail, Lock, User, ArrowRight } from "lucide-react";
import { SiGoogle } from "react-icons/si";
import { useLocation, Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type AuthMode = "login" | "register";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          renderButton: (element: HTMLElement, config: any) => void;
          prompt: () => void;
        };
      };
    };
  }
}

export default function AuthPage() {
  const TERMS_VERSION = "2026-03";
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const googleButtonRef = useRef<HTMLDivElement>(null);

  const { data: googleStatus } = useQuery<{ available: boolean; clientId: string }>({
    queryKey: ["/api/auth/google/status"],
    queryFn: async () => {
      const res = await fetch("/api/auth/google/status");
      return res.json();
    },
  });

  const handleGoogleCredential = useCallback(async (response: any) => {
    if (mode === "register" && !acceptedTerms) {
      toast({
        title: "Terms acceptance required",
        description: "Please agree to the Terms and Conditions before creating an account.",
        variant: "destructive",
      });
      return;
    }

    setGoogleLoading(true);
    try {
      const res = await fetch("/api/auth/google/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          credential: response.credential,
          acceptedTerms: mode === "register" ? acceptedTerms : undefined,
          termsVersion: TERMS_VERSION,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: "Google sign-in failed",
          description: data.message || "Something went wrong",
          variant: "destructive",
        });
        return;
      }
      const signedInUser = data?.user || data;
      if (signedInUser?.id) {
        queryClient.setQueryData(["/api/auth/user"], signedInUser);
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      }
      navigate("/dashboard");
    } catch {
      toast({
        title: "Google sign-in failed",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setGoogleLoading(false);
    }
  }, [acceptedTerms, mode, queryClient, navigate, toast]);

  useEffect(() => {
    if (!googleStatus?.available || !googleStatus?.clientId) return;

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google && googleButtonRef.current) {
        // Prevent duplicate Google button renders when mode/state toggles.
        googleButtonRef.current.innerHTML = "";
        window.google.accounts.id.initialize({
          client_id: googleStatus.clientId,
          callback: handleGoogleCredential,
          auto_select: false,
        });
        window.google.accounts.id.renderButton(googleButtonRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: mode === "register" ? "signup_with" : "signin_with",
          shape: "pill",
          width: Math.min(360, Math.max(280, googleButtonRef.current.clientWidth || 320)),
          logo_alignment: "left",
        });
      }
    };
    document.head.appendChild(script);

    return () => {
      const existingScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
      if (existingScript) existingScript.remove();
    };
  }, [googleStatus, handleGoogleCredential, mode]);

  const loginMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/login", { email, password });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      navigate("/");
    },
    onError: (error: any) => {
      toast({
        title: "Login failed",
        description: error.message || "Invalid email or password",
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
        acceptedTerms,
        termsVersion: TERMS_VERSION,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      navigate("/");
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
      <div className="absolute top-[-12%] left-[-12%] w-[44%] h-[44%] bg-amber-500/10 rounded-full blur-[130px]" />
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="relative">
                <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="First Name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  data-testid="input-first-name"
                  className="w-full bg-[#0f172a]/75 border border-[hsl(var(--preview-border))] text-white placeholder-slate-500 pl-11 pr-4 py-3.5 rounded-xl text-sm transition-all preview-focus"
                />
              </div>
              <div className="relative">
                <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Last Name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  data-testid="input-last-name"
                  className="w-full bg-[#0f172a]/75 border border-[hsl(var(--preview-border))] text-white placeholder-slate-500 pl-11 pr-4 py-3.5 rounded-xl text-sm transition-all preview-focus"
                />
              </div>
            </div>
          )}

          <div className="relative">
            <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="email"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              data-testid="input-email"
              className="w-full bg-[#0f172a]/75 border border-[hsl(var(--preview-border))] text-white placeholder-slate-500 pl-11 pr-4 py-3.5 rounded-xl text-sm transition-all preview-focus"
            />
          </div>

          <div className="relative">
            <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type={showPassword ? "text" : "password"}
              placeholder={mode === "register" ? "Password (min 8 characters)" : "Password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={mode === "register" ? 8 : undefined}
              data-testid="input-password"
              className="w-full bg-[#0f172a]/75 border border-[hsl(var(--preview-border))] text-white placeholder-slate-500 pl-11 pr-12 py-3.5 rounded-xl text-sm transition-all preview-focus"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              data-testid="button-toggle-password"
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {mode === "register" && (
            <label className="flex items-start gap-2.5 rounded-xl border border-[hsl(var(--preview-border))] bg-[#0f172a]/55 px-3 py-2.5">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-amber-500"
                data-testid="input-accept-terms"
              />
              <span className="text-[11px] text-slate-300 leading-relaxed">
                I agree to the{" "}
                <Link href="/terms" className="text-amber-400 hover:text-amber-300 underline underline-offset-2" data-testid="link-terms-signup">
                  Terms and Conditions
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="text-amber-400 hover:text-amber-300 underline underline-offset-2" data-testid="link-privacy-signup">
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
                className="text-xs preview-muted hover:text-amber-400 transition-colors"
              >
                Forgot Password?
              </Link>
            </div>
          )}

          <button
            type="submit"
            disabled={isPending || !isRegisterReady}
            data-testid="button-submit-auth"
            className="w-full bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black uppercase tracking-[0.22em] text-[11px] py-4 rounded-xl hover:from-amber-300 hover:to-amber-400 transition-all flex items-center justify-center gap-2 shadow-xl shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed mt-6"
          >
            {isPending ? (
              <div className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                {mode === "login" ? "Sign In" : "Create Account"}
                <ArrowRight size={14} />
              </>
            )}
          </button>
        </form>

        <>
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-[hsl(var(--preview-border))]" />
            <span className="text-[10px] preview-muted uppercase tracking-widest font-black">or continue with</span>
            <div className="flex-1 h-px bg-[hsl(var(--preview-border))]" />
          </div>

          {googleStatus?.available ? (
            googleLoading ? (
              <div className="w-full bg-[#0f172a]/75 border border-[hsl(var(--preview-border))] text-slate-300 font-semibold text-xs py-3.5 rounded-xl flex items-center justify-center gap-3">
                <div className="w-4 h-4 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
                Signing in with Google...
              </div>
            ) : mode === "register" && !acceptedTerms ? (
              <button
                type="button"
                disabled
                data-testid="button-google-terms-required"
                className="w-full bg-[#0f172a]/70 border border-[hsl(var(--preview-border))] text-slate-400 font-semibold text-xs py-3.5 rounded-xl flex items-center justify-center gap-2 cursor-not-allowed"
              >
                <SiGoogle size={14} />
                Agree to Terms to continue with Google
              </button>
            ) : (
              <div className="mx-auto w-full max-w-[380px] rounded-xl border border-amber-400/25 bg-[#0f172a]/65 p-2 shadow-[0_0_24px_rgba(245,158,11,0.12)]">
                <div
                  ref={googleButtonRef}
                  className="flex min-h-[44px] items-center justify-center"
                  data-testid="google-signin-button"
                />
              </div>
            )
          ) : (
            <button
              type="button"
              disabled
              data-testid="button-google-unavailable"
              className="mx-auto w-full max-w-[380px] bg-[#0f172a]/70 border border-[hsl(var(--preview-border))] text-slate-400 font-semibold text-xs py-3.5 rounded-xl flex items-center justify-center gap-2 cursor-not-allowed"
            >
              <SiGoogle size={14} />
              Continue with Google
            </button>
          )}

          {!googleStatus?.available && (
            <p className="mt-2 text-[10px] text-slate-500 text-center">
              Google sign-in is currently unavailable.
            </p>
          )}
        </>

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setPassword("");
              setAcceptedTerms(false);
            }}
            data-testid="button-toggle-auth-mode"
            className="text-xs preview-muted hover:text-amber-400 transition-colors"
          >
            {mode === "login"
              ? "Don't have an account? Create one"
              : "Already have an account? Sign in"}
          </button>
        </div>

        <p className="text-[9px] text-center text-slate-600 uppercase tracking-widest font-black mt-5">
          Secured Authentication Protocol
        </p>
      </div>
    </div>
  );
}
