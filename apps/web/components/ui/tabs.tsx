'use client'

import * as TabsPrimitive from '@radix-ui/react-tabs'
import type { ComponentPropsWithoutRef, ElementRef } from 'react'
import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

export const Tabs = TabsPrimitive.Root

export const TabsList = forwardRef<
  ElementRef<typeof TabsPrimitive.List>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    className={cn('flex flex-wrap items-center gap-2 rounded-md bg-white/[0.04] p-1', className)}
    ref={ref}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

export const TabsTrigger = forwardRef<
  ElementRef<typeof TabsPrimitive.Trigger>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    className={cn(
      'min-h-9 rounded-md px-3 py-1.5 text-sm font-semibold text-kino-muted transition-colors hover:text-kino-text data-[state=active]:bg-kino-accent data-[state=active]:text-black',
      className
    )}
    ref={ref}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

export const TabsContent = forwardRef<
  ElementRef<typeof TabsPrimitive.Content>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content className={cn('outline-none', className)} ref={ref} {...props} />
))
TabsContent.displayName = TabsPrimitive.Content.displayName
