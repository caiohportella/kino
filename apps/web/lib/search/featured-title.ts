import type { SearchResult } from '@kino/core'

import { normalizeSearchText } from './upstash/ranking.ts'

export type FeaturedTitleResult = Extract<SearchResult, { kind: 'title' }>

function normalizeCandidate(value: string | undefined): string {
  return normalizeSearchText((value ?? '').trim())
}

function bestDisplayTitle(result: FeaturedTitleResult): string {
  return (
    [result.name, result.media.title, result.media.name].find(
      (value): value is string => typeof value === 'string' && value.trim().length > 0
    ) ?? ''
  )
}

export function titleSearchResultIdentity(result: FeaturedTitleResult): string {
  return `${result.mediaType}:${result.media.id}`
}

export function withoutFeaturedTitleResult(
  results: readonly FeaturedTitleResult[],
  featured: FeaturedTitleResult | null
): readonly FeaturedTitleResult[] {
  if (!featured) return results

  const featuredIdentity = titleSearchResultIdentity(featured)

  return results.filter((result) => titleSearchResultIdentity(result) !== featuredIdentity)
}

export function selectFeaturedTitleResult(
  query: string,
  results: readonly FeaturedTitleResult[]
): FeaturedTitleResult | null {
  if (!normalizeCandidate(query) || results.length === 0) {
    return null
  }

  return results[0] ?? null
}

export function getFeaturedTitleCompletion(
  query: string,
  result: FeaturedTitleResult | null
): string | null {
  if (!result) return null

  const displayTitle = bestDisplayTitle(result)
  const normalizedQuery = normalizeCandidate(query)

  if (!normalizedQuery || !displayTitle) return null

  if (!normalizeCandidate(displayTitle).startsWith(normalizedQuery)) {
    return null
  }

  const trimmedQuery = query.trim()

  if (trimmedQuery.length >= displayTitle.length) {
    return null
  }

  return displayTitle.slice(trimmedQuery.length)
}
