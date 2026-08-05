import type { SearchResultV1, SearchResultV2 } from './types.ts'

export interface SearchTitleCardPresentationInput {
  readonly localizedTitle: string
  readonly localizedPoster: string | null
  /**
   * The application-resolved card rating. Shared presentation transports this
   * value unchanged and never derives it from relevance.
   */
  readonly displayRating?: number | null
}

export interface SearchTitleCardModel {
  readonly id: number
  readonly mediaType: 'movie' | 'series'
  readonly localizedTitle: string
  readonly localizedPoster: string | null
  readonly releaseYear?: number
  readonly route: string
  readonly semanticContext?: string
  readonly semanticRelevance: number
  readonly tmdbVoteAverage?: number | null
  readonly kinoAverageRating?: number | null
  readonly displayRating?: number | null
}

export interface LocalizedPersonDepartmentLabels {
  readonly acting: string
  readonly art: string
  readonly camera: string
  readonly costumeAndMakeUp: string
  readonly creator: string
  readonly crew: string
  readonly directing: string
  readonly editing: string
  readonly fallback: string
  readonly lighting: string
  readonly production: string
  readonly sound: string
  readonly visualEffects: string
  readonly writing: string
}

const departmentKeys: Readonly<Record<string, keyof LocalizedPersonDepartmentLabels>> = {
  acting: 'acting',
  art: 'art',
  camera: 'camera',
  'costume & make-up': 'costumeAndMakeUp',
  creator: 'creator',
  creating: 'creator',
  crew: 'crew',
  directing: 'directing',
  editing: 'editing',
  lighting: 'lighting',
  production: 'production',
  sound: 'sound',
  'visual effects': 'visualEffects',
  writing: 'writing',
}

export function getLocalizedPersonDepartment(
  department: string | null | undefined,
  labels: LocalizedPersonDepartmentLabels
): string {
  const key = department ? departmentKeys[department.trim().toLocaleLowerCase('en-US')] : undefined
  return key ? labels[key] : labels.fallback
}

export function toSearchTitleCardModel(
  result: SearchResultV1 | SearchResultV2,
  presentation: SearchTitleCardPresentationInput
): SearchTitleCardModel {
  const { entity } = result
  if ((entity.entityType !== 'movie' && entity.entityType !== 'series') || !entity.tmdbId) {
    throw new TypeError('Search title presentation requires a TMDB movie or series')
  }

  const v2Entity = entity as SearchResultV2['entity']
  return {
    id: entity.tmdbId,
    mediaType: entity.entityType,
    localizedTitle: presentation.localizedTitle,
    localizedPoster: presentation.localizedPoster,
    ...(entity.year === undefined ? {} : { releaseYear: entity.year }),
    route: `/title/${entity.tmdbId}?type=${entity.entityType === 'series' ? 'tv' : 'movie'}`,
    ...(entity.summary === undefined ? {} : { semanticContext: entity.summary }),
    semanticRelevance: typeof result.score === 'number' ? result.score : result.score.semanticScore,
    ...(v2Entity.tmdbVoteAverage === undefined
      ? {}
      : { tmdbVoteAverage: v2Entity.tmdbVoteAverage }),
    ...(v2Entity.kinoAverageRating === undefined
      ? {}
      : { kinoAverageRating: v2Entity.kinoAverageRating }),
    ...(presentation.displayRating === undefined
      ? {}
      : { displayRating: presentation.displayRating }),
  }
}
