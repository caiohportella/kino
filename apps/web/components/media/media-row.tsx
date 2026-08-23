'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import type {
  ComponentPropsWithoutRef,
  MouseEvent as ReactMouseEvent,
  ReactNode,
  PointerEvent as ReactPointerEvent,
} from 'react'
import { type RefObject, useCallback, useLayoutEffect, useRef, useState } from 'react'
import { useHorizontalOverflow } from '@/hooks/use-horizontal-overflow'
import { shouldStartMediaRowDrag } from '@/lib/media-row-interactions'
import { getMediaRowNavigationState, getMediaRowScrollDistance } from '@/lib/media-row-navigation'
import { cn } from '@/lib/utils'

export function MediaRow({
  children,
  className,
  overflowAware = false,
  ...props
}: ComponentPropsWithoutRef<'div'> & {
  children: ReactNode
  overflowAware?: boolean
}) {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const hasOverflow = useHorizontalOverflow(viewportRef, overflowAware)
  const [navigation, setNavigation] = useState({
    canScrollPrev: false,
    canScrollNext: false,
  })

  const updateNavigation = useCallback(() => {
    const viewport = viewportRef.current

    if (!viewport) return

    const state = getMediaRowNavigationState(viewport)

    setNavigation({
      canScrollPrev: state.canScrollPrev,
      canScrollNext: state.canScrollNext,
    })
  }, [])
  const dragScroll = useDraggableScroll(viewportRef, !overflowAware || hasOverflow)
  const accessibilityProps =
    overflowAware && !hasOverflow
      ? { 'aria-label': undefined, role: undefined, tabIndex: undefined }
      : {}

  useLayoutEffect(() => {
    const viewport = viewportRef.current

    if (!viewport) return

    updateNavigation()

    const handleScroll = () => {
      updateNavigation()
    }

    viewport.addEventListener('scroll', handleScroll, {
      passive: true,
    })

    const resizeObserver = new ResizeObserver(updateNavigation)

    resizeObserver.observe(viewport)

    const track = viewport.firstElementChild

    if (track instanceof HTMLElement) {
      resizeObserver.observe(track)
    }

    return () => {
      viewport.removeEventListener('scroll', handleScroll)
      resizeObserver.disconnect()
    }
  }, [updateNavigation])

  const scrollByPage = useCallback((direction: 'prev' | 'next') => {
    const viewport = viewportRef.current

    if (!viewport) return

    const distance = getMediaRowScrollDistance(viewport.clientWidth)

    viewport.scrollBy({
      left: direction === 'prev' ? -distance : distance,
      behavior: 'smooth',
    })
  }, [])

  return (
    <div className="group/media-row relative min-w-0">
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

      {navigation.canScrollPrev ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 z-5 hidden w-16 bg-linear-to-r from-kino-bg to-transparent opacity-0 transition-opacity duration-200 group-hover/media-row:opacity-100 md:block"
        />
      ) : null}

      {navigation.canScrollNext ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 z-5 hidden w-16 bg-linear-to-l from-kino-bg to-transparent opacity-0 transition-opacity duration-200 group-hover/media-row:opacity-100 md:block"
        />
      ) : null}

      <MediaRowArrow
        direction="prev"
        disabled={!navigation.canScrollPrev}
        onClick={() => scrollByPage('prev')}
      />

      <MediaRowArrow
        direction="next"
        disabled={!navigation.canScrollNext}
        onClick={() => scrollByPage('next')}
      />
    </div>
  )
}

function MediaRowArrow({
  direction,
  disabled,
  onClick,
}: {
  direction: 'prev' | 'next'
  disabled: boolean
  onClick: () => void
}) {
  const Icon = direction === 'prev' ? ChevronLeft : ChevronRight

  return (
    <button
      aria-label={direction === 'prev' ? 'Previous' : 'Next'}
      className={cn(
        'absolute top-1/2 z-10 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/12 bg-black/55 text-white shadow-lg backdrop-blur-md transition-all duration-200 md:flex',
        'opacity-0 group-hover/media-row:opacity-100',
        'hover:scale-105 hover:border-white/20 hover:bg-black/75',
        'focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-kino-accent',
        direction === 'prev' ? 'left-2' : 'right-2',
        disabled && 'pointer-events-none scale-95 opacity-0!'
      )}
      disabled={disabled}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onClick()
      }}
      type="button"
    >
      <Icon aria-hidden="true" size={20} strokeWidth={2} />
    </button>
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
