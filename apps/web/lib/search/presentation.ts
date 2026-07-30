import type { SearchResult, TMDbTitle } from '@kino/core'
import {
  getLocalizedPersonDepartment,
  type LocalizedPersonDepartmentLabels,
  type SearchResponse,
  toSearchTitleCardModel,
} from '@kino/core/search'

export const SEARCH_CARD_MIN_WIDTH_PX = 148
export const SEARCH_CARD_GAP_PX = 20
export const SEARCH_RESULTS_MAX_WIDTH_PX = 1320

export function searchSkeletonCapacity({
  cardWidth,
  containerWidth,
  gap,
  padding,
  rows,
}: {
  readonly cardWidth: number
  readonly containerWidth: number
  readonly gap: number
  readonly padding: number
  readonly rows: number
}): number {
  const usableWidth = Math.max(0, containerWidth - padding * 2)
  const columns = Math.max(1, Math.floor((usableWidth + gap) / (cardWidth + gap)))
  return columns * Math.max(1, Math.floor(rows))
}

export function resolveSearchDisplayRating(
  tmdbVoteAverage: number | null | undefined
): number | null | undefined {
  return typeof tmdbVoteAverage === 'number' && Number.isFinite(tmdbVoteAverage)
    ? tmdbVoteAverage
    : tmdbVoteAverage
}

export function toWebSearchGroups(
  response: SearchResponse,
  options: { readonly departmentLabels: LocalizedPersonDepartmentLabels }
) {
  const groups = {
    movies: [] as SearchResult[],
    series: [] as SearchResult[],
    people: [] as SearchResult[],
    users: [] as SearchResult[],
  }
  for (const group of response.groups) {
    for (const result of group.results) {
      const entity = result.entity
      if ((entity.entityType === 'movie' || entity.entityType === 'series') && entity.tmdbId) {
        const v2Entity = entity as typeof entity & {
          readonly tmdbVoteAverage?: number | null
        }
        const model = toSearchTitleCardModel(result, {
          displayRating: resolveSearchDisplayRating(v2Entity.tmdbVoteAverage),
          localizedPoster: entity.imageUrl ?? null,
          localizedTitle: entity.title,
        })
        const mediaType = model.mediaType === 'series' ? 'tv' : 'movie'
        const media = {
          id: model.id,
          backdrop_path: null,
          genre_ids: [],
          media_type: mediaType,
          name: mediaType === 'tv' ? model.localizedTitle : undefined,
          overview: model.semanticContext ?? '',
          poster_path: model.localizedPoster,
          release_date:
            mediaType === 'movie' && model.releaseYear ? `${model.releaseYear}-01-01` : '',
          first_air_date:
            mediaType === 'tv' && model.releaseYear ? `${model.releaseYear}-01-01` : '',
          title: mediaType === 'movie' ? model.localizedTitle : undefined,
          ...(model.displayRating === undefined ? {} : { vote_average: model.displayRating }),
          vote_count: entity.voteCount ?? 0,
        } as TMDbTitle
        groups[model.mediaType === 'series' ? 'series' : 'movies'].push({
          kind: 'title',
          id: model.id,
          imagePath: model.localizedPoster,
          media,
          mediaType,
          name: model.localizedTitle,
          ...(model.releaseYear === undefined ? {} : { year: model.releaseYear }),
        })
      } else if (entity.entityType === 'person') {
        const id = entity.tmdbId ?? Number(entity.id.replace(/\D+/gu, ''))
        if (!Number.isSafeInteger(id) || id <= 0) continue
        groups.people.push({
          kind: 'person',
          id,
          avatarUrl: entity.imageUrl ?? null,
          backgroundUrl: entity.imageUrl ?? null,
          name: entity.title,
          summary: getLocalizedPersonDepartment(entity.summary, options.departmentLabels),
        })
      } else if (entity.entityType === 'user') {
        const username = entity.route?.split('/').filter(Boolean).at(-1)
        if (!username) continue
        groups.users.push({
          kind: 'user',
          id: entity.id,
          avatarUrl: entity.imageUrl ?? null,
          backgroundUrl: entity.imageUrl ?? null,
          name: entity.title,
          username,
        })
      }
    }
  }
  return {
    groups,
    failed: { movies: false, people: false, series: false, users: false },
    nextPage: response.nextPage,
  }
}
