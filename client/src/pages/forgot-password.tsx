import { useState } from "react";
import { Mail, ArrowLeft, CheckCircle } from "lucide-react";
import { Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const [serverMessage, setServerMessage] = useState<string>("");
  const [isGoogleAccountNotice, setIsGoogleAccountNotice] = useState(false);
  const { toast } = useToast();

  const forgotMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/forgot-password", {
        email,
        captchaToken: (window as any).__ALWAKEELO_CAPTCHA_TOKEN || undefined,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      setSubmitted(true);
      setServerMessage(String(data?.message || ""));
      setIsGoogleAccountNotice(data?.provider === "google" || data?.action === "use_google_signin");
      if (data.resetUrl) {
        setResetUrl(data.resetUrl);
      }
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
    forgotMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-3 sm:p-6 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-primary/3 rounded-full blur-[100px]" />

      <div className="w-full max-w-md bg-card border border-border p-6 sm:p-10 rounded-[1.4rem] sm:rounded-[3rem] shadow-2xl relative z-10 fade-in">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl mx-auto overflow-hidden border border-amber-400/40 mb-5 shadow-lg shadow-amber-500/20">
            <img src="/logo.svg" alt="Al Wakeelo logo" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-3xl font-bold text-foreground uppercase tracking-tighter italic" style={{ fontFamily: "'Playfair Display', serif" }}>
            Al Wakeelo
          </h1>
          <p className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground font-black mt-2">
            Password Recovery
          </p>
        </div>

        {submitted ? (
          <div className="text-center space-y-4">
            <div className="w-14 h-14 bg-emerald-500/10 rounded-full mx-auto flex items-center justify-center">
              <CheckCircle size={28} className="text-emerald-400" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">
              {resetUrl ? "Reset Link Ready" : isGoogleAccountNotice ? "Use Google Sign-In" : "Check Your Email"}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {resetUrl
                ? "Your password reset link has been generated. Click the button below to set a new password."
                : (serverMessage || "If an account with that email exists, we've sent a password reset link to your inbox. Please check your email.")}
            </p>

            {resetUrl && (
              <div className="mt-4">
                <a
                  href={resetUrl}
                  data-testid="link-reset-password"
                  className="inline-block w-full bg-primary text-foreground font-black uppercase tracking-widest text-xs py-4 rounded-2xl hover:bg-primary transition-all text-center shadow-xl shadow-primary/10"
                >
                  Reset Password Now
                </a>
                <p className="text-[10px] text-muted-foreground mt-3">This link expires in 1 hour</p>
              </div>
            )}

            <Link
              href="/auth"
              data-testid="link-back-to-login"
              className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors mt-4"
            >
              <ArrowLeft size={14} />
              Back to Sign In
            </Link>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground text-center mb-6 leading-relaxed">
              Enter the email address associated with your account and we'll generate a password reset link.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="email"
                  placeholder="Email Address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  data-testid="input-forgot-email"
                  className="w-full bg-background border border-border text-foreground placeholder-slate-500 pl-11 pr-4 py-3.5 rounded-2xl text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={forgotMutation.isPending}
                data-testid="button-submit-forgot"
                className="w-full bg-primary text-foreground font-black uppercase tracking-widest text-xs py-4 rounded-2xl hover:bg-primary transition-all flex items-center justify-center gap-2 shadow-xl shadow-primary/10 disabled:opacity-50 disabled:cursor-not-allowed mt-6"
              >
                {forgotMutation.isPending ? (
                  <div className="w-4 h-4 border-2 border-border border-t-transparent rounded-full animate-spin" />
                ) : (
                  "Send Reset Link"
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <Link
                href="/auth"
                data-testid="link-back-to-login-form"
                className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                <ArrowLeft size={14} />
                Back to Sign In
              </Link>
            </div>
          </>
        )}

        <p className="text-[9px] text-center text-muted-foreground uppercase tracking-widest font-black mt-5">
          Secured Authentication Protocol
        </p>
      </div>
    </div>
  );
}
