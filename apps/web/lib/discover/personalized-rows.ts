import type { MediaType, TMDbTitle } from '@kino/core'

export type PersonalizedRowKind = 'title' | 'genre' | 'director' | 'studio'

export type PersonalizedRowSource =
  | {
      kind: 'title'
      tmdbId: number
      mediaType: MediaType
      title: string
    }
  | {
      kind: 'genre'
      genreId: number
      name: string
    }
  | {
      kind: 'director'
      personId: number
      name: string
    }
  | {
      kind: 'studio'
      companyId: number
      name: string
    }

export type PersonalizedRowCandidate = {
  id: string
  kind: PersonalizedRowKind

  titleKey: string
  titleDefault: string
  titleValues?: Record<string, string | number>

  score: number

  items: TMDbTitle[]

  source: PersonalizedRowSource
}

export type PersonalizedRow = {
  id: string

  kind: PersonalizedRowKind

  titleKey: string
  titleDefault: string
  titleValues?: Record<string, string | number>

  items: TMDbTitle[]

  source: PersonalizedRowSource
}

const MIN_ROW_ITEMS = 6
const MAX_ROW_ITEMS = 12

const MAX_SELECTED_ROWS = 5

const RESERVED_PERSONALIZED_KINDS = ['genre', 'studio'] as const

/*
 * If two candidate rows share most of their titles,
 * showing both makes Discover feel repetitive.
 */
const MAX_ROW_OVERLAP = 0.4

export function selectPersonalizedRows(
  candidates: readonly PersonalizedRowCandidate[],
  {
    limit = MAX_SELECTED_ROWS,
  }: {
    limit?: number
  } = {}
): PersonalizedRow[] {
  const eligible = candidates
    .map(normalizeCandidate)
    .filter((candidate): candidate is PersonalizedRowCandidate => candidate !== null)
    .sort(compareCandidates)

  const selected: PersonalizedRowCandidate[] = []

  function canSelect(candidate: PersonalizedRowCandidate) {
    if (selected.some((existing) => existing.id === candidate.id)) {
      return false
    }

    return !selected.some(
      (existing) => calculateRowOverlap(existing.items, candidate.items) > MAX_ROW_OVERLAP
    )
  }

  /*
   * Genre and studio are important taste signals on Discover.
   * Reserve one viable row for each before filling the remaining
   * slots with the strongest candidates overall.
   */
  for (const kind of RESERVED_PERSONALIZED_KINDS) {
    if (selected.length >= limit) {
      break
    }

    const candidate = eligible.find((current) => current.kind === kind && canSelect(current))

    if (candidate) {
      selected.push(candidate)
    }
  }

  /*
   * Prefer distinct personalization kinds for the remaining slots.
   */
  for (const candidate of eligible) {
    if (selected.length >= limit) {
      break
    }

    if (!canSelect(candidate)) {
      continue
    }

    const repeatsKind = selected.some((existing) => existing.kind === candidate.kind)

    if (repeatsKind) {
      continue
    }

    selected.push(candidate)
  }

  /*
   * If diversity still leaves room, allow repeated kinds while
   * continuing to reject highly overlapping rows.
   */
  for (const candidate of eligible) {
    if (selected.length >= limit) {
      break
    }

    if (canSelect(candidate)) {
      selected.push(candidate)
    }
  }

  return selected.map(({ score: _score, ...candidate }) => candidate)
}

function normalizeCandidate(candidate: PersonalizedRowCandidate): PersonalizedRowCandidate | null {
  const items = uniqueTitles(candidate.items).slice(0, MAX_ROW_ITEMS)

  if (items.length < MIN_ROW_ITEMS) {
    return null
  }

  return {
    ...candidate,
    items,
  }
}

function compareCandidates(left: PersonalizedRowCandidate, right: PersonalizedRowCandidate) {
  if (left.score !== right.score) {
    return right.score - left.score
  }

  return left.id.localeCompare(right.id)
}

function uniqueTitles(items: readonly TMDbTitle[]) {
  const titles = new Map<string, TMDbTitle>()

  for (const item of items) {
    const identity = getTitleIdentity(item)

    if (!identity) {
      continue
    }

    if (!titles.has(identity)) {
      titles.set(identity, item)
    }
  }

  return [...titles.values()]
}

function calculateRowOverlap(left: readonly TMDbTitle[], right: readonly TMDbTitle[]) {
  const leftIds = new Set(
    left.map(getTitleIdentity).filter((identity): identity is string => identity !== null)
  )

  const rightIds = new Set(
    right.map(getTitleIdentity).filter((identity): identity is string => identity !== null)
  )

  if (leftIds.size === 0 || rightIds.size === 0) {
    return 0
  }

  let shared = 0

  for (const identity of leftIds) {
    if (rightIds.has(identity)) {
      shared += 1
    }
  }

  return shared / Math.min(leftIds.size, rightIds.size)
}

function getTitleIdentity(item: TMDbTitle) {
  if (item.media_type !== 'movie' && item.media_type !== 'tv') {
    return null
  }

  return `${item.media_type}:${item.id}`
}
