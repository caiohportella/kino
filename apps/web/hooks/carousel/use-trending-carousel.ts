'use client'

import type { EmblaCarouselType } from 'embla-carousel'
import Autoplay from 'embla-carousel-autoplay'
import useEmblaCarousel from 'embla-carousel-react'
import { useCallback, useEffect, useRef, useState } from 'react'

const AUTOPLAY_MS = 6000
const TWEEN_FACTOR_BASE = 0.9

export function useTrendingCarousel(slideCount: number) {
  const autoplayRef = useRef(
    Autoplay({
      delay: AUTOPLAY_MS,
      playOnInit: false,
      stopOnInteraction: false,
      stopOnMouseEnter: false,
    })
  )

  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      loop: slideCount > 1,
      align: 'start',
    },
    [autoplayRef.current]
  )

  const [selectedIndex, setSelectedIndex] = useState(0)
  const [canGoPrev, setCanGoPrev] = useState(false)
  const [canGoNext, setCanGoNext] = useState(false)
  const [progress, setProgress] = useState(0)

  const hasAutoplayStartedRef = useRef(false)
  const remainingTimeRef = useRef(AUTOPLAY_MS)
  const timerStartedAtRef = useRef<number | null>(null)
  const pausedRef = useRef(false)
  const resumeTimeoutRef = useRef<number | null>(null)

  const tweenFactor = useRef(0)
  const tweenNodes = useRef<HTMLElement[]>([])

  const clearResumeTimeout = useCallback(() => {
    if (resumeTimeoutRef.current !== null) {
      window.clearTimeout(resumeTimeoutRef.current)
      resumeTimeoutRef.current = null
    }
  }, [])

  /**
   * Start autoplay from a full interval.
   *
   * If Embla autoplay is already running, reset its timer instead of
   * calling play() again so the plugin and our visual progress remain
   * synchronized.
   */
  const startAutoplay = useCallback(() => {
    if (slideCount <= 1) {
      return
    }

    clearResumeTimeout()

    hasAutoplayStartedRef.current = true
    pausedRef.current = false

    remainingTimeRef.current = AUTOPLAY_MS
    timerStartedAtRef.current = performance.now()

    setProgress(0)

    const autoplay = autoplayRef.current

    if (autoplay.isPlaying()) {
      autoplay.reset()
    } else {
      autoplay.play()
    }
  }, [clearResumeTimeout, slideCount])

  // --- parallax tween ---

  const setTweenNodes = useCallback((api: EmblaCarouselType) => {
    tweenNodes.current = api
      .slideNodes()
      .map((slideNode) => slideNode.querySelector<HTMLElement>('[data-parallax-layer]'))
      .filter((node): node is HTMLElement => node !== null)
  }, [])

  const setTweenFactor = useCallback((api: EmblaCarouselType) => {
    tweenFactor.current = TWEEN_FACTOR_BASE * api.scrollSnapList().length
  }, [])

  const tweenParallax = useCallback((api: EmblaCarouselType) => {
    const engine = api.internalEngine()
    const scrollProgress = api.scrollProgress()
    const slidesInView = api.slidesInView()

    api.scrollSnapList().forEach((snap, snapIndex) => {
      let diffToTarget = snap - scrollProgress
      const slidesInSnap = engine.slideRegistry[snapIndex]

      if (!slidesInSnap) {
        return
      }

      slidesInSnap.forEach((slideIndex: number) => {
        if (!slidesInView.includes(slideIndex)) {
          return
        }

        if (engine.options.loop) {
          engine.slideLooper.loopPoints.forEach((loopItem) => {
            const target = loopItem.target()

            if (slideIndex === loopItem.index && target !== 0) {
              const sign = Math.sign(target)

              if (sign === -1) {
                diffToTarget = snap - (1 + scrollProgress)
              }

              if (sign === 1) {
                diffToTarget = snap + (1 - scrollProgress)
              }
            }
          })
        }

        const translate = diffToTarget * -tweenFactor.current * 100

        const node = tweenNodes.current[slideIndex]

        if (node) {
          node.style.transform = `translateX(${translate}%)`
        }
      })
    })
  }, [])

  // --- selection / arrow state ---

  const onSelect = useCallback((api: EmblaCarouselType) => {
    setSelectedIndex(api.selectedScrollSnap())
    setCanGoPrev(api.canScrollPrev())
    setCanGoNext(api.canScrollNext())

    remainingTimeRef.current = AUTOPLAY_MS

    timerStartedAtRef.current =
      hasAutoplayStartedRef.current && !pausedRef.current ? performance.now() : null

    setProgress(0)
  }, [])

  // --- visual autoplay progress ---

  useEffect(() => {
    if (!emblaApi || slideCount <= 1) {
      return
    }

    let frameId = 0

    const tick = (now: number) => {
      if (!pausedRef.current && timerStartedAtRef.current !== null) {
        const elapsed = now - timerStartedAtRef.current

        const remaining = Math.max(remainingTimeRef.current - elapsed, 0)

        const nextProgress = 1 - remaining / AUTOPLAY_MS

        setProgress(Math.max(0, Math.min(1, nextProgress)))
      }

      frameId = requestAnimationFrame(tick)
    }

    frameId = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frameId)
    }
  }, [emblaApi, slideCount])

  // --- Embla lifecycle / listeners ---

  useEffect(() => {
    if (!emblaApi) {
      return
    }

    const handlePointerDown = () => {
      // User interaction restarts the autoplay countdown.
      startAutoplay()
    }

    setTweenNodes(emblaApi)
    setTweenFactor(emblaApi)
    tweenParallax(emblaApi)
    onSelect(emblaApi)

    emblaApi
      .on('reInit', setTweenNodes)
      .on('reInit', setTweenFactor)
      .on('reInit', tweenParallax)
      .on('reInit', onSelect)
      .on('scroll', tweenParallax)
      .on('select', onSelect)
      .on('pointerDown', handlePointerDown)

    /**
     * Important:
     * Start autoplay only after Embla and our listeners are ready.
     *
     * This is what makes slide 1's progress indicator start
     * immediately on the initial page load.
     */
    startAutoplay()

    return () => {
      clearResumeTimeout()

      autoplayRef.current.stop()

      hasAutoplayStartedRef.current = false
      pausedRef.current = false
      timerStartedAtRef.current = null

      emblaApi
        .off('reInit', setTweenNodes)
        .off('reInit', setTweenFactor)
        .off('reInit', tweenParallax)
        .off('reInit', onSelect)
        .off('scroll', tweenParallax)
        .off('select', onSelect)
        .off('pointerDown', handlePointerDown)
    }
  }, [
    clearResumeTimeout,
    emblaApi,
    onSelect,
    setTweenFactor,
    setTweenNodes,
    startAutoplay,
    tweenParallax,
  ])

  // --- manual navigation ---

  const scrollPrev = useCallback(() => {
    emblaApi?.scrollPrev()
    startAutoplay()
  }, [emblaApi, startAutoplay])

  const scrollNext = useCallback(() => {
    emblaApi?.scrollNext()
    startAutoplay()
  }, [emblaApi, startAutoplay])

  const scrollTo = useCallback(
    (index: number) => {
      emblaApi?.scrollTo(index)
      startAutoplay()
    },
    [emblaApi, startAutoplay]
  )

  // --- pause / resume ---

  const pauseAutoplay = useCallback(() => {
    if (!hasAutoplayStartedRef.current || pausedRef.current) {
      return
    }

    clearResumeTimeout()

    const autoplay = autoplayRef.current
    const timeUntilNext = autoplay.timeUntilNext()

    if (timeUntilNext !== null) {
      remainingTimeRef.current = timeUntilNext
    } else if (timerStartedAtRef.current !== null) {
      const elapsed = performance.now() - timerStartedAtRef.current

      remainingTimeRef.current = Math.max(remainingTimeRef.current - elapsed, 0)
    }

    pausedRef.current = true
    timerStartedAtRef.current = null

    autoplay.stop()
  }, [clearResumeTimeout])

  const resumeAutoplay = useCallback(() => {
    if (!hasAutoplayStartedRef.current || !pausedRef.current) {
      return
    }

    clearResumeTimeout()

    pausedRef.current = false
    timerStartedAtRef.current = performance.now()

    /**
     * Embla v8 has stop/play but not a true pause that preserves
     * remaining time, so keep the remaining countdown ourselves.
     */
    resumeTimeoutRef.current = window.setTimeout(() => {
      resumeTimeoutRef.current = null

      if (pausedRef.current) {
        return
      }

      emblaApi?.scrollNext()

      remainingTimeRef.current = AUTOPLAY_MS
      timerStartedAtRef.current = performance.now()

      const autoplay = autoplayRef.current

      if (autoplay.isPlaying()) {
        autoplay.reset()
      } else {
        autoplay.play()
      }
    }, remainingTimeRef.current)
  }, [clearResumeTimeout, emblaApi])

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
  }
}
