import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[96px] w-full rounded-xl border border-[hsl(var(--preview-border))] bg-[#0f1a2d]/70 px-3 py-2 text-base text-slate-100 ring-offset-[#0f172a] placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/55 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm shadow-[inset_0_0_0_1px_rgba(148,163,184,0.04)] shadcn-textarea mac-anim",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
