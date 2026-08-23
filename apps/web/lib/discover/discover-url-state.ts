import type { TMDbGenre } from '@kino/core'
import {
  type DiscoverCollection,
  type DiscoverCollectionId,
  parseDiscoverCollection,
} from './collections.ts'

export type DiscoverUrlFilterState = {
  mediaType: 'all' | 'movie' | 'tv'
  genreIds: number[]
  minRating: number
}

export type DiscoverUrlState = {
  collection: DiscoverCollection | null
  filters: DiscoverUrlFilterState
}

const DEFAULT_FILTERS: DiscoverUrlFilterState = {
  mediaType: 'all',
  genreIds: [],
  minRating: 0,
}

function normalizeMediaType(value: string | null): DiscoverUrlFilterState['mediaType'] {
  if (value === 'movie' || value === 'tv') {
    return value
  }

  return 'all'
}

function normalizeGenreIds(values: number[]) {
  return [...new Set(values.filter((value) => Number.isInteger(value) && value > 0))].sort(
    (a, b) => a - b
  )
}

function normalizeMinimumRating(value: number) {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.min(10, Math.max(0, value))
}

function parseGenres(value: string | null, genres: TMDbGenre[]) {
  if (!value) {
    return []
  }

  const validGenreIds = new Set(genres.map((genre) => genre.id))

  return normalizeGenreIds(
    value
      .split(',')
      .map((item) => Number(item))
      .filter((id) => Number.isFinite(id) && validGenreIds.has(id))
  )
}

function parseMinimumRating(value: string | null) {
  if (!value) {
    return 0
  }

  return normalizeMinimumRating(Number(value))
}

/**
 * Normalizes Discover filters independently of
 * franchise collections.
 *
 * The optional collection argument is retained so
 * existing callers can migrate without coupling
 * filter behavior to collection membership.
 */
export function normalizeDiscoverFilterState(
  filters: DiscoverUrlFilterState,
  _collection?: DiscoverCollection | null
): DiscoverUrlFilterState {
  return {
    mediaType: normalizeMediaType(filters.mediaType),

    genreIds: normalizeGenreIds(filters.genreIds),

    minRating: normalizeMinimumRating(filters.minRating),
  }
}

export function readDiscoverUrlState(
  params: URLSearchParams,
  genres: TMDbGenre[]
): DiscoverUrlState {
  const collection = parseDiscoverCollection(params.get('collection'))

  /*
   * Collections and filters are now separate
   * browsing modes.
   *
   * A franchise collection always starts with
   * neutral filters.
   */
  if (collection) {
    return {
      collection,
      filters: {
        ...DEFAULT_FILTERS,
      },
    }
  }

  const filters = normalizeDiscoverFilterState({
    mediaType: normalizeMediaType(params.get('type')),

    genreIds: parseGenres(params.get('genres'), genres),

    minRating: parseMinimumRating(params.get('rating')),
  })

  return {
    collection: null,
    filters,
  }
}

export function writeDiscoverCollectionUrl(
  currentParams: URLSearchParams,
  collectionId: DiscoverCollectionId | null
): string {
  const params = new URLSearchParams(currentParams)

  /*
   * Numbered pagination belonged to the old
   * collection implementation.
   */
  params.delete('page')

  if (!collectionId) {
    params.delete('collection')

    return params.toString()
  }

  /*
   * Franchise collections are their own browsing
   * mode, so ordinary Discover filters do not
   * carry into them.
   */
  params.set('collection', collectionId)

  params.delete('type')
  params.delete('genres')
  params.delete('rating')

  return params.toString()
}

export function writeDiscoverFilterUrl(
  currentParams: URLSearchParams,
  filters: DiscoverUrlFilterState,
  _collection?: DiscoverCollection | null
): URLSearchParams {
  const params = new URLSearchParams(currentParams)

  const normalized = normalizeDiscoverFilterState(filters)

  /*
   * Applying ordinary filters exits collection
   * mode. The two concepts no longer compose.
   */
  params.delete('collection')
  params.delete('page')

  if (normalized.mediaType === 'all') {
    params.delete('type')
  } else {
    params.set('type', normalized.mediaType)
  }

  if (normalized.genreIds.length === 0) {
    params.delete('genres')
  } else {
    params.set('genres', normalized.genreIds.join(','))
  }

  if (normalized.minRating <= 0) {
    params.delete('rating')
  } else {
    params.set('rating', String(normalized.minRating))
  }

  return params
}
