'use client'

import type {
  ComponentPropsWithoutRef,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from 'react'
import { useRef, useState } from 'react'
import { cn } from '@/lib/utils'

export function MediaRow({
  children,
  className,
  ...props
}: ComponentPropsWithoutRef<'div'> & { children: ReactNode }) {
  const dragScroll = useDraggableScroll<HTMLDivElement>()

  return (
    <div
      {...props}
      className={cn('media-row', className)}
      data-dragging={dragScroll.isDragging ? 'true' : 'false'}
      onClickCapture={dragScroll.onClickCapture}
      onPointerCancel={dragScroll.onPointerCancel}
      onPointerDown={dragScroll.onPointerDown}
      onPointerMove={dragScroll.onPointerMove}
      onPointerUp={dragScroll.onPointerUp}
      ref={dragScroll.ref}
    >
      {children}
    </div>
  )
}

function useDraggableScroll<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
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
      if (event.pointerType !== 'mouse' || event.button !== 0) return
      const element = ref.current
      if (!element) return

      dragState.current.pointerId = event.pointerId
      dragState.current.startX = event.clientX
      dragState.current.startScrollLeft = element.scrollLeft
      dragState.current.isDragging = false
      setIsDragging(false)
      element.setPointerCapture(event.pointerId)
    },
    onPointerMove(event: ReactPointerEvent<T>) {
      if (dragState.current.pointerId !== event.pointerId) return
      const element = ref.current
      if (!element) return

      const distance = event.clientX - dragState.current.startX
      if (Math.abs(distance) > 6) {
        dragState.current.isDragging = true
        setIsDragging(true)
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
