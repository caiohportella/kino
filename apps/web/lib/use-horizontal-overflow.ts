'use client'

import { type RefObject, useLayoutEffect, useState } from 'react'

export const HORIZONTAL_OVERFLOW_EPSILON = 1

export function hasHorizontalOverflow(
  viewport: Pick<HTMLElement, 'scrollWidth' | 'clientWidth'>,
  epsilon = HORIZONTAL_OVERFLOW_EPSILON
) {
  return viewport.scrollWidth > viewport.clientWidth + epsilon
}

export function useHorizontalOverflow<T extends HTMLElement>(
  viewportRef: RefObject<T | null>,
  enabled = true
) {
  const [hasOverflow, setHasOverflow] = useState(false)

  useLayoutEffect(() => {
    if (!enabled) {
      setHasOverflow(false)
      return
    }

    const viewport = viewportRef.current
    if (!viewport) return
    const track = viewport.firstElementChild

    const measure = () => {
      setHasOverflow(hasHorizontalOverflow(viewport))
    }

    measure()
    const resizeObserver = new ResizeObserver(measure)
    resizeObserver.observe(viewport)
    if (track instanceof HTMLElement) resizeObserver.observe(track)

    const mutationObserver = new MutationObserver(measure)
    mutationObserver.observe(viewport, { childList: true, subtree: true })

    const fontsReady = document.fonts?.ready.then(measure)
    return () => {
      resizeObserver.disconnect()
      mutationObserver.disconnect()
      void fontsReady
    }
  }, [enabled, viewportRef])

  return hasOverflow
}
