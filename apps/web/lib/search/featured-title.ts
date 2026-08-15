import type { SearchResult } from '@kino/core'
import { compareTitleRankingSignals, titleRankingSignals } from '@kino/core/search'

import { normalizeSearchText } from './upstash/ranking.ts'

export type FeaturedTitleResult = Extract<SearchResult, { kind: 'title' }>

function normalizeCandidate(value: string | undefined): string {
  return normalizeSearchText((value ?? '').trim())
}

function tokenize(value: string): readonly string[] {
  return normalizeCandidate(value).split(' ').filter(Boolean)
}

function candidateTexts(result: FeaturedTitleResult): readonly string[] {
  return Array.from(
    new Set(
      [result.name, result.media.title, result.media.name]
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        .map((value) => normalizeCandidate(value))
        .filter(Boolean)
    )
  )
}

function bestDisplayTitle(result: FeaturedTitleResult): string {
  return (
    [result.name, result.media.title, result.media.name].find(
      (value): value is string => typeof value === 'string' && value.trim().length > 0
    ) ?? ''
  )
}

function titleRankingSignalsForResult(
  normalizedQuery: string,
  result: FeaturedTitleResult
): ReturnType<typeof titleRankingSignals> {
  const queryTokens = tokenize(normalizedQuery)
  const candidates = candidateTexts(result)
  const exactMatch = candidates.some((candidate) => candidate === normalizedQuery)
  const prefixMatch =
    !exactMatch && candidates.some((candidate) => candidate.startsWith(normalizedQuery))
  const tokenMatch =
    queryTokens.length > 0 &&
    candidates.some((candidate) => {
      const candidateTokens = candidate.split(' ').filter(Boolean)
      return queryTokens.every((token) => candidateTokens.includes(token))
    })

  return titleRankingSignals(
    {
      ...(exactMatch ? { exactMatch: true } : {}),
      ...(prefixMatch ? { prefixMatch: true } : {}),
      lexicalScore: exactMatch ? 1 : prefixMatch ? 0.85 : tokenMatch ? 0.65 : 0,
    },
    {
      voteCount: result.media.vote_count,
      popularity: (result.media as { readonly popularity?: number }).popularity,
      voteAverage: result.media.vote_average,
    }
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
  const normalizedQuery = normalizeCandidate(query)
  if (!normalizedQuery || results.length === 0) return null

  const scored = results.map((result, index) => ({
    index,
    result,
    signals: titleRankingSignalsForResult(normalizedQuery, result),
  }))

  const eligible = scored.filter((entry) => entry.signals.tier !== 'weak')
  if (eligible.length === 0) return results[0] ?? null

  const selected = eligible.sort((left, right) => {
    return compareTitleRankingSignals(left.signals, right.signals) || left.index - right.index
  })[0]

  return selected?.result ?? null
}

export function getFeaturedTitleCompletion(
  query: string,
  result: FeaturedTitleResult | null
): string | null {
  if (!result) return null

  const displayTitle = bestDisplayTitle(result)
  const normalizedQuery = normalizeCandidate(query)
  if (!normalizedQuery || !displayTitle) return null

  if (!normalizeCandidate(displayTitle).startsWith(normalizedQuery)) return null

  const trimmedQuery = query.trim()
  if (trimmedQuery.length >= displayTitle.length) return null

  return displayTitle.slice(trimmedQuery.length)
}
