import type { MetadataRoute } from 'next'
import { TMDbService } from '@kino/core'
import { absoluteUrl } from '@/lib/seo'
import { personPath, titlePath } from '@/lib/routes'

export const revalidate = 86400

function getTmdbClient() {
  const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY
  if (!apiKey) return null
  return new TMDbService(apiKey)
}

function uniqueBy<T>(items: T[], key: (item: T) => string) {
  const seen = new Set<string>()
  return items.filter((item) => {
    const value = key(item)
    if (seen.has(value)) return false
    seen.add(value)
    return true
  })
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()
  const entries: MetadataRoute.Sitemap = [
    {
      url: absoluteUrl('/'),
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: absoluteUrl('/discover'),
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: absoluteUrl('/search'),
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
  ]

  const tmdb = getTmdbClient()
  if (!tmdb) return entries

  try {
    const [
      trending,
      popularMovies,
      popularTV,
      topRatedMovies,
      upcomingMovies,
      nowPlayingMovies,
      popularPeople,
    ] = await Promise.all([
      tmdb.getTrending('all', 'week'),
      tmdb.getPopularMovies(),
      tmdb.getPopularTV(),
      tmdb.getTopRatedMovies(),
      tmdb.getUpcomingMovies(),
      tmdb.getNowPlayingMovies('US'),
      tmdb.getPopularPeople(),
    ])

    const movieAndSeries = uniqueBy(
      [
        ...trending,
        ...popularMovies,
        ...popularTV,
        ...topRatedMovies,
        ...upcomingMovies,
        ...nowPlayingMovies,
      ],
      (item) => `${item.media_type || 'movie'}:${item.id}`
    ).slice(0, 40)

    for (const item of movieAndSeries) {
      const type = item.media_type === 'tv' ? 'tv' : 'movie'
      const publishedAt = item.release_date || item.first_air_date
      entries.push({
        url: absoluteUrl(titlePath(item.id, item.title || item.name || `title-${item.id}`, type)),
        lastModified: publishedAt ? new Date(`${publishedAt}T12:00:00Z`) : now,
        changeFrequency: 'monthly',
        priority: type === 'tv' ? 0.7 : 0.8,
      })
    }

    for (const person of popularPeople.slice(0, 24)) {
      entries.push({
        url: absoluteUrl(personPath(person.id, person.name)),
        lastModified: now,
        changeFrequency: 'monthly',
        priority: 0.7,
      })
    }
  } catch {
    return entries
  }

  return entries
}
