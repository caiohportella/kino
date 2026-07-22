'use client'

import type { ComponentProps } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

function SplitButton({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('inline-flex min-h-11 min-w-0 overflow-hidden rounded-md shadow-xs', className)}
      data-slot="split-button"
      role="group"
      {...props}
    />
  )
}

function SplitButtonMain({ className, ...props }: ComponentProps<typeof Button>) {
  return (
    <Button
      className={cn(
        'min-h-11 min-w-0 flex-1 rounded-none rounded-l-md border-r border-r-foreground/10 px-3 leading-tight shadow-none',
        className
      )}
      variant="secondary"
      {...props}
    />
  )
}

function SplitButtonSecondary({ className, ...props }: ComponentProps<typeof Button>) {
  return (
    <Button
      className={cn(
        'min-h-11 min-w-11 rounded-none rounded-r-md px-3 shadow-none',
        className
      )}
      variant="secondary"
      {...props}
    />
  )
}

export { SplitButton, SplitButtonMain, SplitButtonSecondary }
