'use client'

import type { CarouselTitle } from '@kino/core'

import { useTrendingCarousel } from '@/hooks/carousel/use-trending-carousel'

import { CarouselArrow } from './carousel-arrow'
import { CarouselBullet } from './carousel-bullet'
import { CarouselSlide } from './carousel-slide'

type TrendingCarouselProps = {
  items: CarouselTitle[]
}

export function TrendingCarousel({ items }: TrendingCarouselProps) {
  const {
    emblaRef,
    selectedIndex,
    canGoPrev,
    canGoNext,
    progress,
    scrollTo,
    scrollPrev,
    scrollNext,
    pauseAutoplay,
    resumeAutoplay,
  } = useTrendingCarousel(items.length)

  if (items.length === 0) {
    return null
  }

  const MAX_VISIBLE_BULLETS = 8
  const visibleBulletCount = Math.min(MAX_VISIBLE_BULLETS, items.length)

  const bulletStart = Math.floor(selectedIndex / MAX_VISIBLE_BULLETS) * MAX_VISIBLE_BULLETS

  const visibleBullets = items.slice(bulletStart, bulletStart + visibleBulletCount)

  return (
    <section
      className="
        group/carousel
        relative
        h-[clamp(320px,38vw,460px)]
        w-full
        overflow-hidden
        rounded-2xl
        bg-kino-surface
        lg:h-[clamp(450px,55vh,660px)]
      "
      onMouseEnter={pauseAutoplay}
      onMouseLeave={resumeAutoplay}
    >
      <div className="h-full w-full overflow-hidden" ref={emblaRef}>
        <div className="flex h-full touch-pan-y">
          {items.map((item, index) => (
            <CarouselSlide
              active={index === selectedIndex}
              item={item}
              key={`${item.media_type}-${item.id}`}
            />
          ))}
        </div>
      </div>

      {items.length > 1 ? (
        <>
          <div className="hidden sm:block">
            <CarouselArrow direction="prev" disabled={!canGoPrev} onClick={scrollPrev} />
          </div>

          <div className="hidden sm:block">
            <CarouselArrow direction="next" disabled={!canGoNext} onClick={scrollNext} />
          </div>

          <div
            className="
              absolute bottom-4 left-6 right-6
              flex gap-1.5
              sm:left-8 sm:right-8
              lg:left-12 lg:right-12
            "
          >
            {visibleBullets.map((item, visibleIndex) => {
              const index = bulletStart + visibleIndex
              const active = index === selectedIndex

              return (
                <CarouselBullet
                  active={active}
                  item={item}
                  key={`${item.media_type}-${item.id}`}
                  onClick={() => scrollTo(index)}
                  progress={active ? progress : 0}
                />
              )
            })}
          </div>
        </>
      ) : null}
    </section>
  )
}
