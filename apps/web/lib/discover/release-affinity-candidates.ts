import type { DiscoverAffinityCandidate } from './affinity-scoring.ts'

export type DiscoverAffinityCandidateGroups = {
  actors: DiscoverAffinityCandidate[]
  directors: DiscoverAffinityCandidate[]
  studios: DiscoverAffinityCandidate[]
}

export type DiscoverReleaseAffinityCandidate = {
  kind: 'actor' | 'director' | 'studio'
  rank: number
  source: DiscoverAffinityCandidate
}

export function selectAffinityReleaseCandidates(
  affinities: DiscoverAffinityCandidateGroups,
  limitPerKind = 3
): DiscoverReleaseAffinityCandidate[] {
  return [
    ...affinities.actors.slice(0, limitPerKind).map((source, index) => ({
      kind: 'actor' as const,
      rank: index + 1,
      source,
    })),

    ...affinities.directors.slice(0, limitPerKind).map((source, index) => ({
      kind: 'director' as const,
      rank: index + 1,
      source,
    })),

    ...affinities.studios.slice(0, limitPerKind).map((source, index) => ({
      kind: 'studio' as const,
      rank: index + 1,
      source,
    })),
  ]
}
