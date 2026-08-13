export interface SearchRankingDebugEntry {
  readonly query: string
  readonly entityId: string
  readonly entityType: string
  readonly tmdbId?: number
  readonly source: string
  readonly upstashScore: number
  readonly finalScore: number
  readonly exactTitleBoost?: number
  readonly exactOriginalTitleBoost?: number
  readonly prefixTitleBoost?: number
  readonly exactUsernameBoost?: number
  readonly usernamePrefixBoost?: number
  readonly exactDisplayNameBoost?: number
  readonly popularityBoost?: number
  readonly voteCountBoost?: number
}

export function logSearchRankingDebug(entries: readonly SearchRankingDebugEntry[]): void {
  if (entries.length === 0 || process.env.NODE_ENV !== 'development') return
  console.debug('[kino-search-ranking]', JSON.stringify(entries.slice(0, 10)))
}
