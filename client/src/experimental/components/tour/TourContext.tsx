import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface TourStep {
  id: string; // The data-tour attribute value to target
  title: string;
  content: string;
  placement?: "top" | "bottom" | "left" | "right" | "center";
  route?: string; // The path to navigate to when this step is active
}

interface TourContextType {
  isActive: boolean;
  currentStepIndex: number;
  steps: TourStep[];
  startTour: () => void;
  endTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  hasSeenTour: boolean;
}

const TourContext = createContext<TourContextType | undefined>(undefined);

export const useTour = () => {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error("useTour must be used within a TourProvider");
  }
  return context;
};

const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome", // Special ID for center screen
    title: "Welcome to Al Wakeelo",
    content: "Pakistan's AI-Powered Digital Lawyer & Case Law Platform. Let's take a quick 60-second tour of your new workspace.",
    placement: "center"
  },
  {
    id: "sidebar-nav",
    title: "Main Navigation",
    content: "Your main navigation hub. Switch between Research, Drafting, and Case Management modules here.",
    placement: "right"
  },
  {
    id: "command-palette",
    title: "Omni-Search",
    content: "Press Cmd+K anytime to instantly search cases, statutes, or jump to a module.",
    placement: "bottom"
  },
  {
    id: "dashboard",
    title: "Dashboard",
    content: "Your daily chamber snapshot — view recent activity, active cases, and quick actions.",
    placement: "right",
    route: "/preview/dashboard"
  },
  {
    id: "chat",
    title: "AI Legal Assistant",
    content: "Chat with our AI, strictly trained on Pakistani jurisprudence and precedents.",
    placement: "right",
    route: "/preview/chat"
  },
  {
    id: "judgments",
    title: "Case Law / Judgments",
    content: "Conduct deep, semantic searches across 180,000+ Supreme Court and High Court judgments.",
    placement: "right",
    route: "/preview/judgments"
  },
  {
    id: "judges",
    title: "Judges Directory",
    content: "Browse profiles, historical benches, and rulings of honorable judges across Pakistan.",
    placement: "right",
    route: "/preview/judges"
  },
  {
    id: "most-cited",
    title: "Most Cited Precedents",
    content: "Discover landmark judgments and analyze citation graphs for powerful case arguments.",
    placement: "right",
    route: "/preview/most-cited"
  },
  {
    id: "statutes",
    title: "Statutes & Act Browser",
    content: "Browse and search through 83,000+ federal and provincial statutory sections.",
    placement: "right",
    route: "/preview/statutes"
  },
  {
    id: "analyzer",
    title: "Document Analyzer",
    content: "Upload any contract or legal document for instant AI summarization and risk flagging.",
    placement: "right",
    route: "/preview/document-analyzer"
  },
  {
    id: "drafting",
    title: "AI Drafting Studio",
    content: "Auto-generate structured court petitions, legal notices, and standard contracts.",
    placement: "right",
    route: "/preview/drafting"
  },
  {
    id: "diary",
    title: "Case Diary",
    content: "Track hearing dates, manage client case files, and organize your digital causelist.",
    placement: "right",
    route: "/preview/diary"
  },
  {
    id: "vault",
    title: "Knowledge Vault",
    content: "Upload your chamber's private templates and documents for secure, isolated AI querying (RAG).",
    placement: "right",
    route: "/preview/knowledge-vault"
  },
  {
    id: "user-profile",
    title: "Profile & Settings",
    content: "Manage your premium subscription, organization invites, and app preferences here.",
    placement: "right",
    route: "/preview/settings"
  }
];

export const TourProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isActive, setIsActive] = useState(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("aw_tour_active") === "true";
    }
    return false;
  });
  
  const [currentStepIndex, setCurrentStepIndex] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("aw_tour_step");
      return saved ? parseInt(saved, 10) : 0;
    }
    return 0;
  });
  
  const [hasSeenTour, setHasSeenTour] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("aw_tour_completed") === "true";
    }
    return true; // Default true to avoid flash before effect
  });

  useEffect(() => {
    // Check if user has seen tour
    const seen = localStorage.getItem("aw_tour_completed");
    if (!seen) {
      setHasSeenTour(false);
      // Auto start tour if not seen and not already active
      if (sessionStorage.getItem("aw_tour_active") !== "true") {
        const timer = setTimeout(() => {
          setIsActive(true);
          sessionStorage.setItem("aw_tour_active", "true");
        }, 1000);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  useEffect(() => {
    sessionStorage.setItem("aw_tour_active", isActive.toString());
  }, [isActive]);

  useEffect(() => {
    sessionStorage.setItem("aw_tour_step", currentStepIndex.toString());
  }, [currentStepIndex]);

  const startTour = () => {
    setCurrentStepIndex(0);
    setIsActive(true);
    sessionStorage.setItem("aw_tour_active", "true");
    sessionStorage.setItem("aw_tour_step", "0");
  };

  const endTour = () => {
    setIsActive(false);
    setHasSeenTour(true);
    localStorage.setItem("aw_tour_completed", "true");
    sessionStorage.removeItem("aw_tour_active");
    sessionStorage.removeItem("aw_tour_step");
  };

  const nextStep = () => {
    if (currentStepIndex < TOUR_STEPS.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      endTour();
    }
  };

  const prevStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  return (
    <TourContext.Provider
      value={{
        isActive,
        currentStepIndex,
        steps: TOUR_STEPS,
        startTour,
        endTour,
        nextStep,
        prevStep,
        hasSeenTour,
      }}
    >
      {children}
    </TourContext.Provider>
  );
};
