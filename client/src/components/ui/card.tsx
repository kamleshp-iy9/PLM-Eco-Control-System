import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const cardVariants = cva(
  "group/card flex flex-col rounded-[1.375rem] border text-card-foreground transition-[transform,box-shadow,border-color,background-color] duration-200 ease-out",
  {
    variants: {
      variant: {
        default:
          "border-border/70 bg-[var(--plm-surface-1)] shadow-[var(--plm-shadow-surface)] backdrop-blur-xl",
        panel:
          "border-border/70 bg-[var(--plm-surface-2)] shadow-[var(--plm-shadow-surface)] backdrop-blur-xl",
        hero:
          "overflow-hidden border-primary/15 bg-gradient-to-r from-primary/12 via-primary/5 to-transparent shadow-[var(--plm-shadow-raised)] backdrop-blur-2xl",
        metric:
          "border-border/70 bg-[var(--plm-surface-2)] shadow-[var(--plm-shadow-surface)] backdrop-blur-xl",
        interactive:
          "cursor-pointer border-border/70 bg-[var(--plm-surface-2)] shadow-[var(--plm-shadow-surface)] backdrop-blur-xl hover:-translate-y-0.5 hover:border-[var(--plm-hover-border)] hover:shadow-[var(--plm-shadow-raised)]",
        floating:
          "border-border/70 bg-[var(--plm-surface-3)] shadow-[var(--plm-shadow-floating)] backdrop-blur-2xl",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Card({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof cardVariants>) {
  return (
    <div
      data-slot="card"
      data-card-variant={variant || "default"}
      className={cn(
        cardVariants({ variant }),
        "py-6",
        className,
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("leading-none font-semibold", className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-6", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center px-6 [.border-t]:pt-6", className)}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
