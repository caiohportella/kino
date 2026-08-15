'use client'

import type { ComponentPropsWithoutRef, KeyboardEvent, ReactNode, UIEvent } from 'react'
import { useLayoutEffect, useRef } from 'react'
import { MediaRow } from '@/components/media/media-row'
import { isInteractiveMediaRowTarget } from '@/lib/media-row-interactions'
import { cn } from '@/lib/utils'

function getProfileRowScrollDistance(viewport: HTMLDivElement) {
  const track = viewport.firstElementChild
  const firstItem = track?.firstElementChild
  if (!(track instanceof HTMLElement) || !(firstItem instanceof HTMLElement)) {
    return viewport.clientWidth
  }

  const gap = Number.parseFloat(window.getComputedStyle(track).columnGap) || 0
  const itemWidth = firstItem.getBoundingClientRect().width
  const itemsPerPage = itemWidth * 2 + gap <= viewport.clientWidth + 1 ? 2 : 1
  return itemsPerPage * (itemWidth + gap)
}

export function ProfileHorizontalRow({
  action,
  after,
  children,
  className,
  notice,
  rowClassName,
  title,
  ...sectionProps
}: ComponentPropsWithoutRef<'section'> & {
  action?: ReactNode
  after?: ReactNode
  children: ReactNode
  notice?: ReactNode
  rowClassName?: string
  title: string
}) {
  const rowContainerRef = useRef<HTMLDivElement>(null)
  const scrollPositionRef = useRef(0)

  useLayoutEffect(() => {
    const viewport = rowContainerRef.current?.querySelector<HTMLDivElement>(
      '[data-profile-horizontal-row]'
    )
    if (!viewport) return

    const maxScrollLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth)
    viewport.scrollLeft = Math.min(scrollPositionRef.current, maxScrollLeft)
  })

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    if (isInteractiveMediaRowTarget(event.target)) return
    if (event.currentTarget.scrollWidth <= event.currentTarget.clientWidth + 1) return

    event.preventDefault()
    const direction = event.key === 'ArrowRight' ? 1 : -1
    event.currentTarget.scrollBy({
      behavior: 'smooth',
      left: direction * getProfileRowScrollDistance(event.currentTarget),
    })
  }

  const onScroll = (event: UIEvent<HTMLDivElement>) => {
    scrollPositionRef.current = event.currentTarget.scrollLeft
  }

  return (
    <section {...sectionProps} className={cn('mb-10', className)}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-kino-text">{title}</h2>
        {action}
      </div>
      {notice}
      <div className="w-full min-w-0 max-w-full" ref={rowContainerRef}>
        <MediaRow
          aria-label={title}
          className={cn('focus-ring rounded-md', rowClassName)}
          data-profile-horizontal-row=""
          onKeyDown={onKeyDown}
          onScroll={onScroll}
          overflowAware
          role="region"
          tabIndex={0}
        >
          {children}
        </MediaRow>
      </div>
      {after}
    </section>
  )
}
