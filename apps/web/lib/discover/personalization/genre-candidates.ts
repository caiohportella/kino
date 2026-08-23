import type { MediaType, TMDbTitle } from '@kino/core'
import type {
  DiscoverTasteProfile,
  TasteGenreAffinity,
  TasteTitleIdentity,
} from '@/lib/discover/personalization/taste-profile'
import type { PersonalizedRowCandidate } from '@/lib/discover/personalized-rows'

const MAX_GENRE_SEEDS = 4
const MAX_ITEMS_PER_GENRE = 20

const MIN_GENRE_TITLES = 3
const MIN_GENRE_SCORE = 140

export interface GenreRecommendationClient {
  discoverMedia(
    type: MediaType,
    params?: Record<string, string>
  ): Promise<{
    results: TMDbTitle[]
  }>
}

export async function buildGenrePersonalizedCandidates({
  tasteProfile,
  client,
}: {
  tasteProfile: DiscoverTasteProfile
  client: GenreRecommendationClient
}): Promise<PersonalizedRowCandidate[]> {
  const genres = tasteProfile.genres.filter(isUsableGenre).slice(0, MAX_GENRE_SEEDS)

  const results = await Promise.allSettled(
    genres.map(async (genre) => {
      const [movies, tv] = await Promise.all([
        client.discoverMedia('movie', {
          with_genres: String(genre.genreId),
          sort_by: 'popularity.desc',
          'vote_count.gte': '100',
        }),
        client.discoverMedia('tv', {
          with_genres: String(genre.genreId),
          sort_by: 'popularity.desc',
          'vote_count.gte': '50',
        }),
      ])

      return buildGenreCandidate({
        genre,
        items: interleaveMedia(movies.results, tv.results),
        watchedIdentities: tasteProfile.watchedIdentities,
      })
    })
  )

  return results.flatMap((result) => {
    if (result.status !== 'fulfilled' || result.value === null) {
      return []
    }

    return [result.value]
  })
}

function buildGenreCandidate({
  genre,
  items,
  watchedIdentities,
}: {
  genre: TasteGenreAffinity
  items: readonly TMDbTitle[]
  watchedIdentities: ReadonlySet<TasteTitleIdentity>
}): PersonalizedRowCandidate | null {
  const filtered = getUnwatchedTitles({
    items,
    watchedIdentities,
  })

  if (filtered.length === 0) {
    return null
  }

  return {
    id: `genre:${genre.genreId}`,
    kind: 'genre',

    /*
     * Genres are intentionally weaker than
     * title/director rows because they're
     * broad preference signals.
     */
    score: 50 + Math.min(18, genre.titleCount * 2) + Math.min(12, genre.score / 50),

    titleKey: 'discover.personalized.moreGenre',

    titleDefault: 'More {{genre}} for you',

    titleValues: {
      genre: genre.name,
    },

    items: filtered,

    source: {
      kind: 'genre',
      genreId: genre.genreId,
      name: genre.name,
    },
  }
}

function getUnwatchedTitles({
  items,
  watchedIdentities,
}: {
  items: readonly TMDbTitle[]
  watchedIdentities: ReadonlySet<TasteTitleIdentity>
}) {
  const titles = new Map<string, TMDbTitle>()

  for (const item of items) {
    const mediaType = item.media_type

    if (mediaType !== 'movie' && mediaType !== 'tv') {
      continue
    }

    if (!Number.isFinite(item.id) || item.id <= 0) {
      continue
    }

    const identity = `${mediaType}:${item.id}` as TasteTitleIdentity

    if (watchedIdentities.has(identity) || titles.has(identity)) {
      continue
    }

    titles.set(identity, item)

    if (titles.size >= MAX_ITEMS_PER_GENRE) {
      break
    }
  }

  return [...titles.values()]
}

function interleaveMedia(movies: readonly TMDbTitle[], tv: readonly TMDbTitle[]) {
  const result: TMDbTitle[] = []

  const maxLength = Math.max(movies.length, tv.length)

  for (let index = 0; index < maxLength; index += 1) {
    const movie = movies[index]

    const series = tv[index]

    if (movie) {
      result.push({
        ...movie,
        media_type: 'movie',
      })
    }

    if (series) {
      result.push({
        ...series,
        media_type: 'tv',
      })
    }
  }

  return result
}

function isUsableGenre(genre: TasteGenreAffinity) {
  return genre.titleCount >= MIN_GENRE_TITLES && genre.score >= MIN_GENRE_SCORE
}
