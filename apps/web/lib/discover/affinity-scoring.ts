export const DISCOVER_ACTOR_AFFINITY_MIN_TITLES = 2
export const DISCOVER_DIRECTOR_AFFINITY_MIN_TITLES = 1
export const DISCOVER_STUDIO_AFFINITY_MIN_TITLES = 2
export const DISCOVER_AFFINITY_LIMIT = 3

const DIRECTOR_CONFIDENCE_TITLE_CAP = 4
const DIRECTOR_CONFIDENCE_BONUS = 8

const STUDIO_CONFIDENCE_TITLE_CAP = 4
const STUDIO_CONFIDENCE_BONUS = 8

type AffinityEntity = {
  id: number
  name: string
}

type AffinityCastPerson = AffinityEntity & {
  order?: number
}

export type DiscoverAffinityTitle = {
  titleId: string
  rating: number | null
  cast?: AffinityCastPerson[] | null
  director?: AffinityEntity | null
  studios?: AffinityEntity[] | null
}

export type DiscoverAffinityCandidate = {
  id: number
  name: string
  score: number
  averageRating: number
  titleCount: number
}

export type DiscoverPersonAffinity = DiscoverAffinityCandidate

export type DiscoverStudioAffinity = DiscoverAffinityCandidate

type AffinityAccumulator = {
  id: number
  name: string
  weightedRatingTotal: number
  weight: number
  titleIds: Set<string>
}

function getCastWeight(order: number | undefined) {
  if (order === undefined || !Number.isFinite(order)) {
    return 0
  }

  if (order <= 1) return 1
  if (order <= 4) return 0.85
  if (order <= 9) return 0.65
  if (order <= 14) return 0.4

  return 0
}

function addCandidate(
  candidates: Map<number, AffinityAccumulator>,
  entity: AffinityEntity,
  titleId: string,
  rating: number,
  weight: number
) {
  if (!Number.isFinite(entity.id) || entity.id <= 0 || !entity.name.trim() || weight <= 0) {
    return
  }

  const current = candidates.get(entity.id) ?? {
    id: entity.id,
    name: entity.name,
    weightedRatingTotal: 0,
    weight: 0,
    titleIds: new Set<string>(),
  }

  if (current.titleIds.has(titleId)) {
    return
  }

  current.titleIds.add(titleId)
  current.weightedRatingTotal += rating * weight
  current.weight += weight
  current.name = entity.name

  candidates.set(entity.id, current)
}

function getAverageRating(candidate: AffinityAccumulator) {
  return candidate.weight > 0 ? candidate.weightedRatingTotal / candidate.weight : 0
}

function rankActorAffinities(
  candidates: Map<number, AffinityAccumulator>,
  limit: number
): DiscoverAffinityCandidate[] {
  return [...candidates.values()]
    .filter((candidate) => candidate.titleIds.size >= DISCOVER_ACTOR_AFFINITY_MIN_TITLES)
    .map((candidate) => {
      const titleCount = candidate.titleIds.size
      const averageRating = getAverageRating(candidate)

      const score = titleCount * 10 + candidate.weight + averageRating

      return {
        id: candidate.id,
        name: candidate.name,
        score,
        averageRating,
        titleCount,
      }
    })
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.titleCount - left.titleCount ||
        right.averageRating - left.averageRating ||
        left.id - right.id
    )
    .slice(0, limit)
}

function rankDirectorAffinities(
  candidates: Map<number, AffinityAccumulator>,
  limit: number
): DiscoverAffinityCandidate[] {
  return [...candidates.values()]
    .filter((candidate) => candidate.titleIds.size >= DISCOVER_DIRECTOR_AFFINITY_MIN_TITLES)
    .map((candidate) => {
      const titleCount = candidate.titleIds.size
      const averageRating = getAverageRating(candidate)

      const confidence =
        Math.min(titleCount, DIRECTOR_CONFIDENCE_TITLE_CAP) / DIRECTOR_CONFIDENCE_TITLE_CAP

      const ratingSignal = averageRating * 10

      const confidenceAdjustedRating = ratingSignal * (0.65 + confidence * 0.35)

      const evidenceBonus = confidence * DIRECTOR_CONFIDENCE_BONUS

      const score = confidenceAdjustedRating + evidenceBonus

      return {
        id: candidate.id,
        name: candidate.name,
        score,
        averageRating,
        titleCount,
      }
    })
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.averageRating - left.averageRating ||
        right.titleCount - left.titleCount ||
        left.id - right.id
    )
    .slice(0, limit)
}

function rankStudioAffinities(
  candidates: Map<number, AffinityAccumulator>,
  limit: number
): DiscoverAffinityCandidate[] {
  return [...candidates.values()]
    .filter((candidate) => candidate.titleIds.size >= DISCOVER_STUDIO_AFFINITY_MIN_TITLES)
    .map((candidate) => {
      const titleCount = candidate.titleIds.size
      const averageRating = getAverageRating(candidate)

      /*
       * Studio rating quality is the primary signal.
       *
       * Repeated titles add confidence, but that bonus
       * saturates so a prolific mediocre studio does
       * not automatically beat a strongly liked one.
       */
      const confidence =
        Math.min(titleCount, STUDIO_CONFIDENCE_TITLE_CAP) / STUDIO_CONFIDENCE_TITLE_CAP

      const score = averageRating * 10 + confidence * STUDIO_CONFIDENCE_BONUS

      return {
        id: candidate.id,
        name: candidate.name,
        score,
        averageRating,
        titleCount,
      }
    })
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.averageRating - left.averageRating ||
        right.titleCount - left.titleCount ||
        left.id - right.id
    )
    .slice(0, limit)
}

export function selectDiscoverAffinities(
  titles: DiscoverAffinityTitle[],
  limit = DISCOVER_AFFINITY_LIMIT
) {
  const actors = new Map<number, AffinityAccumulator>()

  const directors = new Map<number, AffinityAccumulator>()

  const studios = new Map<number, AffinityAccumulator>()

  const uniqueTitles = new Map<string, DiscoverAffinityTitle>()

  for (const title of titles) {
    if (title.rating === null || !Number.isFinite(title.rating) || title.rating < 4) {
      continue
    }

    const existing = uniqueTitles.get(title.titleId)

    if (!existing || (title.rating ?? 0) > (existing.rating ?? 0)) {
      uniqueTitles.set(title.titleId, title)
    }
  }

  for (const title of uniqueTitles.values()) {
    const rating = title.rating

    if (rating === null) {
      continue
    }

    for (const person of title.cast ?? []) {
      addCandidate(actors, person, title.titleId, rating, getCastWeight(person.order))
    }

    if (title.director) {
      addCandidate(directors, title.director, title.titleId, rating, 1)
    }

    for (const studio of title.studios ?? []) {
      addCandidate(studios, studio, title.titleId, rating, 1)
    }
  }

  return {
    actors: rankActorAffinities(actors, limit),
    directors: rankDirectorAffinities(directors, limit),
    studios: rankStudioAffinities(studios, limit),
  }
}
