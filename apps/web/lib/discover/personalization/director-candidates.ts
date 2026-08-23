import type { TMDbPersonCredit, TMDbTitle } from '@kino/core'
import type {
  DiscoverTasteProfile,
  TasteDirectorAffinity,
  TasteTitleIdentity,
} from '@/lib/discover/personalization/taste-profile'
import type { PersonalizedRowCandidate } from '@/lib/discover/personalized-rows'

const MAX_DIRECTOR_SEEDS = 4
const MAX_ITEMS_PER_DIRECTOR = 20

const MIN_DIRECTOR_TITLES = 2
const MIN_DIRECTOR_SCORE = 110

export interface DirectorRecommendationClient {
  getPersonDetails(personId: number): Promise<{
    id: number
    name: string
    combined_credits?: {
      cast: TMDbPersonCredit[]
      crew: TMDbPersonCredit[]
    }
  }>
}

export async function buildDirectorPersonalizedCandidates({
  tasteProfile,
  client,
}: {
  tasteProfile: DiscoverTasteProfile
  client: DirectorRecommendationClient
}): Promise<PersonalizedRowCandidate[]> {
  const directors = tasteProfile.directors.filter(isUsableDirector).slice(0, MAX_DIRECTOR_SEEDS)

  const results = await Promise.allSettled(
    directors.map(async (director) => {
      const person = await client.getPersonDetails(director.personId)

      return buildDirectorCandidate({
        director,
        credits: person.combined_credits?.crew ?? [],
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

function buildDirectorCandidate({
  director,
  credits,
  watchedIdentities,
}: {
  director: TasteDirectorAffinity
  credits: readonly TMDbPersonCredit[]
  watchedIdentities: ReadonlySet<TasteTitleIdentity>
}): PersonalizedRowCandidate | null {
  const items = getUnwatchedDirectedTitles({
    credits,
    watchedIdentities,
  })

  if (items.length === 0) {
    return null
  }

  const ratingBoost =
    director.averageRating === null ? 0 : Math.max(0, director.averageRating - 3) * 6

  return {
    id: `director:${director.personId}`,
    kind: 'director',

    score: 70 + Math.min(20, director.titleCount * 4) + Math.min(12, ratingBoost),

    titleKey: 'discover.personalized.moreFromDirector',

    titleDefault: 'More from {{director}}',

    titleValues: {
      director: director.name,
    },

    items,

    source: {
      kind: 'director',
      personId: director.personId,
      name: director.name,
    },
  }
}

function getUnwatchedDirectedTitles({
  credits,
  watchedIdentities,
}: {
  credits: readonly TMDbPersonCredit[]
  watchedIdentities: ReadonlySet<TasteTitleIdentity>
}) {
  const titles = new Map<string, TMDbTitle>()

  const sortedCredits = [...credits].filter(isDirectorCredit).sort(compareCredits)

  for (const credit of sortedCredits) {
    const identity = `${credit.media_type}:${credit.id}` as TasteTitleIdentity

    if (watchedIdentities.has(identity) || titles.has(identity)) {
      continue
    }

    titles.set(identity, {
      ...credit,
      media_type: credit.media_type,
    })

    if (titles.size >= MAX_ITEMS_PER_DIRECTOR) {
      break
    }
  }

  return [...titles.values()]
}

function isDirectorCredit(credit: TMDbPersonCredit) {
  return (
    (credit.media_type === 'movie' || credit.media_type === 'tv') &&
    credit.job === 'Director' &&
    Number.isFinite(credit.id) &&
    credit.id > 0
  )
}

function compareCredits(left: TMDbPersonCredit, right: TMDbPersonCredit) {
  const leftDate = getReleaseTimestamp(left)

  const rightDate = getReleaseTimestamp(right)

  /*
   * Prefer substantial / recognizable
   * works, but keep release recency as
   * the tiebreaker.
   */
  if (left.vote_count !== right.vote_count) {
    return right.vote_count - left.vote_count
  }

  return rightDate - leftDate
}

function getReleaseTimestamp(title: TMDbTitle) {
  const value = title.media_type === 'tv' ? title.first_air_date : title.release_date

  if (!value) {
    return 0
  }

  const timestamp = Date.parse(value)

  return Number.isFinite(timestamp) ? timestamp : 0
}

function isUsableDirector(director: TasteDirectorAffinity) {
  return director.titleCount >= MIN_DIRECTOR_TITLES && director.score >= MIN_DIRECTOR_SCORE
}
