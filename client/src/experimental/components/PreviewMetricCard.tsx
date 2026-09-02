import React from "react";
import { TrendingUp, TrendingDown, Minus, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PreviewMetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  badge?: string;
  icon?: LucideIcon;
  trend?: {
    value: string;
    isPositive?: boolean | null; // true = positive, false = negative, null = neutral
    label?: string;
  };
  variant?: "default" | "gold" | "emerald" | "sapphire" | "ruby";
  loading?: boolean;
  className?: string;
  onClick?: () => void;
}

export const PreviewMetricCard: React.FC<PreviewMetricCardProps> = ({
  title,
  value,
  subtitle,
  badge,
  icon: Icon,
  trend,
  variant = "emerald",
  loading = false,
  className,
  onClick,
}) => {
  const variantStyles = {
    gold: {
      border: "hover:border-amber-300",
      iconBg: "bg-amber-50 text-amber-700 border-amber-200",
      glow: "hover:shadow-amber-500/5",
      valueColor: "text-[#0F172A]",
    },
    emerald: {
      border: "hover:border-[#105B38]/50",
      iconBg: "bg-emerald-50 text-[#105B38] border-emerald-200",
      glow: "hover:shadow-emerald-500/5",
      valueColor: "text-[#0F172A]",
    },
    sapphire: {
      border: "hover:border-blue-300",
      iconBg: "bg-blue-50 text-blue-700 border-blue-200",
      glow: "hover:shadow-blue-500/5",
      valueColor: "text-[#0F172A]",
    },
    ruby: {
      border: "hover:border-rose-300",
      iconBg: "bg-rose-50 text-rose-700 border-rose-200",
      glow: "hover:shadow-rose-500/5",
      valueColor: "text-[#0F172A]",
    },
    default: {
      border: "hover:border-[#CBD5E1]",
      iconBg: "bg-[#F8FAFC] text-[#105B38] border-[#E2E8F0]",
      glow: "hover:shadow-slate-500/5",
      valueColor: "text-[#0F172A]",
    },
  }[variant];

  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative flex flex-col justify-between rounded-2xl p-4 transition-all duration-200",
        "bg-white border border-[#E2E8F0] shadow-xs hover:-translate-y-0.5 hover:shadow-sm",
        variantStyles.border,
        variantStyles.glow,
        onClick ? "cursor-pointer" : "",
        className
      )}
    >
      {/* Top row: Title + Icon + Optional Badge */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider group-hover:text-[#105B38] transition-colors truncate">
          {title}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {badge && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-50 text-[#105B38] border border-emerald-200">
              {badge}
            </span>
          )}
          {Icon && (
            <div
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full border transition-transform group-hover:scale-110",
                variantStyles.iconBg
              )}
            >
              <Icon className="h-3.5 w-3.5" />
            </div>
          )}
        </div>
      </div>

      {/* Main Value */}
      <div className="flex items-baseline gap-2 mb-1">
        {loading ? (
          <div className="h-7 w-20 bg-[#F1F5F9] rounded-lg animate-pulse" />
        ) : (
          <span
            className={cn(
              "text-2xl font-bold tracking-tight",
              variantStyles.valueColor
            )}
          >
            {value}
          </span>
        )}
      </div>

      {/* Bottom context / trend */}
      <div className="flex items-center justify-between text-xs text-[#64748B] mt-1 pt-2 border-t border-[#F1F5F9]">
        {subtitle && <span className="truncate max-w-[150px] font-medium text-[#64748B]">{subtitle}</span>}

        {trend && (
          <div
            className={cn(
              "inline-flex items-center gap-1 font-bold font-mono text-xs",
              trend.isPositive === true
                ? "text-emerald-700"
                : trend.isPositive === false
                  ? "text-rose-600"
                  : "text-[#64748B]"
            )}
          >
            {trend.isPositive === true && <TrendingUp className="w-3.5 h-3.5" />}
            {trend.isPositive === false && <TrendingDown className="w-3.5 h-3.5" />}
            {trend.isPositive === null && <Minus className="w-3.5 h-3.5" />}
            <span>{trend.value}</span>
            {trend.label && <span className="text-[#64748B] ml-0.5 font-normal">{trend.label}</span>}
          </div>
        )}
      </div>
    </div>
  );
};
