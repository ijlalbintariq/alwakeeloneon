import { useState } from "react";
import { Scale, Mail, ArrowLeft, CheckCircle } from "lucide-react";
import { Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const { toast } = useToast();

  const forgotMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/forgot-password", { email });
      return res.json();
    },
    onSuccess: (data: any) => {
      setSubmitted(true);
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
            Password Recovery
          </p>
        </div>

        {submitted ? (
          <div className="text-center space-y-4">
            <div className="w-14 h-14 bg-emerald-500/10 rounded-full mx-auto flex items-center justify-center">
              <CheckCircle size={28} className="text-emerald-400" />
            </div>
            <h2 className="text-lg font-semibold text-white">Check Your Email</h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              If an account with that email exists, we've generated a password reset link. Check your email or use the link below.
            </p>

            {resetUrl && (
              <div className="mt-4">
                <a
                  href={resetUrl}
                  data-testid="link-reset-password"
                  className="inline-block w-full bg-amber-500 text-slate-950 font-black uppercase tracking-widest text-xs py-4 rounded-2xl hover:bg-amber-400 transition-all text-center shadow-xl shadow-amber-500/10"
                >
                  Reset Password Now
                </a>
                <p className="text-[10px] text-slate-500 mt-3">This link expires in 1 hour</p>
              </div>
            )}

            <Link
              href="/auth"
              data-testid="link-back-to-login"
              className="inline-flex items-center gap-2 text-xs text-slate-500 hover:text-amber-400 transition-colors mt-4"
            >
              <ArrowLeft size={14} />
              Back to Sign In
            </Link>
          </div>
        ) : (
          <>
            <p className="text-sm text-slate-400 text-center mb-6 leading-relaxed">
              Enter the email address associated with your account and we'll generate a password reset link.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  placeholder="Email Address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  data-testid="input-forgot-email"
                  className="w-full bg-[#0f172a] border border-slate-700 text-white placeholder-slate-500 pl-11 pr-4 py-3.5 rounded-2xl text-sm focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={forgotMutation.isPending}
                data-testid="button-submit-forgot"
                className="w-full bg-amber-500 text-slate-950 font-black uppercase tracking-widest text-xs py-4 rounded-2xl hover:bg-amber-400 transition-all flex items-center justify-center gap-2 shadow-xl shadow-amber-500/10 disabled:opacity-50 disabled:cursor-not-allowed mt-6"
              >
                {forgotMutation.isPending ? (
                  <div className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                ) : (
                  "Send Reset Link"
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <Link
                href="/auth"
                data-testid="link-back-to-login-form"
                className="inline-flex items-center gap-2 text-xs text-slate-500 hover:text-amber-400 transition-colors"
              >
                <ArrowLeft size={14} />
                Back to Sign In
              </Link>
            </div>
          </>
        )}

        <p className="text-[9px] text-center text-slate-600 uppercase tracking-widest font-black mt-5">
          Secured Authentication Protocol
        </p>
      </div>
    </div>
  );
}
