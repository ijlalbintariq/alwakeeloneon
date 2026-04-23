import { useState, useEffect } from "react";
import { X, ChevronRight, ChevronLeft, Gavel, Book, MessageSquare, FileText, Sparkles, ArrowRight, LayoutDashboard } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface OnboardingStep {
  id: string;
  route: string;
  title: string;
  subtitle: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  features: string[];
  cta: string;
}

const STEPS: OnboardingStep[] = [
  {
    id: "judgments",
    route: "/judgments",
    title: "Judgment Vault",
    subtitle: "Search 200,000+ Pakistani Cases",
    description: "Find any judgment instantly. Search by keyword, citation (PLD 2022 SC 123), court, or year.",
    icon: <Gavel className="w-5 h-5" />,
    color: "amber",
    features: ["Keyword & citation search", "Filter by court & year", "Save cases to bookmarks", "AI-generated summaries"],
    cta: "Explore Judgments",
  },
  {
    id: "chat",
    route: "/al-wakeelo",
    title: "Al Wakeelo Engine",
    subtitle: "Your AI Legal Advisor",
    description: "Ask any legal question. Get instant answers with cited cases and statutes from Pakistani law.",
    icon: <MessageSquare className="w-5 h-5" />,
    color: "blue",
    features: ["Ask legal questions in plain Urdu/English", "Cited case law & statutes", "Research any legal topic", "Save consultation history"],
    cta: "Start Consulting",
  },
  {
    id: "statutes",
    route: "/statute-search",
    title: "Statute Search",
    subtitle: "Browse All Pakistani Laws",
    description: "Instantly search the PPC, CrPC, Constitution, and every major Pakistani statute.",
    icon: <Book className="w-5 h-5" />,
    color: "emerald",
    features: ["Search by section or keyword", "Full statute text", "Punishment & penalties", "Link to related judgments"],
    cta: "Browse Statutes",
  },
  {
    id: "drafting",
    route: "/legal-drafting",
    title: "Legal Drafting",
    subtitle: "AI-Powered Document Generation",
    description: "Draft applications, petitions, and legal documents in minutes with AI assistance.",
    icon: <FileText className="w-5 h-5" />,
    color: "indigo",
    features: ["Petitions & applications", "AI drafts based on your facts", "Edit and refine with AI", "Export as PDF or Word"],
    cta: "Start Drafting",
  },
  {
    id: "contracts",
    route: "/contract-drafting",
    title: "Contract Drafting",
    subtitle: "Professional Contract Generator",
    description: "Generate legally sound contracts and agreements tailored to Pakistani law.",
    icon: <Sparkles className="w-5 h-5" />,
    color: "pink",
    features: ["NDAs, MOUs, Service agreements", "Customizable clauses", "Urdu & English contracts", "Review for legal risks"],
    cta: "Create Contract",
  },
];

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; badge: string; button: string; dot: string }> = {
  amber:   { bg: "bg-amber-500/10",   border: "border-amber-500/30",   text: "text-amber-400",   badge: "bg-amber-500/20 text-amber-300",   button: "from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700", dot: "bg-amber-400" },
  blue:    { bg: "bg-blue-500/10",    border: "border-blue-500/30",    text: "text-blue-400",    badge: "bg-blue-500/20 text-blue-300",    button: "from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700",   dot: "bg-blue-400"  },
  emerald: { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-400", badge: "bg-emerald-500/20 text-emerald-300", button: "from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700", dot: "bg-emerald-400" },
  indigo:  { bg: "bg-indigo-500/10",  border: "border-indigo-500/30",  text: "text-indigo-400",  badge: "bg-indigo-500/20 text-indigo-300",  button: "from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700", dot: "bg-indigo-400" },
  pink:    { bg: "bg-pink-500/10",    border: "border-pink-500/30",    text: "text-pink-400",    badge: "bg-pink-500/20 text-pink-300",    button: "from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700",   dot: "bg-pink-400"  },
};

export function OnboardingTour() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [location, setLocation] = useLocation();
  const [stepIndex, setStepIndex] = useState(-1); // -1 = welcome screen
  const [dismissed, setDismissed] = useState(false);

  // When step changes navigate to that module
  useEffect(() => {
    if (stepIndex >= 0 && stepIndex < STEPS.length) {
      const target = STEPS[stepIndex].route;
      if (location !== target) setLocation(target);
    }
  }, [stepIndex]);

  const completeOnboardingMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/auth/complete-onboarding", { method: "POST", headers: { "Content-Type": "application/json" } });
      if (!res.ok) throw new Error("failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setLocation("/dashboard");
    },
  });

  const handleSkip = () => {
    setDismissed(true);
    completeOnboardingMutation.mutate();
  };

  const handleNext = () => {
    if (stepIndex < STEPS.length - 1) {
      setStepIndex(stepIndex + 1);
    } else {
      completeOnboardingMutation.mutate();
    }
  };

  const handleBack = () => {
    if (stepIndex > 0) {
      setStepIndex(stepIndex - 1);
    } else {
      setStepIndex(-1);
      setLocation("/dashboard");
    }
  };

  if (!user || user.onboardingCompleted || dismissed) return null;

  // ── Welcome Screen ─────────────────────────────────────────────────────────
  if (stepIndex === -1) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className="w-full max-w-lg mx-4 rounded-2xl border border-white/10 bg-[#0d1624] shadow-2xl overflow-hidden">
          {/* Top accent bar */}
          <div className="h-1 w-full bg-gradient-to-r from-amber-400 via-blue-400 to-emerald-400" />

          <div className="p-8">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl overflow-hidden mb-4 shadow-lg shadow-amber-500/20">
                <img src="/icon-192.png" alt="Al Wakeelo" className="w-full h-full object-cover" />
              </div>
              <h1 className="text-3xl font-bold text-white mb-2">Welcome to Al Wakeelo</h1>
              <p className="text-slate-400 text-sm">Pakistan's AI-powered legal intelligence platform</p>
            </div>

            {/* Module previews */}
            <div className="grid grid-cols-5 gap-2 mb-8">
              {STEPS.map((step) => {
                const c = COLOR_MAP[step.color];
                return (
                  <div key={step.id} className={`rounded-xl ${c.bg} ${c.border} border p-3 text-center`}>
                    <div className={`${c.text} flex justify-center mb-1`}>{step.icon}</div>
                    <p className={`text-[10px] font-medium ${c.text}`}>{step.title.split(" ")[0]}</p>
                  </div>
                );
              })}
            </div>

            <p className="text-center text-slate-300 text-sm mb-8">
              We'll take you through a quick tour of all 5 key modules.<br />
              <span className="text-slate-400">Takes about 2 minutes.</span>
            </p>

            {/* Actions */}
            <div className="flex gap-3">
              <button onClick={handleSkip} className="flex-1 py-3 text-sm text-slate-400 hover:text-white transition-colors">
                Skip tour
              </button>
              <button
                onClick={() => setStepIndex(0)}
                className="flex-[2] flex items-center justify-center gap-2 py-3 px-6 text-sm font-semibold text-white rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 transition-all"
              >
                Start Tour <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Module Tour Card ───────────────────────────────────────────────────────
  const step = STEPS[stepIndex];
  const c = COLOR_MAP[step.color];
  const isLast = stepIndex === STEPS.length - 1;

  return (
    <>
      {/* Thin top bar to show tour is active */}
      <div className="fixed top-0 left-0 right-0 z-50 h-0.5 bg-slate-800">
        <div
          className={`h-full ${c.dot} transition-all duration-500`}
          style={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }}
        />
      </div>

      {/* Floating card – bottom center, leaves app visible */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm mx-4">
        <div className={`rounded-2xl border ${c.border} bg-[#0d1624]/95 backdrop-blur-md shadow-2xl overflow-hidden`}>

          {/* Color accent top */}
          <div className={`h-0.5 w-full bg-gradient-to-r ${c.button.split(" ")[0].replace("from-", "bg-")}`} />

          <div className="p-5">
            {/* Step header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${c.bg} ${c.border} border ${c.text}`}>
                  {step.icon}
                </div>
                <div>
                  <p className={`text-xs font-semibold ${c.text}`}>{step.subtitle}</p>
                  <h3 className="text-white font-bold text-sm">{step.title}</h3>
                </div>
              </div>
              <button onClick={handleSkip} className="text-slate-500 hover:text-white transition-colors p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Description */}
            <p className="text-slate-300 text-xs leading-relaxed mb-4">{step.description}</p>

            {/* Features list */}
            <div className="grid grid-cols-2 gap-1.5 mb-5">
              {step.features.map((f, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${c.dot} flex-shrink-0`} />
                  <span className="text-xs text-slate-400">{f}</span>
                </div>
              ))}
            </div>

            {/* Progress dots */}
            <div className="flex items-center justify-between">
              <div className="flex gap-1.5">
                {STEPS.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setStepIndex(i)}
                    className={`h-1.5 rounded-full transition-all ${i === stepIndex ? `w-5 ${c.dot}` : "w-1.5 bg-slate-600"}`}
                  />
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleBack}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-white/5"
                >
                  <ChevronLeft className="w-3 h-3" /> Back
                </button>
                <button
                  onClick={handleNext}
                  disabled={completeOnboardingMutation.isPending}
                  className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white rounded-lg bg-gradient-to-r ${c.button} transition-all disabled:opacity-50`}
                >
                  {isLast ? "Finish" : step.cta}
                  {!isLast && <ChevronRight className="w-3 h-3" />}
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
