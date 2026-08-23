import type { MediaType, UIDiaryEntry, WatchedMovie, WatchedSeries } from '@kino/core'

export type TasteTitleIdentity = `${MediaType}:${number}`

export type TasteTitleSeed = {
  identity: TasteTitleIdentity
  tmdbId: number
  mediaType: MediaType
  title: string

  score: number
  rating: number | null
  watchedAt: string | null
  watchCount: number

  genres: {
    id: number
    name: string
  }[]

  director: {
    id: number
    name: string
  } | null

  studios: {
    id: number
    name: string
  }[]
}

export type TasteGenreAffinity = {
  genreId: number
  name: string

  score: number
  titleCount: number
}

export type TasteDirectorAffinity = {
  personId: number
  name: string

  score: number
  titleCount: number
  averageRating: number | null
}

export type TasteStudioAffinity = {
  companyId: number
  name: string

  score: number
  titleCount: number
  averageRating: number | null
}

export type DiscoverTasteProfile = {
  titleSeeds: TasteTitleSeed[]
  genres: TasteGenreAffinity[]
  directors: TasteDirectorAffinity[]
  studios: TasteStudioAffinity[]

  watchedIdentities: Set<TasteTitleIdentity>
}

export function buildDiscoverTasteProfile({
  watchedMovies,
  watchedSeries,
  diaryEntries,
  now = new Date(),
}: {
  watchedMovies: readonly WatchedMovie[]
  watchedSeries: readonly WatchedSeries[]
  diaryEntries: readonly UIDiaryEntry[]
  now?: Date
}): DiscoverTasteProfile {
  const diaryActivity = buildDiaryActivityMap(diaryEntries)

  const titleSeeds: TasteTitleSeed[] = [
    ...watchedMovies.map((movie) => createMovieSeed(movie, diaryActivity, now)),

    ...watchedSeries.map((series) => createSeriesSeed(series, now)),
  ]
    .filter((seed): seed is TasteTitleSeed => seed !== null)
    .sort((left, right) => right.score - left.score)

  const watchedIdentities = new Set(titleSeeds.map((seed) => seed.identity))

  return {
    titleSeeds,
    genres: buildGenreAffinities(titleSeeds),
    directors: buildDirectorAffinities(titleSeeds),
    studios: buildStudioAffinities(titleSeeds),
    watchedIdentities,
  }
}

function createMovieSeed(
  movie: WatchedMovie,
  diaryActivity: Map<TasteTitleIdentity, DiaryActivity>,
  now: Date
): TasteTitleSeed | null {
  const identity = getIdentity('movie', movie.tmdb_id)

  if (!identity) {
    return null
  }

  const diary = diaryActivity.get(identity)

  const watchedAt = diary?.latestWatchedAt ?? movie.watched_at ?? null

  const rating = normalizeRating(movie.rating)

  const watchCount = Math.max(1, diary?.watchCount ?? 1)

  return {
    identity,
    tmdbId: movie.tmdb_id,
    mediaType: 'movie',
    title: movie.title,

    score: calculateTitleAffinity({
      rating,
      watchedAt,
      watchCount,
      now,
    }),

    rating,
    watchedAt,
    watchCount,

    genres: normalizeGenres(movie.genres),

    director: normalizeDirector(movie.director),

    studios: normalizeStudios(movie.production_companies),
  }
}

function createSeriesSeed(series: WatchedSeries, now: Date): TasteTitleSeed | null {
  const identity = getIdentity('tv', series.tmdb_id)

  if (!identity) {
    return null
  }

  const rating = normalizeRating(series.latest_rating)

  const watchedAt = series.latest_watched_at ?? null

  /*
   * Episode count should matter a little,
   * but shouldn't let a 100-episode series
   * completely dominate the taste profile.
   */
  const watchCount = Math.max(1, Math.min(5, Math.ceil(series.watched_episode_count / 5)))

  return {
    identity,
    tmdbId: series.tmdb_id,
    mediaType: 'tv',
    title: series.title,

    score: calculateTitleAffinity({
      rating,
      watchedAt,
      watchCount,
      now,
    }),

    rating,
    watchedAt,
    watchCount,

    genres: normalizeGenres(series.genres),

    director: normalizeDirector(series.director),

    studios: normalizeStudios(series.production_companies),
  }
}

type DiaryActivity = {
  watchCount: number
  latestWatchedAt: string | null
}

function buildDiaryActivityMap(entries: readonly UIDiaryEntry[]) {
  const result = new Map<TasteTitleIdentity, DiaryActivity>()

  for (const entry of entries) {
    const identity = getIdentity(entry.type, entry.tmdbId)

    if (!identity) {
      continue
    }

    const current = result.get(identity)

    if (!current) {
      result.set(identity, {
        watchCount: 1,
        latestWatchedAt: entry.watchedAt,
      })

      continue
    }

    current.watchCount += 1

    if (isLaterDate(entry.watchedAt, current.latestWatchedAt)) {
      current.latestWatchedAt = entry.watchedAt
    }
  }

  return result
}

function calculateTitleAffinity({
  rating,
  watchedAt,
  watchCount,
  now,
}: {
  rating: number | null
  watchedAt: string | null
  watchCount: number
  now: Date
}) {
  /*
   * Base interest from simply having
   * watched the title.
   */
  let score = 40

  /*
   * Explicit rating is the strongest
   * positive/negative preference signal.
   *
   * 5.0 => +30
   * 4.0 => +18
   * 3.0 => +6
   * 2.0 => -6
   * 1.0 => -18
   */
  if (rating !== null) {
    score += (rating - 2.5) * 12
  }

  /*
   * Recent watches are better seeds than
   * something seen years ago.
   */
  score += calculateRecencyBoost(watchedAt, now)

  /*
   * Rewatches / repeated engagement are
   * useful, but capped so one favourite
   * cannot dominate every affinity.
   */
  score += Math.min(Math.max(0, watchCount - 1) * 5, 15)

  return Math.max(0, Math.round(score * 10) / 10)
}

function calculateRecencyBoost(watchedAt: string | null, now: Date) {
  if (!watchedAt) {
    return 0
  }

  const timestamp = Date.parse(watchedAt)

  if (!Number.isFinite(timestamp)) {
    return 0
  }

  const ageInDays = Math.max(0, now.getTime() - timestamp) / 86_400_000

  if (ageInDays <= 30) {
    return 15
  }

  if (ageInDays <= 90) {
    return 10
  }

  if (ageInDays <= 180) {
    return 6
  }

  if (ageInDays <= 365) {
    return 3
  }

  return 0
}

function buildGenreAffinities(seeds: readonly TasteTitleSeed[]): TasteGenreAffinity[] {
  const affinities = new Map<number, TasteGenreAffinity>()

  for (const seed of seeds) {
    for (const genre of seed.genres) {
      const current = affinities.get(genre.id)

      if (!current) {
        affinities.set(genre.id, {
          genreId: genre.id,
          name: genre.name,
          score: seed.score,
          titleCount: 1,
        })

        continue
      }

      current.score += seed.score
      current.titleCount += 1
    }
  }

  return [...affinities.values()]
    .map((affinity) => ({
      ...affinity,
      score: roundScore(affinity.score),
    }))
    .sort(compareAffinity)
}

function buildDirectorAffinities(seeds: readonly TasteTitleSeed[]): TasteDirectorAffinity[] {
  const affinities = new Map<number, AffinityAccumulator>()

  for (const seed of seeds) {
    const director = seed.director

    if (!director) {
      continue
    }

    addToAffinity(affinities, director.id, director.name, seed)
  }

  return [...affinities.entries()]
    .map(([personId, affinity]) => ({
      personId,
      name: affinity.name,
      score: calculateEntityAffinity(affinity),
      titleCount: affinity.titleCount,
      averageRating: getAverageRating(affinity),
    }))
    .sort(compareAffinity)
}

function buildStudioAffinities(seeds: readonly TasteTitleSeed[]): TasteStudioAffinity[] {
  const affinities = new Map<number, AffinityAccumulator>()

  for (const seed of seeds) {
    for (const studio of seed.studios) {
      addToAffinity(affinities, studio.id, studio.name, seed)
    }
  }

  return [...affinities.entries()]
    .map(([companyId, affinity]) => ({
      companyId,
      name: affinity.name,
      score: calculateEntityAffinity(affinity),
      titleCount: affinity.titleCount,
      averageRating: getAverageRating(affinity),
    }))
    .sort(compareAffinity)
}

type AffinityAccumulator = {
  name: string
  score: number
  titleCount: number
  ratingTotal: number
  ratingCount: number
}

function addToAffinity(
  affinities: Map<number, AffinityAccumulator>,
  id: number,
  name: string,
  seed: TasteTitleSeed
) {
  const current = affinities.get(id)

  if (!current) {
    affinities.set(id, {
      name,
      score: seed.score,
      titleCount: 1,
      ratingTotal: seed.rating ?? 0,
      ratingCount: seed.rating === null ? 0 : 1,
    })

    return
  }

  current.score += seed.score
  current.titleCount += 1

  if (seed.rating !== null) {
    current.ratingTotal += seed.rating

    current.ratingCount += 1
  }
}

function calculateEntityAffinity(affinity: AffinityAccumulator) {
  /*
   * Repeated exposure is an important
   * signal for directors and studios.
   */
  const repeatBoost = Math.max(0, affinity.titleCount - 1) * 12

  return roundScore(affinity.score + repeatBoost)
}

function getAverageRating(affinity: AffinityAccumulator) {
  if (affinity.ratingCount === 0) {
    return null
  }

  return roundScore(affinity.ratingTotal / affinity.ratingCount)
}

function compareAffinity(
  left: {
    score: number
    titleCount: number
  },
  right: {
    score: number
    titleCount: number
  }
) {
  if (left.score !== right.score) {
    return right.score - left.score
  }

  return right.titleCount - left.titleCount
}

function normalizeGenres(
  genres:
    | {
        id: number
        name: string
      }[]
    | null
    | undefined
) {
  return (
    genres
      ?.filter((genre) => Number.isFinite(genre.id) && genre.id > 0 && genre.name.trim().length > 0)
      .map((genre) => ({
        id: genre.id,
        name: genre.name.trim(),
      })) ?? []
  )
}

function normalizeDirector(
  director:
    | {
        id: number
        name: string
      }
    | null
    | undefined
) {
  if (!director || !Number.isFinite(director.id) || director.id <= 0 || !director.name.trim()) {
    return null
  }

  return {
    id: director.id,
    name: director.name.trim(),
  }
}

function normalizeStudios(
  studios:
    | {
        id: number
        name: string
      }[]
    | null
    | undefined
) {
  return (
    studios
      ?.filter(
        (studio) => Number.isFinite(studio.id) && studio.id > 0 && studio.name.trim().length > 0
      )
      .map((studio) => ({
        id: studio.id,
        name: studio.name.trim(),
      })) ?? []
  )
}

function normalizeRating(rating: number | null | undefined) {
  if (typeof rating !== 'number' || !Number.isFinite(rating)) {
    return null
  }

  return Math.max(0.5, Math.min(5, rating))
}

function getIdentity(mediaType: MediaType, tmdbId: number): TasteTitleIdentity | null {
  if (!Number.isFinite(tmdbId) || tmdbId <= 0) {
    return null
  }

  return `${mediaType}:${tmdbId}`
}

function isLaterDate(candidate: string, current: string | null) {
  if (!current) {
    return true
  }

  const candidateTime = Date.parse(candidate)

  const currentTime = Date.parse(current)

  if (!Number.isFinite(candidateTime)) {
    return false
  }

  if (!Number.isFinite(currentTime)) {
    return true
  }

  return candidateTime > currentTime
}

function roundScore(value: number) {
  return Math.round(value * 10) / 10
}
