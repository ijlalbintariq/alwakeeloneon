import { useState, useEffect } from "react";
import { X, ChevronRight, Gavel, Book, MessageSquare, FileText, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface TourStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  highlight?: string;
  cta?: string;
}

const tourSteps: TourStep[] = [
  {
    id: "welcome",
    title: "Welcome to Al Wakeelo",
    description: "Your AI-powered legal research and drafting assistant. Let's explore the key features that will supercharge your legal practice.",
    icon: <span className="text-3xl">⚖️</span>,
    cta: "Let's Begin",
  },
  {
    id: "judgments",
    title: "Judgment Vault",
    description:
      "Search Pakistani case law with advanced filters. Find judgments by citation, keyword, court, and year. Save your favorite cases for quick reference.",
    icon: <Gavel className="w-8 h-8 text-amber-400" />,
    highlight: "judgments-link",
    cta: "Next",
  },
  {
    id: "chat",
    title: "Al Wakeelo Engine",
    description:
      "Consult your AI legal advisor. Ask about cases, statutes, legal procedures, and get instant analysis with cited sources.",
    icon: <MessageSquare className="w-8 h-8 text-blue-400" />,
    highlight: "chat-link",
    cta: "Next",
  },
  {
    id: "statutes",
    title: "Statute Search",
    description: "Browse and search Pakistani legal codes, penal codes, and constitutional provisions. Quick access to statute text and details.",
    icon: <Book className="w-8 h-8 text-emerald-400" />,
    highlight: "statute-link",
    cta: "Next",
  },
  {
    id: "drafting",
    title: "Legal Drafting",
    description:
      "Generate contracts, agreements, and legal documents with AI assistance. Save drafts and iterate with intelligent suggestions.",
    icon: <FileText className="w-8 h-8 text-indigo-400" />,
    highlight: "drafting-link",
    cta: "Next",
  },
  {
    id: "contracts",
    title: "Contract Drafting",
    description: "Create professional contracts with pre-built templates and AI-powered generation. Perfect for agreements, NDAs, and more.",
    icon: <Sparkles className="w-8 h-8 text-pink-400" />,
    highlight: "contracts-link",
    cta: "Explore",
  },
  {
    id: "complete",
    title: "Ready to Begin!",
    description:
      "You're all set. Start with Judgment search, chat with the AI, or dive into drafting. Your legal practice just got smarter.",
    icon: <span className="text-3xl">✨</span>,
    cta: "Go to Dashboard",
  },
];

export function OnboardingTour() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (user && !user.onboardingCompleted) {
      setIsVisible(true);
    }
  }, [user]);

  const completeOnboardingMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/auth/complete-onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error("Failed to complete onboarding");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setIsVisible(false);
    },
  });

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      completeOnboardingMutation.mutate();
    }
  };

  const handleSkip = () => {
    completeOnboardingMutation.mutate();
  };

  const handleClose = () => {
    completeOnboardingMutation.mutate();
  };

  if (!isVisible) return null;

  const step = tourSteps[currentStep];
  const progress = ((currentStep + 1) / tourSteps.length) * 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-amber-500/20 bg-gradient-to-br from-[#0f1722] to-[#0b1222] p-6 shadow-2xl md:max-w-lg">
        {/* Progress Bar */}
        <div className="mb-6 h-1 w-full rounded-full bg-slate-700">
          <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>

        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/30">{step.icon}</div>
          <button
            onClick={handleClose}
            className="p-1 text-slate-400 hover:text-white transition-colors"
            aria-label="Close tour"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="mb-8 space-y-3">
          <h2 className="text-2xl font-bold text-white">{step.title}</h2>
          <p className="text-sm text-slate-300 leading-relaxed">{step.description}</p>
        </div>

        {/* Step Counter */}
        <div className="mb-6 text-xs text-slate-400">
          Step {currentStep + 1} of {tourSteps.length}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleSkip}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-300 hover:text-white transition-colors"
          >
            {currentStep === 0 ? "Skip" : "Skip Tour"}
          </button>
          <button
            onClick={handleNext}
            disabled={completeOnboardingMutation.isPending}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {step.cta || "Next"}
            {currentStep < tourSteps.length - 1 && <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
