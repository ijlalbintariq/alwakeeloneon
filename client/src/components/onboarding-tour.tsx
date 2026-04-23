import { useState, useEffect } from "react";
import { X, ChevronRight, Gavel, Book, MessageSquare, FileText, Sparkles, CheckCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  moduleRoute?: string;
  tooltip?: string;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "welcome",
    title: "Welcome to Al Wakeelo",
    description: "Your AI-powered legal research and drafting assistant. Let's explore the key features that will supercharge your legal practice.",
    icon: <span className="text-4xl">⚖️</span>,
  },
  {
    id: "judgments",
    title: "Judgment Vault",
    description: "Search Pakistani case law with advanced filters. Find judgments by citation, keyword, court, and year. Save your favorite cases for quick reference.",
    icon: <Gavel className="w-8 h-8 text-amber-400" />,
    moduleRoute: "/judgments",
    tooltip: "Use filters to narrow down your search. Click 'Save' to bookmark important cases.",
  },
  {
    id: "chat",
    title: "Al Wakeelo Engine",
    description: "Consult your AI legal advisor. Ask about cases, statutes, legal procedures, and get instant analysis with cited sources.",
    icon: <MessageSquare className="w-8 h-8 text-blue-400" />,
    moduleRoute: "/al-wakeelo",
    tooltip: "Ask anything about Pakistani law. The AI will provide detailed answers with citations.",
  },
  {
    id: "statutes",
    title: "Statute Search",
    description: "Browse and search Pakistani legal codes, penal codes, and constitutional provisions. Quick access to statute text and details.",
    icon: <Book className="w-8 h-8 text-emerald-400" />,
    moduleRoute: "/statute-search",
    tooltip: "Search by statute name, section, or keyword to find the law you need.",
  },
  {
    id: "drafting",
    title: "Legal Drafting",
    description: "Generate contracts, agreements, and legal documents with AI assistance. Save drafts and iterate with intelligent suggestions.",
    icon: <FileText className="w-8 h-8 text-indigo-400" />,
    moduleRoute: "/legal-drafting",
    tooltip: "Upload a template or start from scratch. AI will help you draft faster.",
  },
  {
    id: "contracts",
    title: "Contract Drafting",
    description: "Create professional contracts with pre-built templates and AI-powered generation. Perfect for agreements, NDAs, and more.",
    icon: <Sparkles className="w-8 h-8 text-pink-400" />,
    moduleRoute: "/contract-drafting",
    tooltip: "Choose a template and customize it. Save your contract for future use.",
  },
  {
    id: "complete",
    title: "Ready to Begin!",
    description: "You're all set. Start exploring any module above, or go to the dashboard to manage your workspace.",
    icon: <span className="text-4xl">✨</span>,
  },
];

export function OnboardingTour() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [location, setLocation] = useLocation();
  const [currentStep, setCurrentStep] = useState(0);
  const [visitedSteps, setVisitedSteps] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user && !user.onboardingCompleted) {
      // Check if user is on a module page - if so, mark that step as visited
      const currentStepId = ONBOARDING_STEPS.find(s => s.moduleRoute === location)?.id;
      if (currentStepId) {
        setVisitedSteps(prev => new Set([...prev, currentStepId]));
      }
    }
  }, [user, location]);

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
    },
  });

  const handleNext = () => {
    const step = ONBOARDING_STEPS[currentStep];

    if (step.moduleRoute) {
      // Mark this step as visited
      setVisitedSteps(prev => new Set([...prev, step.id]));
      // Navigate to the module
      setLocation(step.moduleRoute);
    } else if (currentStep < ONBOARDING_STEPS.length - 1) {
      // Move to next step
      setCurrentStep(currentStep + 1);
    } else {
      // Complete onboarding
      completeOnboardingMutation.mutate();
    }
  };

  const handleSkip = () => {
    completeOnboardingMutation.mutate();
  };

  if (!user || user.onboardingCompleted) {
    return null;
  }

  const step = ONBOARDING_STEPS[currentStep];
  const isModuleStep = !!step.moduleRoute;
  const isCompleteStep = step.id === "complete";

  return (
    <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-amber-500/20 bg-gradient-to-br from-[#0f1722] to-[#0b1222] p-6 shadow-2xl">

        {/* Progress Bar */}
        <div className="mb-6 space-y-2">
          <div className="h-1 w-full rounded-full bg-slate-700">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-300"
              style={{ width: `${((currentStep + 1) / ONBOARDING_STEPS.length) * 100}%` }}
            />
          </div>
          <p className="text-xs text-slate-400">
            {currentStep + 1} of {ONBOARDING_STEPS.length}
          </p>
        </div>

        {/* Icon & Title */}
        <div className="mb-6 flex items-start justify-between">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/30">
            {step.icon}
          </div>
          <button
            onClick={handleSkip}
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
          {step.tooltip && (
            <div className="rounded-lg bg-blue-500/10 border border-blue-500/30 p-3 mt-4">
              <p className="text-xs text-blue-200">💡 {step.tooltip}</p>
            </div>
          )}
        </div>

        {/* Visited Steps Indicator */}
        {!isCompleteStep && (
          <div className="mb-6 space-y-2">
            <p className="text-xs text-slate-400 font-medium">Modules to explore:</p>
            <div className="space-y-1">
              {ONBOARDING_STEPS.filter(s => s.moduleRoute).map(s => (
                <div key={s.id} className="flex items-center gap-2 text-xs">
                  {visitedSteps.has(s.id) ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                      <span className="text-emerald-300">{s.title}</span>
                    </>
                  ) : (
                    <>
                      <div className="w-4 h-4 rounded-full border border-slate-500" />
                      <span className="text-slate-400">{s.title}</span>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleSkip}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-300 hover:text-white transition-colors"
          >
            {isCompleteStep ? "Done" : "Skip"}
          </button>
          <button
            onClick={handleNext}
            disabled={completeOnboardingMutation.isPending}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isModuleStep ? "Explore Module" : isCompleteStep ? "Get Started" : "Next"}
            {!isCompleteStep && <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
