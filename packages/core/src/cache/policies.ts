const HOUR_IN_MILLISECONDS = 60 * 60 * 1000
const DAY_IN_MILLISECONDS = 24 * HOUR_IN_MILLISECONDS

const MINUTE_IN_MILLISECONDS = 60 * 1000

export const LOCALIZED_TITLE_STALE_TIME = DAY_IN_MILLISECONDS
export const LOCALIZED_TITLE_GC_TIME = 7 * DAY_IN_MILLISECONDS

export interface QueryCachePolicy {
  readonly gcTime: number
  readonly staleTime: number
}

export const activityCachePolicies = {
  feed: {
    staleTime: MINUTE_IN_MILLISECONDS,
    gcTime: 5 * MINUTE_IN_MILLISECONDS,
  },
} as const satisfies Record<string, QueryCachePolicy>

export const profileCachePolicies = {
  usernameResolution: {
    staleTime: 5 * MINUTE_IN_MILLISECONDS,
    gcTime: HOUR_IN_MILLISECONDS,
  },
  identity: {
    staleTime: 5 * MINUTE_IN_MILLISECONDS,
    gcTime: HOUR_IN_MILLISECONDS,
  },
  relationship: {
    staleTime: MINUTE_IN_MILLISECONDS,
    gcTime: 15 * MINUTE_IN_MILLISECONDS,
  },
  watchedMovies: {
    staleTime: 5 * MINUTE_IN_MILLISECONDS,
    gcTime: HOUR_IN_MILLISECONDS,
  },
  watchedSeries: {
    staleTime: 5 * MINUTE_IN_MILLISECONDS,
    gcTime: HOUR_IN_MILLISECONDS,
  },
  statistics: {
    staleTime: 5 * MINUTE_IN_MILLISECONDS,
    gcTime: HOUR_IN_MILLISECONDS,
  },
  watchlists: {
    staleTime: 5 * MINUTE_IN_MILLISECONDS,
    gcTime: HOUR_IN_MILLISECONDS,
  },
  reviews: {
    staleTime: 5 * MINUTE_IN_MILLISECONDS,
    gcTime: HOUR_IN_MILLISECONDS,
  },
  ratings: {
    staleTime: 5 * MINUTE_IN_MILLISECONDS,
    gcTime: HOUR_IN_MILLISECONDS,
  },
  availability: {
    staleTime: 6 * HOUR_IN_MILLISECONDS,
    gcTime: DAY_IN_MILLISECONDS,
  },
} as const satisfies Record<string, QueryCachePolicy>
