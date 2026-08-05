'use client'

import useEmblaCarousel from 'embla-carousel-react'
import type { ReactNode } from 'react'

type ReviewsCarouselProps = {
  children: ReactNode
  className?: string
}

export function ReviewsCarousel({ children, className = '' }: ReviewsCarouselProps) {
  const [emblaRef] = useEmblaCarousel({
    align: 'start',
    containScroll: 'trimSnaps',
    dragFree: false,
    loop: false,
    skipSnaps: false,
    slidesToScroll: 1,
  })

  return (
    <div
      className={`min-w-0 cursor-grab overflow-hidden active:cursor-grabbing ${className}`}
      ref={emblaRef}
    >
      <div className="-ml-4 flex touch-pan-y items-stretch">{children}</div>
    </div>
  )
}

export function ReviewsCarouselSlide({ children }: { children: ReactNode }) {
  return (
    <div className="min-w-0 shrink-0 grow-0 basis-full pl-4 md:basis-1/2">
      <div className="h-full">{children}</div>
    </div>
  )
}
