'use client'

import useEmblaCarousel from 'embla-carousel-react'
import { type ReactNode, useEffect, useRef } from 'react'
import { useHorizontalOverflow } from '@/hooks/use-horizontal-overflow'

type ReviewsCarouselProps = {
  children: ReactNode
  className?: string
}

export function ReviewsCarousel({ children, className = '' }: ReviewsCarouselProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const hasOverflow = useHorizontalOverflow(viewportRef)
  const overflowRef = useRef(hasOverflow)
  overflowRef.current = hasOverflow
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'start',
    containScroll: 'trimSnaps',
    dragFree: false,
    loop: false,
    skipSnaps: false,
    slidesToScroll: 1,
    watchDrag: () => overflowRef.current,
  })

  useEffect(() => {
    if (emblaApi && overflowRef.current === hasOverflow) emblaApi.reInit()
  }, [emblaApi, hasOverflow])

  return (
    <div
      className={`min-w-0 overflow-hidden ${hasOverflow ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'} ${className}`}
      data-overflow={String(hasOverflow)}
      ref={(node) => {
        viewportRef.current = node
        emblaRef(node)
      }}
    >
      <div className="-ml-4 flex touch-pan-y items-stretch">{children}</div>
    </div>
  )
}

export function ReviewsCarouselSlide({ children }: { children: ReactNode }) {
  return (
    <div
      className="
        min-w-0 shrink-0 grow-0
        basis-[92%] pl-4
        md:basis-[68%]
        xl:basis-[54%]
      "
    >
      <div className="h-full">{children}</div>
    </div>
  )
}
