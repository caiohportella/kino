import type { MediaType, SearchMediaType, TMDbTitle } from '@kino/core'

import {
  type LocalizedAliasInput,
  type LocalizedTitleAliases,
  mergeLocalizedTitleAliases,
} from './localized-aliases.ts'

export interface TitleSearchDocument {
  readonly id: string
  readonly entityType: SearchMediaType
  readonly mediaType: SearchMediaType
  readonly tmdbId: number
  readonly title: string
  readonly originalTitle: string
  readonly aliases: string
  readonly localizedTitles: LocalizedTitleAliases
  readonly overview: string
  readonly year?: number
  readonly popularity?: number
  readonly voteAverage?: number
  readonly voteCount?: number
  readonly posterPath?: string | null
  readonly backdropPath?: string | null
}

export interface TitleDocumentInput {
  readonly tmdbId: number
  readonly type?: MediaType | SearchMediaType | null
  readonly mediaType?: MediaType | SearchMediaType | null
  readonly title?: string | null
  readonly originalTitle?: string | null
  readonly name?: string | null
  readonly originalName?: string | null
  readonly overview?: string | null
  readonly aliases?: readonly (string | null | undefined)[]
  readonly localizedTitles?: LocalizedAliasInput
  readonly year?: number | null
  readonly popularity?: number | null
  readonly voteAverage?: number | null
  readonly voteCount?: number | null
  readonly posterPath?: string | null
  readonly backdropPath?: string | null
}

function normalizeText(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/gu, ' ') : ''
}

function joinText(values: readonly (string | null | undefined)[]): string {
  const unique = new Set(values.map(normalizeText).filter(Boolean))
  return [...unique].join(' ')
}

export function toSearchMediaType(type: MediaType | SearchMediaType): SearchMediaType {
  return type === 'tv' || type === 'series' ? 'series' : 'movie'
}

function valueOrNull(input: TitleDocumentInput): MediaType | SearchMediaType | null {
  return input.type ?? input.mediaType ?? null
}

export function normalizeTitleDocument(input: TitleDocumentInput): TitleSearchDocument | null {
  const tmdbId = Number.isInteger(input.tmdbId) && input.tmdbId > 0 ? input.tmdbId : 0
  const rawType = valueOrNull(input)
  const mediaType = rawType ? toSearchMediaType(rawType) : null
  const title = normalizeText(
    input.title ?? input.name ?? input.originalTitle ?? input.originalName
  )
  if (!tmdbId || !mediaType || !title) return null

  const originalTitle = normalizeText(
    input.originalTitle ?? input.originalName ?? input.title ?? input.name
  )
  return {
    id: `title:${mediaType}:${tmdbId}`,
    entityType: mediaType,
    mediaType,
    tmdbId,
    title,
    originalTitle: originalTitle || title,
    aliases: joinText(input.aliases ?? []),
    localizedTitles: mergeLocalizedTitleAliases(input.localizedTitles ?? {}),
    overview: normalizeText(input.overview),
    ...(input.year == null ? {} : { year: input.year }),
    ...(input.popularity == null ? {} : { popularity: input.popularity }),
    ...(input.voteAverage == null ? {} : { voteAverage: input.voteAverage }),
    ...(input.voteCount == null ? {} : { voteCount: input.voteCount }),
    ...(input.posterPath === undefined ? {} : { posterPath: input.posterPath }),
    ...(input.backdropPath === undefined ? {} : { backdropPath: input.backdropPath }),
  }
}

export function titleDocumentFromTmdb(input: {
  readonly type: MediaType | SearchMediaType
  readonly title: TMDbTitle
  readonly originalTitle?: string | null
  readonly originalName?: string | null
  readonly aliases?: readonly string[]
  readonly localizedTitles?: LocalizedAliasInput
  readonly genreNames?: readonly unknown[]
  readonly cast?: readonly unknown[]
  readonly creators?: readonly unknown[]
  readonly directors?: readonly unknown[]
  readonly keywords?: readonly string[]
}): TitleSearchDocument | null {
  const type = toSearchMediaType(input.type)
  const title = input.title
  const raw = title as TMDbTitle & {
    readonly popularity?: number
    readonly first_air_date?: string
    readonly name?: string
    readonly original_title?: string
    readonly original_name?: string
  }
  const date = type === 'movie' ? raw.release_date : raw.first_air_date
  const parsedYear = date ? Number(date.slice(0, 4)) : NaN
  return normalizeTitleDocument({
    tmdbId: title.id,
    type,
    title: title.title ?? title.name,
    name: title.name,
    originalTitle: input.originalTitle ?? raw.original_title,
    originalName: input.originalName ?? raw.original_name,
    overview: title.overview,
    aliases: input.aliases,
    localizedTitles: input.localizedTitles,
    year: Number.isFinite(parsedYear) ? parsedYear : null,
    popularity:
      typeof raw.popularity === 'number' && Number.isFinite(raw.popularity) ? raw.popularity : null,
    voteAverage: title.vote_average,
    voteCount: title.vote_count,
    posterPath: title.poster_path,
    backdropPath: title.backdrop_path,
  })
}
