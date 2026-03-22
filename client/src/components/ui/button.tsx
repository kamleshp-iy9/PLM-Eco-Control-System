import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "relative inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl border text-sm font-semibold transition-[transform,box-shadow,background-color,border-color,color] duration-150 ease-out outline-none focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-[var(--plm-focus-ring)] disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none active:translate-y-px [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow-[var(--plm-shadow-button-primary)] hover:bg-primary/95",
        destructive:
          "border-transparent bg-destructive text-white shadow-[var(--plm-shadow-button-muted)] hover:bg-destructive/92 dark:bg-destructive/80",
        outline:
          "border-border/70 bg-background/70 text-foreground shadow-[var(--plm-shadow-button-muted)] backdrop-blur-xl hover:border-primary/25 hover:bg-accent/80 hover:text-accent-foreground dark:bg-background/50",
        secondary:
          "border-transparent bg-secondary/80 text-secondary-foreground shadow-[var(--plm-shadow-button-muted)] hover:bg-secondary",
        ghost:
          "border-transparent bg-transparent text-muted-foreground shadow-none hover:bg-accent/80 hover:text-foreground",
        toolbar:
          "border-border/60 bg-background/55 text-muted-foreground shadow-[var(--plm-shadow-button-muted)] backdrop-blur-xl hover:border-primary/20 hover:bg-accent/75 hover:text-foreground",
        link: "border-transparent bg-transparent text-primary shadow-none underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2 has-[>svg]:px-3.5",
        sm: "h-9 gap-1.5 px-3.5 text-xs has-[>svg]:px-3",
        lg: "h-11 px-6 text-sm has-[>svg]:px-4.5",
        icon: "size-10",
        "icon-sm": "size-9",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
