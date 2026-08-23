'use client'

import type { ReactNode } from 'react'
import { DisplayTitle } from '@/components/media/display-title'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

export type ProfileModalProps = {
  actions?: ReactNode
  children: ReactNode
  contentClassName?: string
  onOpenChange: (open: boolean) => void
  open: boolean
  title: string
}

export function ProfileModal({
  actions,
  children,
  contentClassName,
  onOpenChange,
  open,
  title,
}: ProfileModalProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className={cn('flex max-w-3xl flex-col overflow-hidden', contentClassName)}>
        <DialogHeader className="shrink-0 gap-2">
          <DialogTitle className="text-2xl font-black italic tracking-normal sm:text-3xl">
            <DisplayTitle title={title} />
          </DialogTitle>
        </DialogHeader>

        {children}

        {actions ? <div className="flex shrink-0 justify-end gap-3">{actions}</div> : null}
      </DialogContent>
    </Dialog>
  )
}
