'use client'

import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog'
import type { ComponentPropsWithoutRef, ElementRef, HTMLAttributes } from 'react'
import { forwardRef } from 'react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export const AlertDialog = AlertDialogPrimitive.Root
export const AlertDialogTrigger = AlertDialogPrimitive.Trigger
export const AlertDialogPortal = AlertDialogPrimitive.Portal
export const AlertDialogCancel = AlertDialogPrimitive.Cancel
export const AlertDialogAction = AlertDialogPrimitive.Action

export const AlertDialogOverlay = forwardRef<
  ElementRef<typeof AlertDialogPrimitive.Overlay>,
  ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Overlay className={cn('fixed inset-0 z-50 bg-black/70', className)} ref={ref} {...props} />
))
AlertDialogOverlay.displayName = AlertDialogPrimitive.Overlay.displayName

export const AlertDialogContent = forwardRef<
  ElementRef<typeof AlertDialogPrimitive.Content>,
  ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>
>(({ className, ...props }, ref) => (
  <AlertDialogPortal>
    <AlertDialogOverlay />
    <AlertDialogPrimitive.Content
      className={cn(
        'fixed left-1/2 top-1/2 z-50 grid w-[calc(100%-32px)] max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 rounded-md border border-white/10 bg-kino-panel p-5 shadow-soft outline-none',
        className
      )}
      ref={ref}
      {...props}
    />
  </AlertDialogPortal>
))
AlertDialogContent.displayName = AlertDialogPrimitive.Content.displayName

export function AlertDialogHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('grid gap-2', className)} {...props} />
}

export function AlertDialogFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)} {...props} />
}

export const AlertDialogTitle = forwardRef<
  ElementRef<typeof AlertDialogPrimitive.Title>,
  ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Title className={cn('text-lg font-semibold text-kino-text', className)} ref={ref} {...props} />
))
AlertDialogTitle.displayName = AlertDialogPrimitive.Title.displayName

export const AlertDialogDescription = forwardRef<
  ElementRef<typeof AlertDialogPrimitive.Description>,
  ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Description className={cn('text-sm leading-6 text-kino-muted', className)} ref={ref} {...props} />
))
AlertDialogDescription.displayName = AlertDialogPrimitive.Description.displayName

export function AlertDialogButtonAction({
  className,
  variant = 'default',
  ...props
}: ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Action> & {
  variant?: 'default' | 'secondary' | 'ghost' | 'destructive' | 'outline'
}) {
  return <AlertDialogPrimitive.Action className={cn(buttonVariants({ variant }), className)} {...props} />
}

export function AlertDialogButtonCancel({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel>) {
  return <AlertDialogPrimitive.Cancel className={cn(buttonVariants({ variant: 'secondary' }), className)} {...props} />
}
