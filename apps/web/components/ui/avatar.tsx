'use client'

import * as AvatarPrimitive from '@radix-ui/react-avatar'
import type { ComponentPropsWithoutRef, ElementRef } from 'react'
import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

export const Avatar = forwardRef<
  ElementRef<typeof AvatarPrimitive.Root>,
  ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    className={cn('relative flex h-10 w-10 shrink-0 overflow-hidden rounded-md bg-white/[0.06]', className)}
    ref={ref}
    {...props}
  />
))
Avatar.displayName = AvatarPrimitive.Root.displayName

export const AvatarImage = forwardRef<
  ElementRef<typeof AvatarPrimitive.Image>,
  ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image className={cn('h-full w-full object-cover', className)} ref={ref} {...props} />
))
AvatarImage.displayName = AvatarPrimitive.Image.displayName

export const AvatarFallback = forwardRef<
  ElementRef<typeof AvatarPrimitive.Fallback>,
  ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    className={cn('flex h-full w-full items-center justify-center text-sm font-semibold text-kino-muted', className)}
    ref={ref}
    {...props}
  />
))
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName
