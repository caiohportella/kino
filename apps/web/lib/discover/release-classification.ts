type ReleaseDateEntry = {
  release_date: string
  type: number
}

const THEATRICAL_RELEASE_TYPES = new Set([2, 3])
const NEW_RELEASE_TYPES = new Set([2, 3, 4])

function toDateOnly(value: string) {
  return value.slice(0, 10)
}

function sortedDates(releases: ReleaseDateEntry[], types: Set<number>) {
  return releases
    .filter((release) => types.has(release.type))
    .map((release) => toDateOnly(release.release_date))
    .sort()
}

export function isFirstRunUpcomingRelease(releases: ReleaseDateEntry[], min: string, max: string) {
  const dates = sortedDates(releases, THEATRICAL_RELEASE_TYPES)

  const firstRelease = dates[0]

  return Boolean(firstRelease && firstRelease >= min && firstRelease <= max)
}

export function isFirstRunRecentRelease(releases: ReleaseDateEntry[], min: string, max: string) {
  const dates = sortedDates(releases, NEW_RELEASE_TYPES)

  const firstRelease = dates[0]

  return Boolean(firstRelease && firstRelease >= min && firstRelease <= max)
}

export function hasUpcomingRerelease(releases: ReleaseDateEntry[], today: string, max: string) {
  const dates = sortedDates(releases, THEATRICAL_RELEASE_TYPES)

  const hadPreviousRelease = dates.some((date) => date <= today)

  const hasFutureRelease = dates.some((date) => date > today && date <= max)

  return hadPreviousRelease && hasFutureRelease
}
