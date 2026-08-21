import {
  DISCOVER_MAX_PERSONALIZED_RAILS,
  type PersonalizedDiscoverRail,
} from './personalization.ts'

type PopularItem = {
  id: number
  media_type?: string
  popularity?: number
}

export function mergePopularNow<T extends PopularItem>(
  movies: T[],
  series: T[],
  limit = 20
): T[] {
  const seen = new Set<string>()

  return [...movies, ...series]
    .sort(
      (a, b) =>
        (b.popularity ?? 0) - (a.popularity ?? 0)
    )
    .filter((item) => {
      const key = `${item.media_type ?? 'unknown'}:${item.id}`

      if (seen.has(key)) {
        return false
      }

      seen.add(key)

      return true
    })
    .slice(0, limit)
}

export const DISCOVER_MIN_PERSONALIZED_RESULTS = 8

export function resolveDiscoverPrimaryRow<T>(
  personalized: T[],
  popular: T[],
  minimumPersonalizedResults =
    DISCOVER_MIN_PERSONALIZED_RESULTS
) {
  if (
    personalized.length >= minimumPersonalizedResults
  ) {
    return {
      kind: 'for-you' as const,
      items: personalized,
    }
  }

  return {
    kind: 'popular' as const,
    items: popular,
  }
}

export function getVisibleDiscoverPersonalizedRails(
  rails: PersonalizedDiscoverRail[],
  limit = DISCOVER_MAX_PERSONALIZED_RAILS
) {
  const normalizedLimit = Math.max(
    0,
    Math.floor(limit)
  )

  if (normalizedLimit === 0) {
    return []
  }

  return rails
    .filter((rail) => rail.items.length > 0)
    .slice(0, normalizedLimit)
}
