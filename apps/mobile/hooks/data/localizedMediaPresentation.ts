import type { LocalizedMedia } from './useLocalizedMediaData'

type Item = { tmdbId: number; type: 'movie' | 'tv' }

export function resolveLocalizedMediaPresentation(input: {
  data: Record<string, LocalizedMedia | undefined>
  errors: readonly Item[]
  isError: boolean
  missing: readonly Item[]
  request: { tmdb_id: number; type: 'movie' | 'tv' }
  unknownTitle: string
}) {
  const value = input.data[`${input.request.type}:${input.request.tmdb_id}`]
  if (value) return { ...value, status: 'ready' as const }
  const matches = (item: Item) =>
    item.tmdbId === input.request.tmdb_id && item.type === input.request.type
  const status = input.missing.some(matches)
    ? ('missing' as const)
    : input.isError || input.errors.some(matches)
      ? ('error' as const)
      : ('missing' as const)
  return {
    backdrop_path: null,
    poster_path: null,
    status,
    title: input.unknownTitle,
  }
}
