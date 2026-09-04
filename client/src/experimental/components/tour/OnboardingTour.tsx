import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTour } from "./TourContext";
import { X, ChevronRight, ChevronLeft, ShieldCheck } from "lucide-react";
import { useLocation } from "wouter";

export const OnboardingTour: React.FC = () => {
  const { isActive, currentStepIndex, steps, endTour, nextStep, prevStep } = useTour();
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [, setLocation] = useLocation();

  const step = steps[currentStepIndex];

  // Handle route navigation when step changes
  useEffect(() => {
    if (isActive && step?.route) {
      setLocation(step.route);
    }
  }, [isActive, step?.route, setLocation]);

  useEffect(() => {
    if (!isActive) return;

    const updatePosition = () => {
      if (step.id === "welcome") {
        setTargetRect(null);
        return;
      }

      // Small delay to allow wouter to navigate and render the new DOM elements
      setTimeout(() => {
        const el = document.querySelector(`[data-tour="${step.id}"]`);
        if (el) {
          setTargetRect(el.getBoundingClientRect());
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        } else {
          setTargetRect(null);
        }
      }, 50);
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isActive, step.id, currentStepIndex]); // Depend on index so it fires after route changes

  if (!isActive) return null;

  const isCenter = step.id === "welcome" || !targetRect;

  // Calculate Popover Position
  let popoverStyle: React.CSSProperties = {};
  if (!isCenter && targetRect) {
    const spacing = 16;
    switch (step.placement) {
      case "right":
        popoverStyle = {
          top: targetRect.top + targetRect.height / 2,
          left: targetRect.right + spacing,
          transform: "translateY(-50%)",
        };
        break;
      case "left":
        popoverStyle = {
          top: targetRect.top + targetRect.height / 2,
          left: targetRect.left - spacing,
          transform: "translate(-100%, -50%)",
        };
        break;
      case "bottom":
        popoverStyle = {
          top: targetRect.bottom + spacing,
          left: targetRect.left + targetRect.width / 2,
          transform: "translateX(-50%)",
        };
        break;
      case "top":
        popoverStyle = {
          top: targetRect.top - spacing,
          left: targetRect.left + targetRect.width / 2,
          transform: "translate(-50%, -100%)",
        };
        break;
      default:
        popoverStyle = {
          top: targetRect.top + targetRect.height / 2,
          left: targetRect.right + spacing,
          transform: "translateY(-50%)",
        };
    }
    
    const padding = 16;
    if (popoverStyle.left) {
       const leftNum = parseFloat(popoverStyle.left as string);
       if (leftNum + 320 > window.innerWidth) {
           popoverStyle.left = window.innerWidth - 320 - padding;
           popoverStyle.transform = popoverStyle.transform?.replace("translateX(-50%)", "");
       }
    }
  } else {
    popoverStyle = {
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
    };
  }

  return (
    <div className="fixed inset-0 z-[100] pointer-events-auto">
      {/* Dimmed Backdrop (No Blur) */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-[#0F172A]/50 transition-opacity"
        onClick={endTour}
      />

      {/* Target Highlight Cutout */}
      {!isCenter && targetRect && (
        <motion.div
          layout
          initial={false}
          animate={{
            top: targetRect.top - 4,
            left: targetRect.left - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
          }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="absolute z-[101] rounded-xl ring-2 ring-[#10B981] shadow-[0_0_0_9999px_rgba(15,23,42,0.5)] pointer-events-none bg-transparent"
          style={{ boxShadow: "0 0 0 9999px rgba(15,23,42,0.5)" }}
        />
      )}

      {/* Popover Card */}
      <AnimatePresence mode="wait">
        <div
          key={`wrapper-${step.id}`}
          className="absolute z-[102]"
          style={{
            ...popoverStyle,
            transition: "top 0.4s cubic-bezier(0.16, 1, 0.3, 1), left 0.4s cubic-bezier(0.16, 1, 0.3, 1), transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)"
          }}
        >
          <motion.div
            key={step.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className={`bg-white dark:bg-[#131E2E] rounded-2xl shadow-2xl border border-[#E2E8F0] dark:border-[#1E2D44] overflow-hidden ${
              step.id === "welcome" ? "w-[480px]" : "w-[320px]"
            }`}
          >
          {step.id === "welcome" ? (
            <div className="p-8 text-center flex flex-col items-center">
              <div className="w-16 h-16 bg-[#105B38]/10 text-[#105B38] rounded-2xl flex items-center justify-center mb-6 border border-[#105B38]/20 dark:border-[#105B38]/40 shadow-sm">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-extrabold text-[#0F172A] dark:text-[#F8FAFC] mb-3">{step.title}</h2>
              <p className="text-[15px] text-[#475569] leading-relaxed mb-8 max-w-[380px]">
                {step.content}
              </p>
              <div className="flex gap-3 w-full">
                <button
                  onClick={endTour}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] bg-[#F1F5F9] dark:bg-[#1E2D44] hover:bg-[#E2E8F0] hover:text-[#0F172A] dark:text-[#F8FAFC] transition-colors"
                >
                  Skip Tour
                </button>
                <button
                  onClick={nextStep}
                  className="flex-1 py-2.5 rounded-xl bg-[#105B38] hover:bg-[#0a4227] text-white text-sm font-semibold shadow-sm flex items-center justify-center gap-1.5 transition-colors"
                >
                  Start Tour <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="px-5 py-4 border-b border-[#E2E8F0] dark:border-[#1E2D44] bg-gradient-to-b from-[#F8FAFC] to-[#F1F5F9] flex items-start justify-between gap-4">
                <div>
                  <div className="text-[10px] font-bold text-[#105B38] uppercase tracking-wider mb-1">
                    Step {currentStepIndex + 1} of {steps.length}
                  </div>
                  <h3 className="text-[15px] font-bold text-[#0F172A] dark:text-[#F8FAFC] leading-tight">
                    {step.title}
                  </h3>
                </div>
                <button
                  onClick={endTour}
                  className="p-1 rounded-full text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:bg-[#E2E8F0] hover:text-[#0F172A] dark:text-[#F8FAFC] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="px-5 py-4 text-[13px] text-[#475569] leading-relaxed">
                {step.content}
              </div>

              {/* Footer Controls */}
              <div className="px-5 py-3 border-t border-[#E2E8F0] dark:border-[#1E2D44] bg-[#F8FAFC] dark:bg-[#0B131E] flex items-center justify-between">
                <button
                  onClick={endTour}
                  className="text-xs font-semibold text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC] transition-colors"
                >
                  Skip Tour
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={prevStep}
                    disabled={currentStepIndex === 0}
                    className="p-1.5 rounded-lg text-[#0F172A] dark:text-[#F8FAFC] border border-[#E2E8F0] dark:border-[#1E2D44] bg-white dark:bg-[#131E2E] hover:bg-[#F1F5F9] dark:bg-[#1E2D44] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={nextStep}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#105B38] hover:bg-[#0a4227] text-white text-xs font-semibold shadow-sm transition-colors"
                  >
                    {currentStepIndex === steps.length - 1 ? "Finish" : "Next"}
                    {currentStepIndex !== steps.length - 1 && <ChevronRight className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </>
          )}
          </motion.div>
        </div>
      </AnimatePresence>
    </div>
  );
};
