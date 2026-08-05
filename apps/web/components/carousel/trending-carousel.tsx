"use client";

import Image from "next/image";
import type { TMDbTitle } from "@kino/core";
import { getDisplayTitle, getReleaseYear, getTMDbImageUrl } from "@kino/core";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import { titlePath } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { CarouselBullet } from "./carousel-bullet";
import { CarouselArrow } from "./carousel-arrow";

const AUTOPLAY_MS = 6000;
const MAX_SLIDES = 8;

export function TrendingCarousel({ items }: { items: TMDbTitle[] }) {
  const slides = items.slice(0, MAX_SLIDES);

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);

  const goTo = useCallback(
    (next: number) => {
      if (!slides.length) return;

      setIndex(((next % slides.length) + slides.length) % slides.length);
    },
    [slides.length],
  );

  const goNext = useCallback(() => {
    goTo(index + 1);
  }, [goTo, index]);

  const goPrev = useCallback(() => {
    goTo(index - 1);
  }, [goTo, index]);

  useEffect(() => {
    if (paused || slides.length <= 1) return;

    let frame = 0;
    let start = performance.now();

    const animate = (now: number) => {
      const value = Math.min((now - start) / AUTOPLAY_MS, 1);

      setProgress(value);

      if (value >= 1) {
        start = performance.now();

        setProgress(0);

        setIndex((current) => (current + 1) % slides.length);
      }

      frame = requestAnimationFrame(animate);
    };

    setProgress(0);

    frame = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(frame);
  }, [index, paused, slides.length]);

  const dragStartX = useRef<number | null>(null);

  function onPointerDown(event: PointerEvent) {
    dragStartX.current = event.clientX;
  }

  function onPointerUp(event: PointerEvent) {
    if (dragStartX.current === null) return;

    const delta = event.clientX - dragStartX.current;

    dragStartX.current = null;

    if (Math.abs(delta) < 40) return;

    delta < 0 ? goNext() : goPrev();
  }

  if (!slides.length) return null;

  return (
    <section
      className="group/carousel relative w-full overflow-hidden rounded-2xl bg-kino-surface"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      style={{
        height: "clamp(320px,38vw,460px)",
      }}
    >
      {slides.map((item, i) => (
        <CarouselSlide
          active={i === index}
          item={item}
          key={`${item.media_type}-${item.id}`}
        />
      ))}

      {slides.length > 1 && (
        <>
          <CarouselArrow direction="prev" onClick={goPrev} />

          <CarouselArrow direction="next" onClick={goNext} />

          <div className="absolute bottom-5 left-0 right-0 flex justify-center gap-2">
            {slides.map((item, i) => (
              <CarouselBullet
                key={`${item.media_type}-${item.id}`}
                active={i === index}
                item={item}
                progress={i === index ? progress : 0}
                onClick={() => {
                  setProgress(0);
                  goTo(i);
                }}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function CarouselSlide({ active, item }: { active: boolean; item: TMDbTitle }) {
  const title = getDisplayTitle(item);

  const year = getReleaseYear(item);

  const type = item.media_type === "tv" ? "tv" : "movie";

  const image =
    getTMDbImageUrl(item.backdrop_path ?? item.poster_path, "original") ??
    "/placeholder.jpg";

  return (
    <Link
      href={titlePath(item.id, title, type)}
      tabIndex={active ? 0 : -1}
      aria-hidden={!active}
      className={cn(
        "absolute inset-0 transition-opacity duration-700",
        active
          ? "opacity-100 pointer-events-auto"
          : "opacity-0 pointer-events-none",
      )}
    >
      <Image
        src={image}
        alt={title}
        fill
        priority={active}
        sizes="100vw"
        className="object-cover"
      />

      <div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/20 to-transparent" />

      <div className="absolute bottom-0 p-6 sm:p-8">
        <p className="text-xs uppercase tracking-[0.2em] text-kino-muted">
          {type === "tv" ? "Series" : "Movie"} · {year ?? "TBA"}
        </p>

        <h3 className="text-3xl font-bold text-white">{title}</h3>
      </div>
    </Link>
  );
}
