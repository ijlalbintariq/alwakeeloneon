import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  // Whitespace-nowrap: Badges should never wrap.
  "whitespace-nowrap inline-flex items-center rounded-lg border px-2.5 py-0.5 text-[11px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary/55 focus:ring-offset-2" +
  " hover-elevate " ,
  {
    variants: {
      variant: {
        default:
          "border-primary/40 bg-gradient-to-r from-primary/20 to-primary/20 text-foreground shadow-xs",
        secondary: "border-[hsl(var(--preview-border))] bg-[hsl(var(--preview-surface))/0.65] text-foreground",
        destructive:
          "border-red-400/40 bg-red-500/15 text-red-200 shadow-xs",

        outline: "border border-[hsl(var(--preview-border))] bg-transparent text-foreground shadow-xs",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants }
