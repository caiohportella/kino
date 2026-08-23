import type { TMDbPersonCredit, TMDbTitle } from '@kino/core'
import { TMDbService } from '@kino/core'

import type { DiscoverAffinityCandidate } from './affinity-scoring.ts'
import {
  selectActorSeriesCredits,
  selectCreatorSeriesCredits,
  selectDirectedDiscoverResults,
} from './related-release-sources.ts'
import {
  type DiscoverAffinityCandidateGroups,
  selectAffinityReleaseCandidates,
} from './release-affinity-candidates.ts'
import { selectRecentRelatedReleases } from './release-candidates.ts'
import type { DiscoverRelatedReleaseSignal } from './release-relevance.ts'

type ReleaseWindow = {
  start: string
  end: string
}

type GetRelatedReleaseSignalsInput = {
  affinityCandidates: DiscoverAffinityCandidateGroups
  language: string
  region: string
  window: ReleaseWindow
}

type TypedTMDbTitle = TMDbTitle & {
  media_type: 'movie' | 'tv'
}

function createTmdb(language: string) {
  const apiKey = process.env.TMDB_API_KEY ?? process.env.NEXT_PUBLIC_TMDB_API_KEY

  if (!apiKey) {
    throw new Error('Missing TMDB API key.')
  }

  const tmdb = new TMDbService(apiKey)

  /*
   * TMDbService expects the Kino language code
   * such as "pt" or "en". It maps that internally
   * to the actual TMDb locale.
   */
  tmdb.setLanguage(language)

  return tmdb
}

function hasMediaType(item: TMDbTitle): item is TypedTMDbTitle {
  return item.media_type === 'movie' || item.media_type === 'tv'
}

function getMovieDiscoverParams(window: ReleaseWindow, region: string) {
  return {
    region,
    'primary_release_date.gte': window.start,
    'primary_release_date.lte': window.end,
    with_release_type: '2|3|4',
    sort_by: 'popularity.desc',
  }
}

async function getActorSeriesReleases(
  tmdb: TMDbService,
  source: DiscoverAffinityCandidate,
  window: ReleaseWindow
): Promise<TypedTMDbTitle[]> {
  const person = await tmdb.getPersonDetails(source.id)

  const castCredits = selectActorSeriesCredits(person.combined_credits?.cast ?? [])

  return selectRecentRelatedReleases(castCredits, window)
}

async function getCreatorSeriesReleases(
  tmdb: TMDbService,
  source: DiscoverAffinityCandidate,
  window: ReleaseWindow
): Promise<TypedTMDbTitle[]> {
  const person = await tmdb.getPersonDetails(source.id)

  const crewCredits = selectCreatorSeriesCredits(person.combined_credits?.crew ?? [])

  return selectRecentRelatedReleases(crewCredits, window)
}

async function getStudioSeriesReleases(
  tmdb: TMDbService,
  source: DiscoverAffinityCandidate,
  window: ReleaseWindow
): Promise<TypedTMDbTitle[]> {
  const result = await tmdb.discoverMedia('tv', {
    'first_air_date.gte': window.start,
    'first_air_date.lte': window.end,
    with_companies: String(source.id),
    sort_by: 'popularity.desc',
    include_null_first_air_dates: 'false',
  })

  return selectRecentRelatedReleases(result.results.filter(hasMediaType), window)
}

async function getActorReleases(
  tmdb: TMDbService,
  source: DiscoverAffinityCandidate,
  region: string,
  window: ReleaseWindow
): Promise<TypedTMDbTitle[]> {
  const result = await tmdb.discoverMedia('movie', {
    ...getMovieDiscoverParams(window, region),
    with_cast: String(source.id),
  })

  return selectRecentRelatedReleases(result.results.filter(hasMediaType), window)
}

async function getDirectorReleases(
  tmdb: TMDbService,
  source: DiscoverAffinityCandidate,
  region: string,
  window: ReleaseWindow
): Promise<TypedTMDbTitle[]> {
  const [discoverResult, person] = await Promise.all([
    tmdb.discoverMedia('movie', {
      ...getMovieDiscoverParams(window, region),
      with_crew: String(source.id),
    }),

    tmdb.getPersonDetails(source.id),
  ])

  const discoverTitles = discoverResult.results.filter(hasMediaType)

  const crew: TMDbPersonCredit[] = person.combined_credits?.crew ?? []

  /*
   * with_crew can include writers, producers,
   * composers, etc. Intersect it with actual
   * Director / Creator credits so the signal
   * remains semantically correct.
   */
  const directed = selectDirectedDiscoverResults(discoverTitles, crew)

  return selectRecentRelatedReleases(directed, window)
}

async function getStudioReleases(
  tmdb: TMDbService,
  source: DiscoverAffinityCandidate,
  region: string,
  window: ReleaseWindow
): Promise<TypedTMDbTitle[]> {
  const result = await tmdb.discoverMedia('movie', {
    ...getMovieDiscoverParams(window, region),
    with_companies: String(source.id),
  })

  return selectRecentRelatedReleases(result.results.filter(hasMediaType), window)
}

export async function getRelatedReleaseSignals({
  affinityCandidates,
  language,
  region,
  window,
}: GetRelatedReleaseSignalsInput): Promise<DiscoverRelatedReleaseSignal<TypedTMDbTitle>[]> {
  const candidates = selectAffinityReleaseCandidates(affinityCandidates, 3)

  if (candidates.length === 0) {
    return []
  }

  const tmdb = createTmdb(language)

  const results = await Promise.allSettled(
    candidates.map(async (candidate) => {
      let items: TypedTMDbTitle[]

      switch (candidate.kind) {
        case 'actor':
          items = await getActorReleases(tmdb, candidate.source, region, window)
          break

        case 'director':
          items = await getDirectorReleases(tmdb, candidate.source, region, window)
          break

        case 'studio':
          items = await getStudioReleases(tmdb, candidate.source, region, window)
          break
      }

      return {
        candidate,
        items,
      }
    })
  )

  return results.flatMap((result) => {
    if (result.status !== 'fulfilled' || result.value.items.length === 0) {
      return []
    }

    return [
      {
        kind: result.value.candidate.kind,
        items: result.value.items,
      },
    ]
  })
}

export async function getRelatedSeriesSignals({
  affinityCandidates,
  language,
  window,
}: {
  affinityCandidates: DiscoverAffinityCandidateGroups
  language: string
  window: ReleaseWindow
}): Promise<DiscoverRelatedReleaseSignal<TypedTMDbTitle>[]> {
  const candidates = selectAffinityReleaseCandidates(affinityCandidates, 3)

  if (candidates.length === 0) {
    return []
  }

  const tmdb = createTmdb(language)

  const results = await Promise.allSettled(
    candidates.map(async (candidate) => {
      let items: TypedTMDbTitle[]

      switch (candidate.kind) {
        case 'actor':
          items = await getActorSeriesReleases(tmdb, candidate.source, window)
          break

        case 'director':
          items = await getCreatorSeriesReleases(tmdb, candidate.source, window)
          break

        case 'studio':
          items = await getStudioSeriesReleases(tmdb, candidate.source, window)
          break
      }

      return {
        candidate,
        items,
      }
    })
  )

  return results.flatMap((result) => {
    if (result.status !== 'fulfilled' || result.value.items.length === 0) {
      return []
    }

    return [
      {
        kind: result.value.candidate.kind,
        items: result.value.items,
      },
    ]
  })
}

export async function getRecentSeriesReleases({
  language,
  window,
}: {
  language: string
  window: ReleaseWindow
}): Promise<TypedTMDbTitle[]> {
  const tmdb = createTmdb(language)

  const result = await tmdb.discoverMedia('tv', {
    'first_air_date.gte': window.start,
    'first_air_date.lte': window.end,
    include_null_first_air_dates: 'false',
    sort_by: 'popularity.desc',
  })

  return selectRecentRelatedReleases(result.results.filter(hasMediaType), window)
}
