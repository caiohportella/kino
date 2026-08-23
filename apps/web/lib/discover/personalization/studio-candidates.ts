import type { MediaType, TMDbTitle } from '@kino/core'
import type {
  DiscoverTasteProfile,
  TasteStudioAffinity,
  TasteTitleIdentity,
} from '@/lib/discover/personalization/taste-profile'
import type { PersonalizedRowCandidate } from '@/lib/discover/personalized-rows'

const MAX_STUDIO_SEEDS = 4
const MAX_ITEMS_PER_STUDIO = 20

const MIN_STUDIO_TITLES = 3
const MIN_STUDIO_SCORE = 180

export interface StudioRecommendationClient {
  discoverMedia(
    type: MediaType,
    params?: Record<string, string>
  ): Promise<{
    results: TMDbTitle[]
  }>
}

export async function buildStudioPersonalizedCandidates({
  tasteProfile,
  client,
}: {
  tasteProfile: DiscoverTasteProfile
  client: StudioRecommendationClient
}): Promise<PersonalizedRowCandidate[]> {
  const studios = tasteProfile.studios.filter(isUsableStudio).slice(0, MAX_STUDIO_SEEDS)

  const results = await Promise.allSettled(
    studios.map(async (studio) => {
      const [movies, tv] = await Promise.all([
        client.discoverMedia('movie', {
          with_companies: String(studio.companyId),
          sort_by: 'popularity.desc',
          'vote_count.gte': '50',
        }),

        client.discoverMedia('tv', {
          with_companies: String(studio.companyId),
          sort_by: 'popularity.desc',
          'vote_count.gte': '25',
        }),
      ])

      return buildStudioCandidate({
        studio,
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

function buildStudioCandidate({
  studio,
  items,
  watchedIdentities,
}: {
  studio: TasteStudioAffinity
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

  const ratingBoost = studio.averageRating === null ? 0 : Math.max(0, studio.averageRating - 3) * 5

  return {
    id: `studio:${studio.companyId}`,
    kind: 'studio',

    score:
      55 +
      Math.min(18, studio.titleCount * 2.5) +
      Math.min(8, studio.score / 75) +
      Math.min(8, ratingBoost),

    titleKey: 'discover.personalized.moreFromStudio',

    titleDefault: 'More from {{studio}}',

    titleValues: {
      studio: studio.name,
    },

    items: filtered,

    source: {
      kind: 'studio',
      companyId: studio.companyId,
      name: studio.name,
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

    if (titles.size >= MAX_ITEMS_PER_STUDIO) {
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

function isUsableStudio(studio: TasteStudioAffinity) {
  return studio.titleCount >= MIN_STUDIO_TITLES && studio.score >= MIN_STUDIO_SCORE
}
