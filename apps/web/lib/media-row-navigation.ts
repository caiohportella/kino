export const MEDIA_ROW_SCROLL_EPSILON = 2

type MediaRowScrollMetrics = {
  clientWidth: number
  scrollLeft: number
  scrollWidth: number
}

export function getMediaRowNavigationState(
  { clientWidth, scrollLeft, scrollWidth }: MediaRowScrollMetrics,
  epsilon = MEDIA_ROW_SCROLL_EPSILON
) {
  const maxScrollLeft = Math.max(0, scrollWidth - clientWidth)
  const normalizedScrollLeft = Math.max(0, scrollLeft)

  const hasOverflow = maxScrollLeft > epsilon

  return {
    hasOverflow,
    canScrollPrev: hasOverflow && normalizedScrollLeft > epsilon,
    canScrollNext: hasOverflow && normalizedScrollLeft < maxScrollLeft - epsilon,
  }
}

export function getMediaRowScrollDistance(clientWidth: number) {
  return Math.max(1, Math.floor(clientWidth * 0.9))
}
