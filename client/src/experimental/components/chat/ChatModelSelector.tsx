import React, { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  Zap,
  Bot,
  Crown,
  ChevronDown,
  Check,
  ShieldAlert,
  Info,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ModelTier = "standard" | "turbo" | "apex";

export interface ModelOption {
  id: ModelTier;
  label: string;
  engine: string;
  description: string;
  badge?: string;
  badgeColor?: string;
  icon: React.ElementType;
}

interface ChatModelSelectorProps {
  selectedTier: ModelTier;
  onSelectTier: (tier: ModelTier) => void;
  canUseTurbo?: boolean;
  canUseApex?: boolean;
  onUpgradeClick?: (tier: ModelTier) => void;
}

export const ChatModelSelector: React.FC<ChatModelSelectorProps> = ({
  selectedTier,
  onSelectTier,
  canUseTurbo = true,
  canUseApex = true,
  onUpgradeClick,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const modelOptions: ModelOption[] = [
    {
      id: "standard",
      label: "Standard",
      engine: "Standard Intelligence",
      description: "Low-latency statutory lookups, drafting, and fundamental Pakistani legal analysis.",
      badge: "Fast & Reliable",
      badgeColor: "bg-[#F5F4F2] text-[#666666] border-[#E5E4E2]",
      icon: Bot,
    },
    {
      id: "turbo",
      label: "Turbo",
      engine: "Turbo Reasoning",
      description: "Multi-step reasoning for intricate procedural flows and complex legal deductions.",
      badge: "Deep Reasoning",
      badgeColor: "bg-[#F5F4F2] text-[#666666] border-[#E5E4E2]",
      icon: Zap,
    },
    {
      id: "apex",
      label: "Apex",
      engine: "Apex Legal Intelligence",
      description: "High Court & Supreme Court court-ready drafting, constitutional writs, and ratio extraction.",
      badge: "Chambers Apex",
      badgeColor: "bg-[#F5F4F2] text-[#666666] border-[#E5E4E2]",
      icon: Crown,
    },
  ];

  const currentOption = modelOptions.find((m) => m.id === selectedTier) || modelOptions[0];
  const CurrentIcon = currentOption.icon;

  const isLocked = (tier: ModelTier) => {
    if (tier === "turbo" && !canUseTurbo) return true;
    if (tier === "apex" && !canUseApex) return true;
    return false;
  };

  const handleSelect = (tier: ModelTier) => {
    if (isLocked(tier)) {
      onUpgradeClick?.(tier);
      return;
    }
    onSelectTier(tier);
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Pill Toggle Selector */}
      <div className="flex items-center gap-1 p-0.5 rounded-xl bg-[#F5F4F2] border border-[#E5E4E2]">
        {modelOptions.map((opt) => {
          const isSelected = selectedTier === opt.id;
          const locked = isLocked(opt.id);
          const Icon = opt.icon;
          return (
            <button
              key={opt.id}
              onClick={() => handleSelect(opt.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all relative",
                isSelected
                  ? "bg-white text-[#1A1A1A] font-semibold border border-[#E5E4E2] shadow-sm"
                  : "text-[#666666] hover:text-[#1A1A1A] hover:bg-white/50",
                locked && "opacity-75"
              )}
            >
              <Icon className={cn("w-3.5 h-3.5", isSelected ? "text-[#1A1A1A]" : "text-[#666666]")} />
              <span>{opt.label}</span>
              {locked && (
                <Lock className="w-3 h-3 text-[#105B38] ml-0.5" />
              )}
            </button>
          );
        })}

        {/* Info Details Trigger */}
        <button
          onClick={() => setDropdownOpen((prev) => !prev)}
          className={cn(
            "p-1.5 rounded-lg text-[#666666] hover:text-[#1A1A1A] hover:bg-white/50 transition-colors ml-0.5",
            dropdownOpen && "bg-white text-[#1A1A1A] shadow-sm"
          )}
          title="View Model Details"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Dropdown Menu */}
      {dropdownOpen && (
        <div className="absolute right-0 mt-2 w-80 rounded-xl bg-white border border-[#E5E4E2] p-2 shadow-lg z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-3 py-2 border-b border-[#E5E4E2] mb-1">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#666666] font-semibold">
              Intelligence Tier
            </span>
            <p className="text-xs text-[#666666] font-medium mt-0.5">
              Select model mode for your legal query
            </p>
          </div>

          <div className="space-y-1">
            {modelOptions.map((opt) => {
              const isSelected = selectedTier === opt.id;
              const locked = isLocked(opt.id);
              const Icon = opt.icon;
              return (
                <div
                  key={opt.id}
                  onClick={() => {
                    handleSelect(opt.id);
                    if (!locked) {
                      setDropdownOpen(false);
                    }
                  }}
                  className={cn(
                    "flex items-start gap-3 p-2.5 rounded-lg cursor-pointer transition-all border relative",
                    isSelected
                      ? "bg-[#F5F4F2] border-[#E5E4E2] text-[#1A1A1A]"
                      : "border-transparent hover:bg-[#F5F4F2] hover:border-[#E5E4E2] text-[#2D2D2D]",
                    locked && "opacity-80"
                  )}
                >
                  <div
                    className={cn(
                      "p-2 rounded-lg shrink-0 mt-0.5 bg-white border border-[#E5E4E2] text-[#1A1A1A]"
                    )}
                  >
                    {locked ? <Lock className="w-4 h-4 text-[#105B38]" /> : <Icon className="w-4 h-4" />}
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-xs text-[#1A1A1A]">
                          {opt.label}
                        </span>
                        <span className="text-[10px] text-[#666666] font-mono">
                          ({opt.engine})
                        </span>
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-[#1A1A1A]" />}
                    </div>

                    <p className="text-[11px] text-[#666666] leading-snug">
                      {opt.description}
                    </p>

                    <div className="pt-0.5 flex items-center justify-between">
                      <span
                        className={cn(
                          "inline-block px-1.5 py-0.5 rounded text-[9px] font-mono border",
                          opt.badgeColor
                        )}
                      >
                        {opt.badge}
                      </span>
                      {locked && (
                        <span className="text-[10px] text-[#105B38] font-semibold flex items-center gap-1">
                          Upgrade to unlock
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-2 pt-2 border-t border-[#E5E4E2] px-2 py-1 flex items-center justify-between text-[10px] text-[#999999] font-mono">
            <span>Pakistani Law Embeddings</span>
            <span className="text-[#105B38] font-semibold">Active (88K+ Laws)</span>
          </div>
        </div>
      )}
    </div>
  );
};

