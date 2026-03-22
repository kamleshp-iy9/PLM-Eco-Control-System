"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "inline-flex h-10 w-fit items-center justify-center rounded-[1rem] border border-border/70 bg-background/55 p-1 text-muted-foreground shadow-[var(--plm-shadow-button-muted)] backdrop-blur-xl",
        className
      )}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "inline-flex h-full flex-1 items-center justify-center gap-1.5 rounded-[0.8rem] border border-transparent px-3 py-1.5 text-sm font-semibold whitespace-nowrap text-muted-foreground transition-[transform,background-color,border-color,color,box-shadow] duration-150 hover:text-foreground focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-[var(--plm-focus-ring)] disabled:pointer-events-none disabled:opacity-50 data-[state=active]:border-primary/15 data-[state=active]:bg-background/80 data-[state=active]:text-foreground data-[state=active]:shadow-[var(--plm-shadow-button-muted)] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
