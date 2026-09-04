import React, { useState, useEffect } from "react";
import { ShieldCheck, ExternalLink, Loader2, Scale } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

interface ChatCitationChipProps {
  citation: string;
  onInspect?: (citation: string, id?: number) => void;
  className?: string;
}

export const ChatCitationChip: React.FC<ChatCitationChipProps> = ({
  citation,
  onInspect,
  className,
}) => {
  const [status, setStatus] = useState<"idle" | "loading" | "verified" | "unverified">("idle");
  const [judgmentId, setJudgmentId] = useState<number | undefined>(undefined);
  const [court, setCourt] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!citation || citation.length < 5) return;
    setStatus("loading");
    fetch(`/api/caseLaw/lookup?q=${encodeURIComponent(citation)}`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : { found: false }))
      .then((data) => {
        if (data.found && data.id) {
          setStatus("verified");
          setJudgmentId(data.id);
          setCourt(data.court);
        } else {
          setStatus("unverified");
        }
      })
      .catch(() => {
        setStatus("unverified");
      });
  }, [citation]);

  return (
    <Link
      href={`/preview/judgments?q=${encodeURIComponent(citation)}`}
      onClick={(e) => {
        if (onInspect) {
          e.preventDefault();
          onInspect(citation, judgmentId);
        }
      }}
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs font-mono transition-all duration-150 border select-none group cursor-pointer",
        status === "verified"
          ? "bg-[#1A1A1A]/5 dark:bg-[#1A1A1A]/50 text-[#1A1A1A] dark:text-[#F8FAFC] border-[#1A1A1A]/20 dark:border-[#1E2D44] hover:bg-[#2D2D2D]/10 hover:border-[#1A1A1A]/60 shadow-sm shadow-sm"
          : status === "loading"
          ? "bg-[#F5F4F2] dark:bg-[#0B131E] text-[#666666] dark:text-[#94A3B8] dark:text-[#475569] border-[#E5E4E2] dark:border-[#1E2D44]/60"
          : "bg-[#FAFAF9] text-[#4A4A4A] dark:text-[#94A3B8] dark:text-[#475569] border-[#E5E4E2] dark:border-[#1E2D44] hover:bg-[#F5F4F2] dark:bg-[#0B131E] hover:text-[#1A1A1A] dark:text-[#F8FAFC]",
        className
      )}
      title={
        status === "verified"
          ? `Verified Precedent (${court || "Supreme Court of Pakistan"}) — Click to inspect in Judgment Reader`
          : "Case Citation — Click to inspect"
      }
    >
      {status === "loading" ? (
        <Loader2 className="w-2.5 h-2.5 animate-spin text-[#666666] dark:text-[#94A3B8] dark:text-[#475569]" />
      ) : status === "verified" ? (
        <ShieldCheck className="w-3 h-3 text-[#1A1A1A] dark:text-[#F8FAFC] shrink-0" />
      ) : (
        <Scale className="w-2.5 h-2.5 text-[#1A1A1A] dark:text-[#F8FAFC] shrink-0" />
      )}
      <span className="font-bold">{citation}</span>
      <ExternalLink className="w-2.5 h-2.5 opacity-40 group-hover:opacity-100 transition-opacity" />
    </Link>
  );
};
