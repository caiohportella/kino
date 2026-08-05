import {
  getLocalizedPersonDepartment,
  type LocalizedPersonDepartmentLabels,
  type SearchResultV1,
  type SearchResultV2,
  toSearchTitleCardModel,
} from '@kino/core/search'
import type { TMDbTitle } from '~/types'

export function toMobileSearchTitle(result: SearchResultV1 | SearchResultV2): TMDbTitle {
  const entity = result.entity as typeof result.entity & {
    readonly tmdbVoteAverage?: number | null
  }
  const model = toSearchTitleCardModel(result, {
    displayRating: entity.tmdbVoteAverage,
    localizedPoster: entity.imageUrl ?? null,
    localizedTitle: entity.title,
  })
  const mediaType = model.mediaType === 'series' ? 'tv' : 'movie'
  return {
    id: model.id,
    backdrop_path: null,
    genre_ids: [],
    media_type: mediaType,
    name: mediaType === 'tv' ? model.localizedTitle : undefined,
    overview: model.semanticContext ?? '',
    poster_path: model.localizedPoster,
    release_date: mediaType === 'movie' && model.releaseYear ? `${model.releaseYear}-01-01` : '',
    first_air_date: mediaType === 'tv' && model.releaseYear ? `${model.releaseYear}-01-01` : '',
    title: mediaType === 'movie' ? model.localizedTitle : undefined,
    ...(model.displayRating === undefined ? {} : { vote_average: model.displayRating }),
    vote_count: entity.voteCount ?? 0,
  } as TMDbTitle
}

export function mobilePersonDepartment(
  department: string | null | undefined,
  labels: LocalizedPersonDepartmentLabels
): string {
  return getLocalizedPersonDepartment(department, labels)
}
