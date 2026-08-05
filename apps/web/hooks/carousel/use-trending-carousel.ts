"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import type { EmblaCarouselType } from "embla-carousel";

const AUTOPLAY_MS = 6000;
const TWEEN_FACTOR_BASE = 0.85; // how far the image shifts across a slide's travel

export function useTrendingCarousel(slideCount: number) {
  const autoplayRef = useRef(
    Autoplay({
      delay: AUTOPLAY_MS,
      stopOnInteraction: false,
      stopOnMouseEnter: false,
    }),
  );

  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: slideCount > 1, align: "start" },
    [autoplayRef.current],
  );

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [canGoPrev, setCanGoPrev] = useState(false);
  const [canGoNext, setCanGoNext] = useState(false);
  const [progress, setProgress] = useState(0);

  const remainingTimeRef = useRef(AUTOPLAY_MS);
  const timerStartedAtRef = useRef<number | null>(null);
  const pausedRef = useRef(false);

  const tweenFactor = useRef(0);
  const tweenNodes = useRef<HTMLElement[]>([]);

  // --- parallax tween, adapted from the embla example to use refs we set
  // ourselves in CarouselSlide instead of a class-selector query ---
  const setTweenNodes = useCallback((api: EmblaCarouselType) => {
    tweenNodes.current = api
      .slideNodes()
      .map((slideNode) =>
        slideNode.querySelector<HTMLElement>("[data-parallax-layer]")!,
      );
  }, []);

  const setTweenFactor = useCallback((api: EmblaCarouselType) => {
    tweenFactor.current = TWEEN_FACTOR_BASE * api.scrollSnapList().length;
  }, []);

  const tweenParallax = useCallback((api: EmblaCarouselType) => {
    const engine = api.internalEngine();
    const scrollProgress = api.scrollProgress();
    const slidesInView = api.slidesInView();

    api.scrollSnapList().forEach((snap, snapIndex) => {
      let diffToTarget = snap - scrollProgress;
      const slidesInSnap = engine.slideRegistry[snapIndex];
      if (!slidesInSnap) return;

      slidesInSnap.forEach((slideIndex: number) => {
        if (!slidesInView.includes(slideIndex)) return;

        if (engine.options.loop) {
          engine.slideLooper.loopPoints.forEach((loopItem) => {
            const target = loopItem.target();
            if (slideIndex === loopItem.index && target !== 0) {
              const sign = Math.sign(target);
              if (sign === -1) diffToTarget = snap - (1 + scrollProgress);
              if (sign === 1) diffToTarget = snap + (1 - scrollProgress);
            }
          });
        }

        const translate = diffToTarget * -tweenFactor.current * 100;
        const node = tweenNodes.current[slideIndex];
        if (node) node.style.transform = `translateX(${translate}%)`;
      });
    });
  }, []);

  // --- selection / arrow state ---
  const onSelect = useCallback((api: EmblaCarouselType) => {
    setSelectedIndex(api.selectedScrollSnap());
    setCanGoPrev(api.canScrollPrev());
    setCanGoNext(api.canScrollNext());

    remainingTimeRef.current = AUTOPLAY_MS;
    timerStartedAtRef.current = pausedRef.current ? null : performance.now();

    setProgress(0);
  }, []);

  // --- autoplay progress, driven by the plugin's own timer instead of a
  // second requestAnimationFrame loop ---
  useEffect(() => {
    if (!emblaApi) {
      return;
    }

    let frameId = 0;

    timerStartedAtRef.current = performance.now();

    const tick = (now: number) => {
      if (!pausedRef.current && timerStartedAtRef.current !== null) {
        const elapsed = now - timerStartedAtRef.current;
        const remaining = Math.max(remainingTimeRef.current - elapsed, 0);

        setProgress(1 - remaining / AUTOPLAY_MS);
      }

      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [emblaApi]);
  useEffect(() => {
    if (!emblaApi) {
      return;
    }

    const handlePointerDown = () => {
      setProgress(0);
    };

    setTweenNodes(emblaApi);
    setTweenFactor(emblaApi);
    tweenParallax(emblaApi);
    onSelect(emblaApi);

    emblaApi
      .on("reInit", setTweenNodes)
      .on("reInit", setTweenFactor)
      .on("reInit", tweenParallax)
      .on("reInit", onSelect)
      .on("scroll", tweenParallax)
      .on("select", onSelect)
      .on("pointerDown", handlePointerDown);

    return () => {
      emblaApi
        .off("reInit", setTweenNodes)
        .off("reInit", setTweenFactor)
        .off("reInit", tweenParallax)
        .off("reInit", onSelect)
        .off("scroll", tweenParallax)
        .off("select", onSelect)
        .off("pointerDown", handlePointerDown);
    };
  }, [emblaApi, onSelect, setTweenFactor, setTweenNodes, tweenParallax]);

  const scrollTo = useCallback(
    (index: number) => emblaApi?.scrollTo(index),
    [emblaApi],
  );
  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  const resumeTimeoutRef = useRef<number | null>(null);

  const clearResumeTimeout = useCallback(() => {
    if (resumeTimeoutRef.current !== null) {
      window.clearTimeout(resumeTimeoutRef.current);
      resumeTimeoutRef.current = null;
    }
  }, []);

  const pauseAutoplay = useCallback(() => {
    if (pausedRef.current) {
      return;
    }

    clearResumeTimeout();

    const autoplay = autoplayRef.current;
    const timeUntilNext = autoplay.timeUntilNext();

    if (timeUntilNext !== null) {
      remainingTimeRef.current = timeUntilNext;
    } else if (timerStartedAtRef.current !== null) {
      const elapsed = performance.now() - timerStartedAtRef.current;

      remainingTimeRef.current = Math.max(
        remainingTimeRef.current - elapsed,
        0,
      );
    }

    pausedRef.current = true;
    timerStartedAtRef.current = null;
    autoplay.stop();
  }, [clearResumeTimeout]);

  const resumeAutoplay = useCallback(() => {
    if (!pausedRef.current) {
      return;
    }

    clearResumeTimeout();

    pausedRef.current = false;
    timerStartedAtRef.current = performance.now();

    resumeTimeoutRef.current = window.setTimeout(() => {
      resumeTimeoutRef.current = null;

      if (pausedRef.current) {
        return;
      }

      emblaApi?.scrollNext();
      remainingTimeRef.current = AUTOPLAY_MS;
      timerStartedAtRef.current = performance.now();
      autoplayRef.current.play();
    }, remainingTimeRef.current);
  }, [clearResumeTimeout, emblaApi]);

  return {
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
  };
}
