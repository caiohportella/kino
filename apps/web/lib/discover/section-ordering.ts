export type DiscoverSectionDescriptor =
  | {
      type: 'primary'
    }
  | {
      type: 'updates'
    }
  | {
      type: 'new-releases' | 'new-series' | 'upcoming' | 'rereleases'
    }

export type BuildDiscoverSectionOrderInput = {
  updatesCount: number
  newReleasesCount: number
  newSeriesCount: number
  upcomingCount: number
  rereleasesCount: number
}

const STRONG_UPDATES_MIN_COUNT = 3

export function buildDiscoverSectionOrder({
  updatesCount,
  newReleasesCount,
  newSeriesCount,
  upcomingCount,
  rereleasesCount,
}: BuildDiscoverSectionOrderInput): DiscoverSectionDescriptor[] {
  const sections: DiscoverSectionDescriptor[] = []

  const hasStrongUpdates = updatesCount >= STRONG_UPDATES_MIN_COUNT

  const hasUpdates = updatesCount > 0

  if (hasStrongUpdates) {
    sections.push({
      type: 'updates',
    })
  }

  sections.push({
    type: 'primary',
  })

  if (newReleasesCount > 0) {
    sections.push({
      type: 'new-releases',
    })
  }

  if (newSeriesCount > 0) {
    sections.push({
      type: 'new-series',
    })
  }

  if (hasUpdates && !hasStrongUpdates) {
    sections.push({
      type: 'updates',
    })
  }

  if (upcomingCount > 0) {
    sections.push({
      type: 'upcoming',
    })
  }

  if (rereleasesCount > 0) {
    sections.push({
      type: 'rereleases',
    })
  }

  return sections
}
