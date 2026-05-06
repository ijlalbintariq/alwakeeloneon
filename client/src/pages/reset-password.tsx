import { useState } from "react";
import { Lock, Eye, EyeOff, ArrowRight, CheckCircle, AlertTriangle } from "lucide-react";
import { Link, useSearch } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function ResetPasswordPage() {
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const token = params.get("token");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [success, setSuccess] = useState(false);
  const { toast } = useToast();

  const resetMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/reset-password", {
        token,
        password,
        captchaToken: (window as any).__ALWAKEELO_CAPTCHA_TOKEN || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      setSuccess(true);
    },
    onError: (error: any) => {
      toast({
        title: "Reset failed",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure both passwords are the same.",
        variant: "destructive",
      });
      return;
    }
    if (password.length < 8) {
      toast({
        title: "Password too short",
        description: "Password must be at least 8 characters.",
        variant: "destructive",
      });
      return;
    }
    resetMutation.mutate();
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-3 sm:p-6 relative overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-primary/3 rounded-full blur-[100px]" />

        <div className="w-full max-w-md bg-card border border-border p-6 sm:p-10 rounded-[1.4rem] sm:rounded-[3rem] shadow-2xl relative z-10 fade-in">
          <div className="text-center space-y-4">
            <div className="w-14 h-14 bg-red-500/10 rounded-full mx-auto flex items-center justify-center">
              <AlertTriangle size={28} className="text-red-400" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Invalid Reset Link</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              This password reset link is missing or invalid. Please request a new one.
            </p>
            <Link
              href="/forgot-password"
              data-testid="link-request-new-reset"
              className="inline-block w-full bg-primary text-slate-950 font-black uppercase tracking-widest text-xs py-4 rounded-2xl hover:bg-primary transition-all text-center shadow-xl shadow-primary/10 mt-4"
            >
              Request New Link
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-3 sm:p-6 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-primary/3 rounded-full blur-[100px]" />

      <div className="w-full max-w-md bg-card border border-border p-6 sm:p-10 rounded-[1.4rem] sm:rounded-[3rem] shadow-2xl relative z-10 fade-in">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl mx-auto overflow-hidden border border-primary/40 mb-5 shadow-lg shadow-primary/20">
            <img src="/logo.svg" alt="Al Wakeelo logo" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-3xl font-bold text-foreground uppercase tracking-tighter italic" style={{ fontFamily: "'Playfair Display', serif" }}>
            Al Wakeelo
          </h1>
          <p className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground font-black mt-2">
            Set New Password
          </p>
        </div>

        {success ? (
          <div className="text-center space-y-4">
            <div className="w-14 h-14 bg-emerald-500/10 rounded-full mx-auto flex items-center justify-center">
              <CheckCircle size={28} className="text-emerald-400" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Password Reset Complete</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Your password has been updated successfully. You can now sign in with your new password.
            </p>
            <Link
              href="/auth"
              data-testid="link-go-to-login"
              className="inline-block w-full bg-primary text-slate-950 font-black uppercase tracking-widest text-xs py-4 rounded-2xl hover:bg-primary transition-all text-center shadow-xl shadow-primary/10 mt-4"
            >
              Sign In Now
            </Link>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground text-center mb-6 leading-relaxed">
              Enter your new password below. Make sure it's at least 8 characters long.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="New Password (min 8 characters)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  data-testid="input-new-password"
                  className="w-full bg-background border border-border text-foreground placeholder-slate-500 pl-11 pr-12 py-3.5 rounded-2xl text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  data-testid="button-toggle-new-password"
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              <div className="relative">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm New Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  data-testid="input-confirm-password"
                  className="w-full bg-background border border-border text-foreground placeholder-slate-500 pl-11 pr-12 py-3.5 rounded-2xl text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  data-testid="button-toggle-confirm-password"
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              <button
                type="submit"
                disabled={resetMutation.isPending}
                data-testid="button-submit-reset"
                className="w-full bg-primary text-slate-950 font-black uppercase tracking-widest text-xs py-4 rounded-2xl hover:bg-primary transition-all flex items-center justify-center gap-2 shadow-xl shadow-primary/10 disabled:opacity-50 disabled:cursor-not-allowed mt-6"
              >
                {resetMutation.isPending ? (
                  <div className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    Reset Password
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </form>
          </>
        )}

        <p className="text-[9px] text-center text-slate-600 uppercase tracking-widest font-black mt-5">
          Secured Authentication Protocol
        </p>
      </div>
    </div>
  );
}
