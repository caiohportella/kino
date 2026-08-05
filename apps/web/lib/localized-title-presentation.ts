import type {
  LocalizedTitleMap,
  LocalizedTitleRequest,
  LocalizedTitleValue,
} from './use-localized-titles'

type Item = { tmdbId: number; type: 'movie' | 'tv' }

export function resolveLocalizedTitlePresentation(input: {
  data: LocalizedTitleMap
  errors: readonly Item[]
  isError: boolean
  missing: readonly Item[]
  request: LocalizedTitleRequest
  unknownTitle: string
}): LocalizedTitleValue & { status: 'ready' | 'missing' | 'error' } {
  const value = input.data[`${input.request.type}:${input.request.tmdbId}`]
  if (value) return { ...value, status: 'ready' }
  const matches = (item: Item) =>
    item.tmdbId === input.request.tmdbId && item.type === input.request.type
  const status: 'missing' | 'error' = input.missing.some(matches)
    ? 'missing'
    : input.isError || input.errors.some(matches)
      ? 'error'
      : 'missing'
  return {
    backdropPath: null,
    posterPath: null,
    status,
    title: input.unknownTitle,
    year: null,
  }
}
