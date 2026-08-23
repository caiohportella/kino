type ReleaseCandidate = {
  media_type: 'movie' | 'tv'
  release_date?: string
  first_air_date?: string
}

type ReleaseWindow = {
  start: string
  end: string
}

function getReleaseDate(item: ReleaseCandidate) {
  return item.media_type === 'movie' ? item.release_date : item.first_air_date
}

function isDateOnlyInWindow(value: string | undefined, window: ReleaseWindow) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  /*
   * YYYY-MM-DD strings sort lexicographically
   * in chronological order, so we avoid local
   * timezone conversion entirely.
   */
  return value >= window.start && value <= window.end
}

export function selectRecentRelatedReleases<T extends ReleaseCandidate>(
  items: readonly T[],
  window: ReleaseWindow
): T[] {
  return items.filter((item) => isDateOnlyInWindow(getReleaseDate(item), window))
}
