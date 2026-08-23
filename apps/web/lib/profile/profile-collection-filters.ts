export type ProfileCollectionFilterState = {
  query: string
  rating: string
  watchType: string
  year: string
  decade: string
  genre: string
  minTmdbRating: string
  sort: string
  page: number
}

export const DEFAULT_PROFILE_COLLECTION_FILTERS: ProfileCollectionFilterState = {
  query: '',
  rating: 'any',
  watchType: 'any',
  year: 'any',
  decade: 'any',
  genre: 'any',
  minTmdbRating: 'any',
  sort: 'watched-desc',
  page: 1,
}

export function countActiveProfileCollectionFilters(filters: ProfileCollectionFilterState) {
  let count = 0

  if (filters.query.trim()) count += 1
  if (filters.rating !== 'any') count += 1
  if (filters.watchType !== 'any') count += 1
  if (filters.year !== 'any') count += 1
  if (filters.decade !== 'any') count += 1
  if (filters.genre !== 'any') count += 1
  if (filters.minTmdbRating !== 'any') count += 1

  return count
}

export function parseProfileCollectionFilters(
  searchParams: URLSearchParams
): ProfileCollectionFilterState {
  const page = Number(searchParams.get('page'))

  return {
    query: searchParams.get('q')?.trim() ?? '',
    rating: searchParams.get('rating') ?? 'any',
    watchType: searchParams.get('watchType') ?? 'any',
    year: searchParams.get('year') ?? 'any',
    decade: searchParams.get('decade') ?? 'any',
    genre: searchParams.get('genre') ?? 'any',
    minTmdbRating: searchParams.get('tmdbRating') ?? 'any',
    sort: searchParams.get('sort') ?? 'watched-desc',
    page: Number.isInteger(page) && page > 0 ? page : 1,
  }
}

export function serializeProfileCollectionFilters(filters: ProfileCollectionFilterState) {
  const params = new URLSearchParams()

  if (filters.query) params.set('q', filters.query)
  if (filters.rating !== 'any') params.set('rating', filters.rating)
  if (filters.watchType !== 'any') params.set('watchType', filters.watchType)
  if (filters.year !== 'any') params.set('year', filters.year)
  if (filters.decade !== 'any') params.set('decade', filters.decade)
  if (filters.genre !== 'any') params.set('genre', filters.genre)
  if (filters.minTmdbRating !== 'any') {
    params.set('tmdbRating', filters.minTmdbRating)
  }
  if (filters.sort !== 'watched-desc') params.set('sort', filters.sort)
  if (filters.page > 1) params.set('page', String(filters.page))

  return params
}

type ProfileCollectionWatchEvent = {
  watchedAt: string
  watchType: string
}

type ProfileCollectionFilterItem = {
  id: string
  tmdbId: number
  title: string
  originalTitle?: string | null
  watchEvents: ProfileCollectionWatchEvent[]
  seriesPasses: Array<{
    passNumber: number
    completedAt: string
  }>
  userRating: number | null
  tmdbRating: number | null
  releaseYear: number | null
  latestWatchedAt: string | null
  latestActivityAt: string | null
  watchCount: number
  averageRating: number | null
  ratingCount: number
  runtimeMinutes: number | null
  genres: Array<{
    id: number
    name: string
  }>
}

export function filterAndSortProfileCollection<T extends ProfileCollectionFilterItem>(
  items: T[],
  filters: ProfileCollectionFilterState,
  mediaType: 'movie' | 'tv',
  localizedTmdbIds: ReadonlySet<number> = new Set<number>()
): T[] {
  let filtered = items

  const shouldFilterWatchType = filters.watchType !== 'any'
  const shouldFilterYear = filters.year !== 'any'

  if (mediaType === 'movie' && (shouldFilterWatchType || shouldFilterYear)) {
    filtered = filtered.filter((item) =>
      item.watchEvents.some((event) => {
        if (shouldFilterWatchType && event.watchType !== filters.watchType) {
          return false
        }

        if (shouldFilterYear && event.watchedAt.slice(0, 4) !== filters.year) {
          return false
        }

        return true
      })
    )
  }

  if (mediaType === 'tv' && (shouldFilterWatchType || shouldFilterYear)) {
    filtered = filtered.filter((item) => {
      let qualifyingPasses = item.seriesPasses

      if (shouldFilterWatchType) {
        if (filters.watchType === 'first-time') {
          qualifyingPasses = qualifyingPasses.filter((pass) => pass.passNumber === 1)
        } else if (filters.watchType === 'rewatch') {
          qualifyingPasses = qualifyingPasses.filter((pass) => pass.passNumber >= 2)
        }
      }

      if (shouldFilterYear) {
        qualifyingPasses = qualifyingPasses.filter(
          (pass) => pass.completedAt.slice(0, 4) === filters.year
        )
      }

      return qualifyingPasses.length > 0
    })
  }

  if (filters.minTmdbRating !== 'any') {
    const minimumRating = Number(filters.minTmdbRating)

    filtered = filtered.filter(
      (item) => item.tmdbRating !== null && item.tmdbRating >= minimumRating
    )
  }

  if (filters.rating !== 'any') {
    const rating = Number(filters.rating)

    filtered = filtered.filter((item) => item.userRating !== null && item.userRating === rating)
  }

  if (filters.decade !== 'any') {
    const decade = Number(filters.decade)

    filtered = filtered.filter(
      (item) => item.releaseYear !== null && Math.floor(item.releaseYear / 10) * 10 === decade
    )
  }

  if (filters.genre !== 'any') {
    const genreId = Number(filters.genre)

    filtered = filtered.filter((item) => item.genres.some((genre) => genre.id === genreId))
  }

  if (filters.query) {
    const query = filters.query.toLowerCase()

    filtered = filtered.filter((item) => {
      const title = item.title.toLowerCase()
      const originalTitle = item.originalTitle?.toLowerCase()

      return (
        title.includes(query) ||
        originalTitle?.includes(query) === true ||
        localizedTmdbIds.has(item.tmdbId)
      )
    })
  }

  const sorted = [...filtered]
  const direction = filters.sort.endsWith('-asc') ? 1 : -1

  const compareText = (left: string, right: string) => left.localeCompare(right) * direction

  const compareNumber = (left: number, right: number) => (left - right) * direction

  const timestamp = (value: string | null) => (value ? new Date(value).getTime() : 0)

  sorted.sort((left, right) => {
    let result = 0

    if (filters.sort.startsWith('watched-')) {
      result = compareNumber(timestamp(left.latestWatchedAt), timestamp(right.latestWatchedAt))
    } else if (filters.sort.startsWith('activity-')) {
      result = compareNumber(timestamp(left.latestActivityAt), timestamp(right.latestActivityAt))
    } else if (filters.sort.startsWith('count-')) {
      result = compareNumber(left.watchCount, right.watchCount)
    } else if (filters.sort.startsWith('popularity-')) {
      result = compareNumber(left.ratingCount, right.ratingCount)
    } else if (filters.sort.startsWith('title-')) {
      result = compareText(left.title, right.title)
    } else if (filters.sort.startsWith('release-')) {
      result = compareNumber(left.releaseYear ?? 0, right.releaseYear ?? 0)
    } else if (filters.sort.startsWith('average-')) {
      result = compareNumber(left.averageRating ?? 0, right.averageRating ?? 0)
    } else if (filters.sort.startsWith('rating-')) {
      result = compareNumber(left.userRating ?? 0, right.userRating ?? 0)
    } else if (filters.sort.startsWith('runtime-')) {
      result = compareNumber(left.runtimeMinutes ?? 0, right.runtimeMinutes ?? 0)
    }

    if (result !== 0) {
      return result
    }

    const watchedTieBreak = timestamp(right.latestWatchedAt) - timestamp(left.latestWatchedAt)

    return watchedTieBreak !== 0 ? watchedTieBreak : left.id.localeCompare(right.id)
  })

  return sorted
}

export function paginateProfileCollection<T>(items: T[], page: number, pageSize: number) {
  const totalItems = items.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const clampedPage = Math.min(Math.max(page, 1), totalPages)
  const start = (clampedPage - 1) * pageSize

  return {
    items: items.slice(start, start + pageSize),
    page: clampedPage,
    totalItems,
    totalPages,
  }
}
