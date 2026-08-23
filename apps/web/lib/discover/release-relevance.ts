import { getDiscoverMediaKey } from './media-key.ts'

type DiscoverMediaType = 'movie' | 'tv'

export type DiscoverMediaReference = {
  id: number
  media_type: DiscoverMediaType
}

export type DiscoverRelatedReleaseSignal<
  TItem extends DiscoverMediaReference = DiscoverMediaReference,
> = {
  kind: 'actor' | 'director' | 'studio'
  items: TItem[]
}

type DiscoverReleaseSignals<TItem extends DiscoverMediaReference> = {
  relatedReleases: DiscoverRelatedReleaseSignal<TItem>[]
}

const GENERIC_RELEASE_WEIGHT = 2

const AFFINITY_WEIGHTS = {
  actor: 3,
  director: 3,
  studio: 1,
} as const

export function rankPersonalizedNewReleases<TRelease extends DiscoverMediaReference>(
  releases: TRelease[],
  signals: DiscoverReleaseSignals<TRelease>
): TRelease[] {
  const scores = new Map<string, number>()

  /*
   * Start with the generic release feed.
   *
   * Its existing order becomes the stable
   * editorial/popularity fallback.
   */
  const candidates = new Map<
    string,
    {
      item: TRelease
      originalIndex: number
    }
  >()

  releases.forEach((release, index) => {
    const key = getDiscoverMediaKey(release.media_type, release.id)

    if (!candidates.has(key)) {
      candidates.set(key, {
        item: release,
        originalIndex: index,
      })
    }

    scores.set(key, (scores.get(key) ?? 0) + GENERIC_RELEASE_WEIGHT)
  })

  for (const signal of signals.relatedReleases) {
    const seenInSignal = new Set<string>()

    for (const item of signal.items) {
      const key = getDiscoverMediaKey(item.media_type, item.id)

      if (seenInSignal.has(key)) {
        continue
      }

      seenInSignal.add(key)

      if (!candidates.has(key)) {
        candidates.set(key, {
          item,
          originalIndex: releases.length + candidates.size,
        })
      }

      scores.set(key, (scores.get(key) ?? 0) + AFFINITY_WEIGHTS[signal.kind])
    }
  }

  return [...candidates.entries()]
    .map(([key, { item, originalIndex }]) => ({
      item,
      originalIndex,
      score: scores.get(key) ?? 0,
    }))
    .sort((left, right) => right.score - left.score || left.originalIndex - right.originalIndex)
    .map(({ item }) => item)
}
