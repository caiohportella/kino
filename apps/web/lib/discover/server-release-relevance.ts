import type { TMDbTitle } from '@kino/core'

import type { DiscoverRelatedReleaseSignal } from './release-relevance.ts'
import { rankPersonalizedNewReleases } from './release-relevance.ts'

type TypedTMDbTitle = TMDbTitle & {
  media_type: 'movie' | 'tv'
}

type BuildPersonalizedNewReleasesInput = {
  newReleases: TMDbTitle[]
  relatedReleases: Array<{
    kind: 'actor' | 'director' | 'studio'
    items: TMDbTitle[]
  }>
}

function hasMediaType(item: TMDbTitle): item is TypedTMDbTitle {
  return item.media_type === 'movie' || item.media_type === 'tv'
}

export function buildPersonalizedNewReleases({
  newReleases,
  relatedReleases,
}: BuildPersonalizedNewReleasesInput): TypedTMDbTitle[] {
  const validNewReleases = newReleases.filter(hasMediaType)

  const validRelatedReleases: DiscoverRelatedReleaseSignal<TypedTMDbTitle>[] = relatedReleases.map(
    (signal) => ({
      kind: signal.kind,
      items: signal.items.filter(hasMediaType),
    })
  )

  return rankPersonalizedNewReleases(validNewReleases, {
    relatedReleases: validRelatedReleases,
  })
}

export function buildPersonalizedNewSeries({
  newSeries,
  relatedSeries,
}: {
  newSeries: TMDbTitle[]
  relatedSeries: Array<{
    kind: 'actor' | 'director' | 'studio'
    items: TMDbTitle[]
  }>
}): TypedTMDbTitle[] {
  const validNewSeries = newSeries.filter(
    (item): item is TypedTMDbTitle => item.media_type === 'tv'
  )

  const validRelatedSeries: DiscoverRelatedReleaseSignal<TypedTMDbTitle>[] = relatedSeries.map(
    (signal) => ({
      kind: signal.kind,
      items: signal.items.filter((item): item is TypedTMDbTitle => item.media_type === 'tv'),
    })
  )

  return rankPersonalizedNewReleases(validNewSeries, {
    relatedReleases: validRelatedSeries,
  })
}
