import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/55 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f172a] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 transition-all duration-200 ease-out" +
  " hover-elevate active-elevate-2 shadcn-button mac-anim",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-r from-amber-300 to-amber-500 text-slate-950 border border-amber-300/70 shadow-[0_12px_24px_-14px_rgba(251,191,36,0.9)] hover:from-amber-200 hover:to-amber-400",
        destructive:
          "bg-gradient-to-r from-red-500 to-rose-500 text-white border border-red-300/35 shadow-[0_12px_24px_-14px_rgba(239,68,68,0.8)] hover:from-red-400 hover:to-rose-400",
        outline:
          "border border-[hsl(var(--preview-border))] bg-[#13233c]/60 text-slate-200 shadow-[0_10px_22px_-18px_rgba(2,6,23,0.8)] hover:border-amber-400/45 hover:bg-[#1a2d49]/70",
        secondary:
          "border border-[hsl(var(--preview-border))] bg-[#0f1a2d]/70 text-slate-200 shadow-[0_10px_22px_-18px_rgba(2,6,23,0.8)] hover:bg-[#172842]/75 hover:border-amber-400/30",
        // Add a transparent border so that when someone toggles a border on later, it doesn't shift layout/size.
        ghost: "border border-transparent text-slate-300 hover:bg-white/8 hover:text-slate-100",
      },
      // Heights are set as "min" heights, because sometimes Ai will place large amount of content
      // inside buttons. With a min-height they will look appropriate with small amounts of content,
      // but will expand to fit large amounts of content.
      size: {
        default: "min-h-9 px-4 py-2",
        sm: "min-h-8 rounded-lg px-3 text-xs",
        lg: "min-h-10 rounded-xl px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  },
)
Button.displayName = "Button"

export { Button, buttonVariants }
