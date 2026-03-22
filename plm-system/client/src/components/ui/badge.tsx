import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] whitespace-nowrap shadow-[0_1px_0_rgba(255,255,255,0.08)] transition-[background-color,border-color,color,box-shadow] duration-150 [&>svg]:size-3 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-[var(--plm-focus-ring)]",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/92",
        secondary:
          "border-transparent bg-secondary/85 text-secondary-foreground [a&]:hover:bg-secondary",
        destructive:
          "border-transparent bg-destructive text-white [a&]:hover:bg-destructive/92 dark:bg-destructive/80",
        outline:
          "border-border/80 bg-background/60 text-foreground [a&]:hover:border-primary/25 [a&]:hover:bg-accent/75 [a&]:hover:text-accent-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
