import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "placeholder:text-muted-foreground flex min-h-24 w-full rounded-[1.125rem] border border-border/70 bg-background/65 px-3.5 py-3 text-base shadow-[var(--plm-shadow-inset)] backdrop-blur-xl transition-[background-color,border-color,box-shadow,color] duration-150 outline-none hover:border-primary/20 hover:bg-background/80 focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-[var(--plm-focus-ring)] aria-invalid:border-destructive aria-invalid:ring-4 aria-invalid:ring-destructive/15 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
