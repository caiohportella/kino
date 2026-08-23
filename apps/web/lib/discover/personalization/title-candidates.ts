import type { MediaType, TMDbTitle } from '@kino/core'
import type {
  DiscoverTasteProfile,
  TasteTitleIdentity,
  TasteTitleSeed,
} from '@/lib/discover/personalization/taste-profile'
import type { PersonalizedRowCandidate } from '@/lib/discover/personalized-rows'

const MAX_TITLE_SEEDS = 4
const MAX_RECOMMENDATIONS_PER_SEED = 20

const MIN_TITLE_SEED_SCORE = 55
const MIN_RATED_SEED_RATING = 3.5

export interface TitleRecommendationClient {
  getRecommendations(type: MediaType, id: number): Promise<TMDbTitle[]>
}

export async function buildTitlePersonalizedCandidates({
  tasteProfile,
  client,
}: {
  tasteProfile: DiscoverTasteProfile
  client: TitleRecommendationClient
}): Promise<PersonalizedRowCandidate[]> {
  const seeds = tasteProfile.titleSeeds.filter(isUsableTitleSeed).slice(0, MAX_TITLE_SEEDS)

  const results = await Promise.allSettled(
    seeds.map(async (seed) => {
      const recommendations = await client.getRecommendations(seed.mediaType, seed.tmdbId)

      return buildCandidate({
        seed,
        recommendations,
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

function buildCandidate({
  seed,
  recommendations,
  watchedIdentities,
}: {
  seed: TasteTitleSeed
  recommendations: readonly TMDbTitle[]
  watchedIdentities: ReadonlySet<TasteTitleIdentity>
}): PersonalizedRowCandidate | null {
  const items = getUnwatchedRecommendations({
    seed,
    recommendations,
    watchedIdentities,
  })

  if (items.length === 0) {
    return null
  }

  return {
    id: `title:${seed.mediaType}:${seed.tmdbId}`,
    kind: 'title',

    /*
     * The selector compares scores between
     * different recommendation families.
     *
     * Title affinity is compressed into a
     * ~0-30 boost so raw taste scores don't
     * overwhelm director/genre/studio rows.
     */
    score: 80 + Math.min(20, seed.score / 6),

    titleKey: 'discover.personalized.becauseWatched',

    titleDefault: 'Because you watched {{title}}',

    titleValues: {
      title: seed.title,
    },

    items,

    source: {
      kind: 'title',
      tmdbId: seed.tmdbId,
      mediaType: seed.mediaType,
      title: seed.title,
    },
  }
}

function getUnwatchedRecommendations({
  seed,
  recommendations,
  watchedIdentities,
}: {
  seed: TasteTitleSeed
  recommendations: readonly TMDbTitle[]
  watchedIdentities: ReadonlySet<TasteTitleIdentity>
}) {
  const unique = new Map<string, TMDbTitle>()

  for (const recommendation of recommendations) {
    const mediaType = recommendation.media_type ?? seed.mediaType

    if (mediaType !== 'movie' && mediaType !== 'tv') {
      continue
    }

    if (!Number.isFinite(recommendation.id) || recommendation.id <= 0) {
      continue
    }

    const identity = `${mediaType}:${recommendation.id}` as TasteTitleIdentity

    if (watchedIdentities.has(identity)) {
      continue
    }

    if (unique.has(identity)) {
      continue
    }

    unique.set(identity, {
      ...recommendation,
      media_type: mediaType,
    })

    if (unique.size >= MAX_RECOMMENDATIONS_PER_SEED) {
      break
    }
  }

  return [...unique.values()]
}

function isUsableTitleSeed(seed: TasteTitleSeed) {
  if (seed.score < MIN_TITLE_SEED_SCORE) {
    return false
  }

  /*
   * An explicit mediocre/negative rating
   * should prevent a title from becoming
   * a recommendation seed even if it was
   * watched recently.
   */
  if (seed.rating !== null && seed.rating < MIN_RATED_SEED_RATING) {
    return false
  }

  return true
}
