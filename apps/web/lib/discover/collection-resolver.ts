import type { TMDbCollection, TMDbMovie, TMDbTitle, TMDbTVShow } from '@kino/core'
import type {
  DiscoverCollection,
  DiscoverCollectionDefinition,
  DiscoverCollectionMediaIdentity,
  DiscoverCollectionMediaRef,
  DiscoverCollectionMediaType,
  DiscoverCollectionSource,
  DiscoverCollectionView,
  DiscoverTmdbKeywordSource,
} from './collections.ts'

export type ResolvedDiscoverCollectionGroup = {
  id: string
  titleKey: string
  titleDefault: string
  items: TMDbTitle[]
  viewType: DiscoverCollectionView['type']
}

export type ResolvedDiscoverCollection = {
  hero: TMDbTitle | null
  groups: ResolvedDiscoverCollectionGroup[]
  totalTitles: number
}

type DiscoverKeyword = {
  id: number
  name: string
}

type DiscoverCollectionTmdbClient = {
  getMovieDetails(movieId: number): Promise<TMDbMovie>

  getTVDetails(tvId: number): Promise<TMDbTVShow>

  getCollection(collectionId: number): Promise<TMDbCollection>

  discoverMedia(
    type: DiscoverCollectionMediaType,
    params?: Record<string, string>
  ): Promise<{
    page: number
    results: TMDbTitle[]
    totalPages: number
    totalResults: number
  }>

  /**
   * Optional here so the resolver still typechecks
   * before TMDbService gets the keyword-search method.
   *
   * Keyword sources with a hardcoded keywordId, such
   * as MCU, do not need this method.
   */
  searchKeywords?: (
    query: string,
    page?: number
  ) => Promise<{
    page: number
    results: DiscoverKeyword[]
    total_pages: number
    total_results: number
  }>
}

type ResolvedSourceItem = {
  title: TMDbTitle
  sourceIds: Set<string>
}

const DETAILS_CONCURRENCY = 6
const DISCOVER_CONCURRENCY = 4

/**
 * 20 pages = up to 400 results for one exact
 * franchise keyword.
 *
 * This prevents a bad/generic TMDb keyword from
 * accidentally triggering hundreds of requests.
 */
const MAX_DISCOVER_PAGES = 20
const MAX_KEYWORD_SEARCH_PAGES = 3

function mediaIdentity(item: DiscoverCollectionMediaRef): DiscoverCollectionMediaIdentity {
  return `${item.type}:${item.tmdbId}`
}

function titleIdentity(item: TMDbTitle): DiscoverCollectionMediaIdentity | null {
  if (item.media_type !== 'movie' && item.media_type !== 'tv') {
    return null
  }

  return `${item.media_type}:${item.id}`
}

function withMediaType(item: TMDbTitle, type: DiscoverCollectionMediaType): TMDbTitle {
  return {
    ...item,
    media_type: type,
  }
}

function getReleaseDate(item: TMDbTitle) {
  return item.release_date ?? item.first_air_date ?? ''
}

function getDisplayTitle(item: TMDbTitle) {
  return item.title ?? item.name ?? ''
}

function sortByReleaseDate(items: TMDbTitle[], direction: 'asc' | 'desc' = 'asc') {
  return [...items].sort((a, b) => {
    const aDate = getReleaseDate(a)
    const bDate = getReleaseDate(b)

    /*
     * Undated upcoming titles always go at the end
     * instead of jumping to the front of an
     * ascending timeline.
     */
    if (!aDate && !bDate) {
      return compareTitles(a, b)
    }

    if (!aDate) {
      return 1
    }

    if (!bDate) {
      return -1
    }

    const dateComparison = aDate.localeCompare(bDate)

    if (dateComparison !== 0) {
      return direction === 'desc' ? -dateComparison : dateComparison
    }

    return compareTitles(a, b)
  })
}

function compareTitles(a: TMDbTitle, b: TMDbTitle) {
  const titleComparison = getDisplayTitle(a).localeCompare(getDisplayTitle(b))

  if (titleComparison !== 0) {
    return titleComparison
  }

  return a.id - b.id
}

function uniqueTitles(items: TMDbTitle[]) {
  const seen = new Set<DiscoverCollectionMediaIdentity>()

  return items.filter((item) => {
    const identity = titleIdentity(item)

    if (!identity) {
      return false
    }

    if (seen.has(identity)) {
      return false
    }

    seen.add(identity)
    return true
  })
}

function mergeSourceItems(items: ResolvedSourceItem[]) {
  const byIdentity = new Map<DiscoverCollectionMediaIdentity, ResolvedSourceItem>()

  for (const item of items) {
    const identity = titleIdentity(item.title)

    if (!identity) {
      continue
    }

    const existing = byIdentity.get(identity)

    if (existing) {
      for (const sourceId of item.sourceIds) {
        existing.sourceIds.add(sourceId)
      }

      continue
    }

    byIdentity.set(identity, {
      title: item.title,
      sourceIds: new Set(item.sourceIds),
    })
  }

  return [...byIdentity.values()]
}

function createSourceItem(title: TMDbTitle, ...sourceIds: string[]): ResolvedSourceItem {
  return {
    title,
    sourceIds: new Set(sourceIds),
  }
}

export async function resolveDiscoverCollectionMediaRef({
  tmdb,
  item,
}: {
  tmdb: DiscoverCollectionTmdbClient
  item: DiscoverCollectionMediaRef
}): Promise<TMDbTitle | null> {
  try {
    if (item.type === 'movie') {
      const movie = await tmdb.getMovieDetails(item.tmdbId)

      return {
        ...movie,
        media_type: 'movie',
      }
    }

    const series = await tmdb.getTVDetails(item.tmdbId)

    return {
      ...series,
      media_type: 'tv',
    }
  } catch {
    return null
  }
}

async function resolveMediaRefs({
  tmdb,
  items,
}: {
  tmdb: DiscoverCollectionTmdbClient
  items: readonly DiscoverCollectionMediaRef[]
}) {
  const uniqueRefs = Array.from(new Map(items.map((item) => [mediaIdentity(item), item])).values())

  const resolved = new Map<DiscoverCollectionMediaIdentity, TMDbTitle>()

  for (let index = 0; index < uniqueRefs.length; index += DETAILS_CONCURRENCY) {
    const batch = uniqueRefs.slice(index, index + DETAILS_CONCURRENCY)

    const batchResults = await Promise.all(
      batch.map(async (item) => {
        const title = await resolveDiscoverCollectionMediaRef({
          tmdb,
          item,
        })

        return [mediaIdentity(item), title] as const
      })
    )

    for (const [identity, title] of batchResults) {
      if (title) {
        resolved.set(identity, title)
      }
    }
  }

  return resolved
}

export async function resolveDiscoverCollectionHero({
  tmdb,
  collection,
}: {
  tmdb: DiscoverCollectionTmdbClient
  collection: DiscoverCollection
}) {
  return resolveDiscoverCollectionMediaRef({
    tmdb,
    item: collection.hero,
  })
}

async function resolveTmdbCollectionSource({
  tmdb,
  source,
}: {
  tmdb: DiscoverCollectionTmdbClient
  source: Extract<DiscoverCollectionSource, { type: 'tmdb-collection' }>
}) {
  const resolved: ResolvedSourceItem[] = []

  /*
   * TMDb's belongs_to_collection is movie-only.
   * A non-movie seed therefore gracefully degrades
   * to the seed itself.
   */
  if (source.seed.type !== 'movie') {
    const seed = await resolveDiscoverCollectionMediaRef({
      tmdb,
      item: source.seed,
    })

    if (seed) {
      resolved.push(createSourceItem(seed, source.id))
    }

    return applySourceOverrides({
      tmdb,
      source,
      items: resolved,
    })
  }

  try {
    const seed = await tmdb.getMovieDetails(source.seed.tmdbId)

    const collectionId = seed.belongs_to_collection?.id

    if (!collectionId) {
      resolved.push(
        createSourceItem(
          {
            ...seed,
            media_type: 'movie',
          },
          source.id
        )
      )

      return applySourceOverrides({
        tmdb,
        source,
        items: resolved,
      })
    }

    const collection = await tmdb.getCollection(collectionId)

    for (const part of collection.parts) {
      resolved.push(createSourceItem(withMediaType(part, 'movie'), source.id))
    }

    /*
     * Defensive fallback in case TMDb returns a
     * collection payload without its seed title.
     */
    const seedIdentity = mediaIdentity(source.seed)

    if (!resolved.some((item) => titleIdentity(item.title) === seedIdentity)) {
      resolved.push(
        createSourceItem(
          {
            ...seed,
            media_type: 'movie',
          },
          source.id
        )
      )
    }
  } catch {
    const fallback = await resolveDiscoverCollectionMediaRef({
      tmdb,
      item: source.seed,
    })

    if (fallback) {
      resolved.push(createSourceItem(fallback, source.id))
    }
  }

  return applySourceOverrides({
    tmdb,
    source,
    items: resolved,
  })
}

function normalizeKeyword(value: string) {
  return value
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

async function resolveKeywordId({
  tmdb,
  source,
}: {
  tmdb: DiscoverCollectionTmdbClient
  source: DiscoverTmdbKeywordSource
}) {
  if (source.keywordId) {
    return source.keywordId
  }

  if (!tmdb.searchKeywords) {
    return null
  }

  const expected = normalizeKeyword(source.keywordQuery)

  for (let page = 1; page <= MAX_KEYWORD_SEARCH_PAGES; page += 1) {
    try {
      const response = await tmdb.searchKeywords(source.keywordQuery, page)

      const exact = response.results.find((keyword) => normalizeKeyword(keyword.name) === expected)

      if (exact) {
        return exact.id
      }

      if (page >= response.total_pages) {
        break
      }
    } catch {
      break
    }
  }

  return null
}

async function discoverKeywordPage({
  tmdb,
  mediaType,
  keywordId,
  params,
  page,
}: {
  tmdb: DiscoverCollectionTmdbClient
  mediaType: DiscoverCollectionMediaType
  keywordId: number
  params: Readonly<Record<string, string>> | undefined
  page: number
}) {
  return tmdb.discoverMedia(mediaType, {
    ...params,
    with_keywords: String(keywordId),
    include_adult: params?.include_adult ?? 'false',
    page: String(page),
  })
}

async function resolveKeywordMediaType({
  tmdb,
  source,
  keywordId,
  mediaType,
}: {
  tmdb: DiscoverCollectionTmdbClient
  source: DiscoverTmdbKeywordSource
  keywordId: number
  mediaType: DiscoverCollectionMediaType
}) {
  try {
    const first = await discoverKeywordPage({
      tmdb,
      keywordId,
      mediaType,
      params: source.params,
      page: 1,
    })

    const items: TMDbTitle[] = first.results.map((item) => withMediaType(item, mediaType))

    const totalPages = Math.min(first.totalPages, MAX_DISCOVER_PAGES)

    if (totalPages <= 1) {
      return items
    }

    const pages = Array.from(
      {
        length: totalPages - 1,
      },
      (_, index) => index + 2
    )

    for (let index = 0; index < pages.length; index += DISCOVER_CONCURRENCY) {
      const batch = pages.slice(index, index + DISCOVER_CONCURRENCY)

      const responses = await Promise.all(
        batch.map(async (page) => {
          try {
            return await discoverKeywordPage({
              tmdb,
              keywordId,
              mediaType,
              params: source.params,
              page,
            })
          } catch {
            return null
          }
        })
      )

      for (const response of responses) {
        if (!response) {
          continue
        }

        items.push(...response.results.map((item) => withMediaType(item, mediaType)))
      }
    }

    return uniqueTitles(items)
  } catch {
    return []
  }
}

async function resolveTmdbKeywordSource({
  tmdb,
  source,
}: {
  tmdb: DiscoverCollectionTmdbClient
  source: DiscoverTmdbKeywordSource
}) {
  const keywordId = await resolveKeywordId({
    tmdb,
    source,
  })

  const resolved: ResolvedSourceItem[] = []

  if (keywordId) {
    const responses = await Promise.all(
      source.mediaTypes.map(async (mediaType) => ({
        mediaType,
        items: await resolveKeywordMediaType({
          tmdb,
          source,
          keywordId,
          mediaType,
        }),
      }))
    )

    for (const response of responses) {
      for (const title of response.items) {
        resolved.push(createSourceItem(title, source.id))
      }
    }
  }

  /*
   * Even if the keyword lookup fails, explicit
   * include overrides still get resolved.
   */
  return applySourceOverrides({
    tmdb,
    source,
    items: resolved,
  })
}

async function resolveExplicitSource({
  tmdb,
  source,
}: {
  tmdb: DiscoverCollectionTmdbClient
  source: Extract<DiscoverCollectionSource, { type: 'explicit' }>
}) {
  const resolved = await resolveMediaRefs({
    tmdb,
    items: source.items,
  })

  const items = [...resolved.values()].map((title) => createSourceItem(title, source.id))

  return applySourceOverrides({
    tmdb,
    source,
    items,
  })
}

async function resolveCompositeSource({
  tmdb,
  source,
}: {
  tmdb: DiscoverCollectionTmdbClient
  source: Extract<DiscoverCollectionSource, { type: 'composite' }>
}) {
  const children = await Promise.all(
    source.sources.map((child) =>
      resolveCollectionSource({
        tmdb,
        source: child,
      })
    )
  )

  /*
   * Preserve the child source IDs for source-based
   * views, while also tagging everything with the
   * composite parent's ID.
   */
  const items = children.flat().map((item) => ({
    title: item.title,
    sourceIds: new Set([...item.sourceIds, source.id]),
  }))

  return applySourceOverrides({
    tmdb,
    source,
    items,
  })
}

async function applySourceOverrides({
  tmdb,
  source,
  items,
}: {
  tmdb: DiscoverCollectionTmdbClient
  source: DiscoverCollectionSource
  items: ResolvedSourceItem[]
}) {
  const result = [...items]

  if (source.include && source.include.length > 0) {
    const included = await resolveMediaRefs({
      tmdb,
      items: source.include,
    })

    for (const title of included.values()) {
      result.push(createSourceItem(title, source.id))
    }
  }

  const merged = mergeSourceItems(result)

  if (!source.exclude || source.exclude.length === 0) {
    return merged
  }

  const excluded = new Set(source.exclude.map(mediaIdentity))

  return merged.filter((item) => {
    const identity = titleIdentity(item.title)

    return identity !== null && !excluded.has(identity)
  })
}

async function resolveCollectionSource({
  tmdb,
  source,
}: {
  tmdb: DiscoverCollectionTmdbClient
  source: DiscoverCollectionSource
}): Promise<ResolvedSourceItem[]> {
  switch (source.type) {
    case 'tmdb-collection':
      return resolveTmdbCollectionSource({
        tmdb,
        source,
      })

    case 'tmdb-keyword':
      return resolveTmdbKeywordSource({
        tmdb,
        source,
      })

    case 'composite':
      return resolveCompositeSource({
        tmdb,
        source,
      })

    case 'explicit':
      return resolveExplicitSource({
        tmdb,
        source,
      })
  }
}

function getStaticViewRefs(collection: DiscoverCollectionDefinition) {
  const refs: DiscoverCollectionMediaRef[] = [collection.hero]

  for (const view of collection.views) {
    switch (view.type) {
      case 'selection':
        refs.push(...view.items)
        break

      case 'curated-order':
        refs.push(...view.order)
        break

      case 'release-order':
      case 'source':
      case 'media-type':
      case 'release-range':
        break
    }
  }

  return refs
}

function buildCollectionGroups({
  collection,
  sourceItems,
  titleByIdentity,
}: {
  collection: DiscoverCollectionDefinition
  sourceItems: ResolvedSourceItem[]
  titleByIdentity: Map<DiscoverCollectionMediaIdentity, TMDbTitle>
}) {
  const groups: ResolvedDiscoverCollectionGroup[] = []

  const sourceTitles = sourceItems.map((item) => item.title)

  for (const view of collection.views) {
    let items: TMDbTitle[] = []

    switch (view.type) {
      case 'release-order': {
        items = sortByReleaseDate(sourceTitles, view.direction ?? 'asc')

        break
      }

      case 'source': {
        const sourceIds = new Set(view.sourceIds)

        items = sourceItems
          .filter((item) => [...item.sourceIds].some((sourceId) => sourceIds.has(sourceId)))
          .map((item) => item.title)

        if (view.sort === 'release-order') {
          items = sortByReleaseDate(items)
        }

        break
      }

      case 'media-type': {
        items = sourceTitles.filter((item) => item.media_type === view.mediaType)

        if (view.sort === 'release-order') {
          items = sortByReleaseDate(items)
        }

        break
      }

      case 'release-range': {
        let candidates = sourceItems

        if (view.sourceIds && view.sourceIds.length > 0) {
          const allowedSourceIds = new Set<string>(view.sourceIds)

          candidates = candidates.filter((item) =>
            [...item.sourceIds].some((sourceId) => allowedSourceIds.has(sourceId))
          )
        }

        items = candidates
          .map((item) => item.title)
          .filter((item) => {
            if (view.mediaType && item.media_type !== view.mediaType) {
              return false
            }

            const releaseDate = getReleaseDate(item)

            if (!releaseDate) {
              return false
            }

            if (view.from && releaseDate < view.from) {
              return false
            }

            if (view.to && releaseDate > view.to) {
              return false
            }

            return true
          })

        items = sortByReleaseDate(items, view.direction ?? 'asc')

        break
      }

      case 'selection': {
        items = view.items.flatMap((item) => {
          const resolved = titleByIdentity.get(mediaIdentity(item))

          return resolved ? [resolved] : []
        })

        if (view.sort === 'release-order') {
          items = sortByReleaseDate(items)
        }

        break
      }

      case 'curated-order': {
        const rankedIdentities = new Set(view.order.map(mediaIdentity))

        items = view.order.flatMap((item) => {
          const resolved = titleByIdentity.get(mediaIdentity(item))

          return resolved ? [resolved] : []
        })

        if (view.includeUnranked) {
          const unranked = sourceTitles.filter((item) => {
            const identity = titleIdentity(item)

            return identity !== null && !rankedIdentities.has(identity)
          })

          items.push(...sortByReleaseDate(unranked))
        }

        break
      }
    }

    items = uniqueTitles(items)

    if (items.length === 0) {
      continue
    }

    groups.push({
      id: view.id,
      titleKey: view.titleKey,
      titleDefault: view.titleDefault,
      items,
      viewType: view.type,
    })
  }

  return groups
}

function groupMembershipKey(group: ResolvedDiscoverCollectionGroup) {
  return [
    ...new Set(
      group.items.flatMap((item) => {
        const identity = titleIdentity(item)

        return identity ? [identity] : []
      })
    ),
  ]
    .sort()
    .join('|')
}

function groupPriority(group: ResolvedDiscoverCollectionGroup) {
  switch (group.viewType) {
    case 'curated-order':
      return 50

    case 'selection':
      return 40

    case 'source':
      return 30

    case 'release-range':
      return 30

    case 'media-type':
      return 20

    case 'release-order':
      return 10
  }
}

function collapseRedundantGroups(groups: ResolvedDiscoverCollectionGroup[]) {
  const byMembership = new Map<string, ResolvedDiscoverCollectionGroup>()

  for (const group of groups) {
    const key = groupMembershipKey(group)

    if (!key) {
      continue
    }

    const existing = byMembership.get(key)

    if (!existing) {
      byMembership.set(key, group)
      continue
    }

    /*
     * Prefer a meaningful editorial/source row over
     * a generic Release order row when both contain
     * exactly the same titles.
     */
    if (groupPriority(group) > groupPriority(existing)) {
      byMembership.set(key, group)
    }
  }

  /*
   * Restore the order declared in collection.views.
   */
  return groups.filter((group) => byMembership.get(groupMembershipKey(group)) === group)
}

export async function resolveDiscoverCollection({
  tmdb,
  collection,
}: {
  tmdb: DiscoverCollectionTmdbClient
  collection: DiscoverCollection
}): Promise<ResolvedDiscoverCollection> {
  /*
   * First resolve dynamic franchise membership.
   */
  const sourceItems = await resolveCollectionSource({
    tmdb,
    source: collection.source,
  })

  /*
   * These refs are editorial data required by
   * specific views such as MCU chronology and
   * What If...?. Resolve any of them that the
   * dynamic source did not already return.
   */
  const titleByIdentity = new Map<DiscoverCollectionMediaIdentity, TMDbTitle>()

  for (const item of sourceItems) {
    const identity = titleIdentity(item.title)

    if (identity) {
      titleByIdentity.set(identity, item.title)
    }
  }

  const staticRefs = getStaticViewRefs(collection)

  const missingStaticRefs = staticRefs.filter((item) => !titleByIdentity.has(mediaIdentity(item)))

  if (missingStaticRefs.length > 0) {
    const supplemental = await resolveMediaRefs({
      tmdb,
      items: missingStaticRefs,
    })

    for (const [identity, title] of supplemental) {
      titleByIdentity.set(identity, title)
    }
  }

  const hero = titleByIdentity.get(mediaIdentity(collection.hero)) ?? null

  const groups = collapseRedundantGroups(
    buildCollectionGroups({
      collection,
      sourceItems,
      titleByIdentity,
    })
  )

  /*
   * Count everything actually represented by the
   * rendered views. This avoids the old static-count
   * problem with dynamic collections.
   */
  const totalTitles = new Set(
    groups.flatMap((group) =>
      group.items.flatMap((item) => {
        const identity = titleIdentity(item)

        return identity ? [identity] : []
      })
    )
  ).size

  return {
    hero,
    groups,
    totalTitles,
  }
}
