import React from "react";
import { Scale, Sparkles, Database } from "lucide-react";

interface PreviewBannerProps {
  className?: string;
}

export const PreviewBanner: React.FC<PreviewBannerProps> = ({ className = "" }) => {
  return (
    <div className={`w-full bg-[#105B38] border-b border-[#0D4A2E] text-white px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-3 shadow-sm ${className}`}>
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white dark:bg-[#131E2E]/15 border border-white/25 font-bold uppercase tracking-wider text-[10px]">
          <Scale size={12} className="text-emerald-200" />
          AL WAKEELO V2.0
        </span>
        <span className="hidden md:inline font-medium text-emerald-100">
          Chambers Professional Environment &bull; Secure Legal AI Database
        </span>
      </div>

      <div className="hidden lg:flex items-center gap-4 text-emerald-100 text-[11px]">
        <span className="inline-flex items-center gap-1">
          <Database size={11} className="text-emerald-300" />
          83,117+ Statutes
        </span>
        <span className="inline-flex items-center gap-1">
          <Sparkles size={11} className="text-emerald-300" />
          600,000+ Case Law
        </span>
      </div>
    </div>
  );
};

export default PreviewBanner;
