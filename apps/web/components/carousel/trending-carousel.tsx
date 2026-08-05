"use client";

import type { CarouselTitle } from "@kino/core";

import { useTrendingCarousel } from "@/hooks/carousel/use-trending-carousel";

import { CarouselArrow } from "./carousel-arrow";
import { CarouselBullet } from "./carousel-bullet";
import { CarouselSlide } from "./carousel-slide";

type TrendingCarouselProps = {
  items: CarouselTitle[];
};

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
  } = useTrendingCarousel(items.length);

  if (items.length === 0) {
    return null;
  }

  return (
    <section
      className="group/carousel relative w-full overflow-hidden rounded-2xl bg-kino-surface"
      onMouseEnter={pauseAutoplay}
      onMouseLeave={resumeAutoplay}
      style={{ height: "clamp(320px, 38vw, 460px)" }}
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
            <CarouselArrow
              direction="prev"
              disabled={!canGoPrev}
              onClick={scrollPrev}
            />
          </div>

          <div className="hidden sm:block">
            <CarouselArrow
              direction="next"
              disabled={!canGoNext}
              onClick={scrollNext}
            />
          </div>

          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-2 sm:bottom-5">
            {items.map((item, index) => {
              const active = index === selectedIndex;

              return (
                <CarouselBullet
                  active={active}
                  item={item}
                  key={`${item.media_type}-${item.id}`}
                  onClick={() => scrollTo(index)}
                  progress={active ? progress : 0}
                />
              );
            })}
          </div>
        </>
      ) : null}
    </section>
  );
}
