import type { TMDbPersonCredit, TMDbTitle } from '@kino/core'

type TypedTMDbTitle = TMDbTitle & {
  media_type: 'movie' | 'tv'
}

function getMediaKey(item: { id: number; media_type: 'movie' | 'tv' }) {
  return `${item.media_type}:${item.id}`
}

export function selectDirectedDiscoverResults<T extends TypedTMDbTitle>(
  discoverResults: readonly T[],
  crewCredits: readonly TMDbPersonCredit[]
): T[] {
  const directedKeys = new Set(
    crewCredits
      .filter((credit) => credit.job === 'Director' || credit.job === 'Creator')
      .map(getMediaKey)
  )

  return discoverResults.filter((item) => directedKeys.has(getMediaKey(item)))
}

export function selectActorSeriesCredits(credits: readonly TMDbPersonCredit[]): TMDbPersonCredit[] {
  return credits.filter((credit) => credit.media_type === 'tv')
}

export function selectCreatorSeriesCredits(
  credits: readonly TMDbPersonCredit[]
): TMDbPersonCredit[] {
  return credits.filter(
    (credit) =>
      credit.media_type === 'tv' && (credit.job === 'Creator' || credit.job === 'Director')
  )
}
