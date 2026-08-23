type PopularItem = {
  id: number
  media_type?: string
  genre_ids?: number[]
}

const TMDB_NEWS_GENRE_ID = 10763

function isEligiblePopularItem(item: PopularItem) {
  if (item.media_type !== 'tv') {
    return true
  }

  return !item.genre_ids?.includes(TMDB_NEWS_GENRE_ID)
}

export function mergePopularNow<T extends PopularItem>(movies: T[], series: T[], limit = 20): T[] {
  const movieItems = movies.filter(isEligiblePopularItem)
  const seriesItems = series.filter(isEligiblePopularItem)

  const seen = new Set<string>()
  const results: T[] = []

  const maxLength = Math.max(movieItems.length, seriesItems.length)

  function append(item: T | undefined) {
    if (!item || results.length >= limit) {
      return
    }

    const key = `${item.media_type ?? 'unknown'}:${item.id}`

    if (seen.has(key)) {
      return
    }

    seen.add(key)
    results.push(item)
  }

  for (let index = 0; index < maxLength && results.length < limit; index += 1) {
    append(movieItems[index])
    append(seriesItems[index])
  }

  return results
}
