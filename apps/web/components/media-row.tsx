'use client'

import type {
  ComponentPropsWithoutRef,
  MouseEvent as ReactMouseEvent,
  ReactNode,
  PointerEvent as ReactPointerEvent,
} from 'react'
import { type RefObject, useRef, useState } from 'react'
import { shouldStartMediaRowDrag } from '@/lib/media-row-interactions'
import { useHorizontalOverflow } from '@/lib/use-horizontal-overflow'
import { cn } from '@/lib/utils'

export function MediaRow({
  children,
  className,
  overflowAware = false,
  ...props
}: ComponentPropsWithoutRef<'div'> & { children: ReactNode; overflowAware?: boolean }) {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const hasOverflow = useHorizontalOverflow(viewportRef, overflowAware)
  const dragScroll = useDraggableScroll(viewportRef, !overflowAware || hasOverflow)
  const accessibilityProps =
    overflowAware && !hasOverflow
      ? { 'aria-label': undefined, role: undefined, tabIndex: undefined }
      : {}

  return (
    <div
      {...props}
      {...accessibilityProps}
      className={cn('media-row w-full min-w-0 max-w-full', className)}
      data-overflow={overflowAware ? String(hasOverflow) : undefined}
      data-dragging={dragScroll.isDragging ? 'true' : 'false'}
      onClickCapture={dragScroll.onClickCapture}
      onPointerCancel={dragScroll.onPointerCancel}
      onPointerDown={dragScroll.onPointerDown}
      onPointerMove={dragScroll.onPointerMove}
      onPointerUp={dragScroll.onPointerUp}
      ref={dragScroll.ref}
    >
      <div className="media-row-track">{children}</div>
    </div>
  )
}

function useDraggableScroll<T extends HTMLElement>(ref: RefObject<T | null>, enabled: boolean) {
  const dragState = useRef({
    pointerId: -1,
    startX: 0,
    startScrollLeft: 0,
    isDragging: false,
    suppressClick: false,
  })
  const [isDragging, setIsDragging] = useState(false)

  function finishDrag(pointerId?: number) {
    if (pointerId !== undefined && dragState.current.pointerId !== pointerId) return
    if (dragState.current.isDragging) {
      dragState.current.suppressClick = true
      window.setTimeout(() => {
        dragState.current.suppressClick = false
      }, 0)
    }
    dragState.current.pointerId = -1
    dragState.current.isDragging = false
    setIsDragging(false)
  }

  return {
    ref,
    isDragging,
    onPointerDown(event: ReactPointerEvent<T>) {
      if (!enabled) return
      if (!shouldStartMediaRowDrag(event)) return
      const element = ref.current
      if (!element) return

      dragState.current.pointerId = event.pointerId
      dragState.current.startX = event.clientX
      dragState.current.startScrollLeft = element.scrollLeft
      dragState.current.isDragging = false
      setIsDragging(false)
    },
    onPointerMove(event: ReactPointerEvent<T>) {
      if (dragState.current.pointerId !== event.pointerId) return
      const element = ref.current
      if (!element) return

      const distance = event.clientX - dragState.current.startX
      if (Math.abs(distance) > 6) {
        dragState.current.isDragging = true
        setIsDragging(true)
        element.setPointerCapture(event.pointerId)
      }

      if (dragState.current.isDragging) {
        element.scrollLeft = dragState.current.startScrollLeft - distance
        event.preventDefault()
      }
    },
    onPointerUp(event: ReactPointerEvent<T>) {
      finishDrag(event.pointerId)
    },
    onPointerCancel(event: ReactPointerEvent<T>) {
      finishDrag(event.pointerId)
    },
    onClickCapture(event: ReactMouseEvent<T>) {
      if (!dragState.current.suppressClick) return
      event.preventDefault()
      event.stopPropagation()
    },
  }
}
