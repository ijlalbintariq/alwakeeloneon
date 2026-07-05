import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { Brain, Sparkles, Scale, PenTool, BookMarked, ShieldCheck, ChevronLeft, ChevronRight, X, MessageSquare, FolderOpen, BookOpen } from "lucide-react";

type TutorialStep = {
  id: string;
  title: string;
  icon: React.ReactNode;
  description: string;
  borderColor: string;
  bgGradient: string;
};

const LEGAL_DRAFTING_STEPS: TutorialStep[] = [
  {
    id: "ai-engine",
    title: "Drafting Chat",
    icon: <MessageSquare size={24} style={{ color: "#60a5fa" }} />,
    description: "The AI command center below the editor. Type natural language instructions — \"Draft a Writ Petition under Article 199\" — and the AI generates a full court-ready document. Attach case files for context-aware drafting.",
    borderColor: "#3b82f6",
    bgGradient: "linear-gradient(135deg, rgba(59,130,246,0.15), rgba(30,64,175,0.15))",
  },
  {
    id: "editor",
    title: "Tiptap Legal Editor",
    icon: <PenTool size={24} style={{ color: "#34d399" }} />,
    description: "A rich-text workspace with legal formatting. Bold, italic, lists, tables, headings, and page breaks. Edit AI-generated drafts, select text for targeted revisions, then export as PDF or Word.",
    borderColor: "#10b981",
    bgGradient: "linear-gradient(135deg, rgba(16,185,129,0.15), rgba(6,95,70,0.15))",
  },
  {
    id: "workspace",
    title: "Workspace Panel",
    icon: <FolderOpen size={24} style={{ color: "#fbbf24" }} />,
    description: "Your drafts hub. Browse saved drafts, load pre-built templates (Writ Petitions, Bail Applications, NDAs, Power of Attorney), collaborate via shared links, or access the case document archive.",
    borderColor: "#f59e0b",
    bgGradient: "linear-gradient(135deg, rgba(245,158,11,0.15), rgba(146,64,14,0.15))",
  },
  {
    id: "style-memory",
    title: "Style Memory",
    icon: <Brain size={24} style={{ color: "#c084fc" }} />,
    description: "Upload your past documents and the AI learns your firm's writing style — terminology, clause phrasing, and formatting. Future drafts automatically match your signature legal voice.",
    borderColor: "#a855f7",
    bgGradient: "linear-gradient(135deg, rgba(168,85,247,0.15), rgba(88,28,135,0.15))",
  },
  {
    id: "ai-panel",
    title: "AI Assistant & History",
    icon: <Scale size={24} style={{ color: "#fb7185" }} />,
    description: "The right panel has two tabs: AI Assistant shows controls, style memory status, and AI-recommended draft changes. Version History lets you restore previous versions of your document.",
    borderColor: "#f43f5e",
    bgGradient: "linear-gradient(135deg, rgba(244,63,94,0.15), rgba(136,19,55,0.15))",
  },
  {
    id: "references",
    title: "Verified References",
    icon: <BookOpen size={24} style={{ color: "#22d3ee" }} />,
    description: "Every statute section and case law citation in your draft is automatically verified against the knowledge base. Click any reference to view the full source document. Unverified citations are flagged.",
    borderColor: "#06b6d4",
    bgGradient: "linear-gradient(135deg, rgba(6,182,212,0.15), rgba(21,94,117,0.15))",
  },
];

const CONTRACT_DRAFTING_STEPS: TutorialStep[] = [
  {
    id: "ai-engine",
    title: "AI Workspace Controller",
    icon: <Sparkles size={24} style={{ color: "#60a5fa" }} />,
    description: "The redesigned workspace panel houses all drafting settings. Toggle between three clean tabs: Setup, Clauses, and Review to configure and audit your contract.",
    borderColor: "#3b82f6",
    bgGradient: "linear-gradient(135deg, rgba(59,130,246,0.15), rgba(30,64,175,0.15))",
  },
  {
    id: "setup",
    title: "Contract Setup & Style",
    icon: <PenTool size={24} style={{ color: "#34d399" }} />,
    description: "Specify Title, Contract Type, and Direct Drafting Instructions. Toggle Advanced Parameters for Parties and Jurisdiction, and click 'Style' to load personalized tone presets.",
    borderColor: "#10b981",
    bgGradient: "linear-gradient(135deg, rgba(16,185,129,0.15), rgba(6,95,70,0.15))",
  },
  {
    id: "clause-library",
    title: "Clause Library",
    icon: <BookMarked size={24} style={{ color: "#fbbf24" }} />,
    description: "Search and insert standard legal clauses instantly from our library. Can't find the clause you want? Type custom guidelines in the Clause Builder plan to draft it.",
    borderColor: "#f59e0b",
    bgGradient: "linear-gradient(135deg, rgba(245,158,11,0.15), rgba(146,64,14,0.15))",
  },
  {
    id: "compliance",
    title: "AI Compliance Scan",
    icon: <ShieldCheck size={24} style={{ color: "#22d3ee" }} />,
    description: "Audit your contract against Pakistani laws (like the Contract Act 1872) to scan for legal risks, verify mandatory provisions, and resolve compliance vulnerabilities.",
    borderColor: "#06b6d4",
    bgGradient: "linear-gradient(135deg, rgba(6,182,212,0.15), rgba(21,94,117,0.15))",
  },
  {
    id: "redlines",
    title: "Counterparty Redlines",
    icon: <Scale size={24} style={{ color: "#fb7185" }} />,
    description: "Simulate an opposing counsel's audit review. Check for loopholes or risk clauses, and directly accept or reject proposed changes right from the list.",
    borderColor: "#f43f5e",
    bgGradient: "linear-gradient(135deg, rgba(244,63,94,0.15), rgba(136,19,55,0.15))",
  },
  {
    id: "editor",
    title: "Tiptap Legal Editor",
    icon: <BookOpen size={24} style={{ color: "#c084fc" }} />,
    description: "A rich-text workspace where you edit draft revisions. Highlight any text for targeted refinements, and download output as Word DOCX, TXT, or PDF.",
    borderColor: "#a855f7",
    bgGradient: "linear-gradient(135deg, rgba(168,85,247,0.15), rgba(88,28,135,0.15))",
  },
];

type CardPos = { top: number; left: number; placement: "right" | "left" | "bottom" };

function getCardPosition(rect: DOMRect, cardW: number, cardH: number): CardPos {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const gap = 16;
  // Align card to top-third of target so it sits higher
  let verticalAnchor = rect.top + rect.height / 3 - cardH / 2 - 30;
  if (rect.height > 400) {
    verticalAnchor -= 60; // Lift card higher for tall elements like the legal editor
  }

  // Try right
  if (rect.right + gap + cardW < vw) {
    return {
      top: Math.max(12, Math.min(verticalAnchor, vh - cardH - 12)),
      left: rect.right + gap,
      placement: "right",
    };
  }
  // Try left
  if (rect.left - gap - cardW > 0) {
    return {
      top: Math.max(12, Math.min(verticalAnchor, vh - cardH - 12)),
      left: rect.left - gap - cardW,
      placement: "left",
    };
  }
  // Bottom — try above first if there's space
  if (rect.top - gap - cardH > 12) {
    return {
      top: rect.top - gap - cardH,
      left: Math.max(12, Math.min(rect.left + rect.width / 2 - cardW / 2, vw - cardW - 12)),
      placement: "bottom",
    };
  }
  return {
    top: Math.min(rect.bottom + gap, vh - cardH - 12),
    left: Math.max(12, Math.min(rect.left + rect.width / 2 - cardW / 2, vw - cardW - 12)),
    placement: "bottom",
  };
}

export function TutorialCards({
  open,
  onOpenChange,
  moduleName,
  onStepChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  moduleName: string;
  onStepChange?: (stepId: string) => void;
}) {
  const steps = moduleName === "Legal Drafting" ? LEGAL_DRAFTING_STEPS : CONTRACT_DRAFTING_STEPS;
  const [current, setCurrent] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const step = steps[current];

  // Find the VISIBLE target element for the current step
  const updateTargetRect = useCallback(() => {
    if (!open) return;
    const candidates = document.querySelectorAll(`[data-tutorial="${step.id}"]`);
    let el: Element | null = null;
    // Pick the first visible candidate (not display:none or in a hidden parent)
    for (const candidate of candidates) {
      const rect = candidate.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        el = candidate;
        break;
      }
    }
    if (el) {
      // Scroll element into view first, then measure after scroll settles
      el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
      setTimeout(() => {
        setTargetRect(el!.getBoundingClientRect());
      }, 350);
    } else {
      setTargetRect(null);
    }
  }, [open, step.id]);

  useEffect(() => {
    if (open) {
      setCurrent(0);
    }
  }, [open]);

  useEffect(() => {
    if (open && onStepChange && step) {
      onStepChange(step.id);
    }
  }, [open, step?.id, onStepChange]);

  useEffect(() => {
    // Settle tab switch transition before measuring target element
    const timer = setTimeout(() => {
      updateTargetRect();
    }, 200);

    window.addEventListener("resize", updateTargetRect);
    window.addEventListener("scroll", updateTargetRect, true);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", updateTargetRect);
      window.removeEventListener("scroll", updateTargetRect, true);
    };
  }, [updateTargetRect, step?.id]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onOpenChange]);

  const goNext = useCallback(() => {
    if (current < steps.length - 1) setCurrent(c => c + 1);
    else onOpenChange(false);
  }, [current, onOpenChange]);

  const goPrev = useCallback(() => {
    setCurrent(c => Math.max(c - 1, 0));
  }, []);

  if (!open) return null;

  const CARD_W = 340;
  const CARD_H = 260;
  const hasTarget = targetRect !== null;
  const pos = hasTarget ? getCardPosition(targetRect!, CARD_W, CARD_H) : null;

  // Spotlight cutout values
  const spotPad = 8;
  const spotRadius = 12;

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 99999, pointerEvents: "none" }}>
      {/* Overlay with spotlight cutout */}
      <svg
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "auto" }}
        onClick={() => onOpenChange(false)}
      >
        <defs>
          <mask id="tutorial-spotlight-mask">
            <rect width="100%" height="100%" fill="white" />
            {hasTarget && (
              <rect
                x={targetRect!.left - spotPad}
                y={targetRect!.top - spotPad}
                width={targetRect!.width + spotPad * 2}
                height={targetRect!.height + spotPad * 2}
                rx={spotRadius}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.65)"
          mask="url(#tutorial-spotlight-mask)"
        />
      </svg>

      {/* Highlight border around target */}
      {hasTarget && (
        <div
          style={{
            position: "absolute",
            top: targetRect!.top - spotPad,
            left: targetRect!.left - spotPad,
            width: targetRect!.width + spotPad * 2,
            height: targetRect!.height + spotPad * 2,
            borderRadius: spotRadius,
            border: `2px solid ${step.borderColor}`,
            boxShadow: `0 0 20px ${step.borderColor}44, inset 0 0 20px ${step.borderColor}11`,
            pointerEvents: "none",
            transition: "all 300ms ease",
          }}
        />
      )}

      {/* Popup card */}
      <div
        ref={cardRef}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          top: hasTarget ? pos!.top : "50%",
          left: hasTarget ? pos!.left : "50%",
          ...(hasTarget ? {} : { transform: "translate(-50%, -50%)" }),
          width: CARD_W,
          borderRadius: 20,
          background: "#0a0f1a",
          border: `1px solid ${step.borderColor}55`,
          boxShadow: `0 24px 48px -12px rgba(0,0,0,0.7), 0 0 24px ${step.borderColor}22`,
          pointerEvents: "auto",
          animation: "tutorial-card-pop 250ms ease-out",
          transition: "top 300ms ease, left 300ms ease",
          overflow: "hidden",
        }}
      >
        {/* Close */}
        <button
          onClick={() => onOpenChange(false)}
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            zIndex: 10,
            width: 26,
            height: 26,
            borderRadius: 8,
            border: "1px solid #334155",
            background: "transparent",
            color: "#94a3b8",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <X size={12} />
        </button>

        {/* Step counter */}
        <div style={{ padding: "14px 16px 0", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 10, color: step.borderColor, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>
            {moduleName}
          </span>
          <span style={{ fontSize: 10, color: "#475569" }}>·</span>
          <span style={{ fontSize: 10, color: "#64748b", fontWeight: 600 }}>
            {current + 1} / {steps.length}
          </span>
        </div>

        {/* Card content */}
        <div style={{ padding: "12px 16px 16px" }}>
          <div
            style={{
              padding: 16,
              borderRadius: 14,
              background: step.bgGradient,
              border: `1px solid ${step.borderColor}33`,
              marginBottom: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: "rgba(15,23,42,0.8)",
                  border: `1px solid ${step.borderColor}44`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {step.icon}
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 700, color: "#fff", margin: 0, letterSpacing: "0.01em" }}>
                {step.title}
              </h3>
            </div>
            <p style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.65, margin: 0 }}>
              {step.description}
            </p>
          </div>

          {/* Dots */}
          <div style={{ display: "flex", justifyContent: "center", gap: 5, marginBottom: 12 }}>
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                style={{
                  width: current === i ? 18 : 7,
                  height: 7,
                  borderRadius: 4,
                  border: "none",
                  background: current === i ? step.borderColor : "#334155",
                  cursor: "pointer",
                  transition: "all 200ms ease",
                }}
              />
            ))}
          </div>

          {/* Nav buttons */}
          <div style={{ display: "flex", gap: 8 }}>
            {current > 0 && (
              <button
                onClick={goPrev}
                style={{
                  flex: 1,
                  padding: "8px 0",
                  borderRadius: 10,
                  border: "1px solid #334155",
                  background: "transparent",
                  color: "#94a3b8",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                }}
              >
                <ChevronLeft size={14} /> Back
              </button>
            )}
            <button
              onClick={goNext}
              style={{
                flex: current > 0 ? 2 : 1,
                padding: "8px 0",
                borderRadius: 10,
                border: "none",
                background: `linear-gradient(135deg, ${step.borderColor}, ${step.borderColor}cc)`,
                color: "#000",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
              }}
            >
              {current === steps.length - 1 ? "Get Started" : "Next"} <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes tutorial-card-pop {
          from { opacity: 0; transform: scale(0.95) translateY(6px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>,
    document.body
  );
}
