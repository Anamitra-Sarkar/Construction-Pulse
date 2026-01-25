import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground/40 selection:bg-primary/10 selection:text-primary flex h-10 w-full min-w-0 rounded-xl border border-border/60 bg-white/50 px-4 py-2 text-sm shadow-soft transition-all duration-300 ease-soft outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:border-primary/40 focus-visible:ring-4 focus-visible:ring-primary/5",
        "aria-invalid:ring-destructive/10 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Input }
