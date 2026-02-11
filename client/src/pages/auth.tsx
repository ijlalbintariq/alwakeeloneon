import { useState, useEffect } from "react";
import { Scale, Eye, EyeOff, Mail, Lock, User, ArrowRight } from "lucide-react";
import { SiGoogle } from "react-icons/si";
import { useLocation, Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type AuthMode = "login" | "register";

export default function AuthPage() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: googleStatus } = useQuery<{ available: boolean }>({
    queryKey: ["/api/auth/google/status"],
    queryFn: async () => {
      const res = await fetch("/api/auth/google/status");
      return res.json();
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    if (error === "email_account_exists") {
      toast({
        title: "Account exists",
        description: "An account with this email already exists. Please sign in with your email and password.",
        variant: "destructive",
      });
    } else if (error === "google_auth_failed") {
      toast({
        title: "Google sign-in failed",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    }
    if (error) {
      window.history.replaceState({}, "", "/auth");
    }
  }, [toast]);

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
      const res = await apiRequest("POST", "/api/auth/register", { email, password, firstName, lastName });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      navigate("/");
    },
    onError: (error: any) => {
      toast({
        title: "Registration failed",
        description: error.message || "Could not create account",
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

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-amber-500/5 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-amber-500/3 rounded-full blur-[100px]" />

      <div className="w-full max-w-md bg-[#1e293b] border border-slate-800 p-10 rounded-[3rem] shadow-2xl relative z-10 fade-in">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl mx-auto flex items-center justify-center mb-5 shadow-lg shadow-amber-500/20">
            <Scale size={32} className="text-slate-900" />
          </div>
          <h1 className="text-3xl font-bold text-white uppercase tracking-tighter italic" style={{ fontFamily: "'Playfair Display', serif" }}>
            Al Wakeelo
          </h1>
          <p className="text-[10px] uppercase tracking-[0.4em] text-slate-500 font-black mt-2">
            {mode === "login" ? "Enter the Chambers" : "Join the Chambers"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "register" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="First Name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  data-testid="input-first-name"
                  className="w-full bg-[#0f172a] border border-slate-700 text-white placeholder-slate-500 pl-11 pr-4 py-3.5 rounded-2xl text-sm focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 transition-all"
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
                  className="w-full bg-[#0f172a] border border-slate-700 text-white placeholder-slate-500 pl-11 pr-4 py-3.5 rounded-2xl text-sm focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 transition-all"
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
              className="w-full bg-[#0f172a] border border-slate-700 text-white placeholder-slate-500 pl-11 pr-4 py-3.5 rounded-2xl text-sm focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 transition-all"
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
              className="w-full bg-[#0f172a] border border-slate-700 text-white placeholder-slate-500 pl-11 pr-12 py-3.5 rounded-2xl text-sm focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 transition-all"
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

          {mode === "login" && (
            <div className="flex justify-end">
              <Link
                href="/forgot-password"
                data-testid="link-forgot-password"
                className="text-xs text-slate-500 hover:text-amber-400 transition-colors"
              >
                Forgot Password?
              </Link>
            </div>
          )}

          <button
            type="submit"
            disabled={isPending}
            data-testid="button-submit-auth"
            className="w-full bg-amber-500 text-slate-950 font-black uppercase tracking-widest text-xs py-4 rounded-2xl hover:bg-amber-400 transition-all flex items-center justify-center gap-2 shadow-xl shadow-amber-500/10 disabled:opacity-50 disabled:cursor-not-allowed mt-6"
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

        {googleStatus?.available && (
          <>
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-slate-700" />
              <span className="text-[10px] text-slate-500 uppercase tracking-widest font-black">or</span>
              <div className="flex-1 h-px bg-slate-700" />
            </div>

            <a
              href="/api/auth/google"
              data-testid="button-google-login"
              className="w-full bg-[#0f172a] border border-slate-700 text-slate-300 font-semibold text-xs py-3.5 rounded-2xl hover:bg-slate-800 hover:border-slate-600 transition-all flex items-center justify-center gap-3"
            >
              <SiGoogle size={16} />
              Continue with Google
            </a>
          </>
        )}

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setPassword("");
            }}
            data-testid="button-toggle-auth-mode"
            className="text-xs text-slate-500 hover:text-amber-400 transition-colors"
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
