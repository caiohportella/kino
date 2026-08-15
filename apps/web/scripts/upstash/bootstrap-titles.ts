import { type MediaType, type TMDbTitle } from '@kino/core'

import {
  createTitleIndexer,
  titleDocumentFromTmdbTitle,
} from '../../lib/search/upstash/title-indexer.ts'
import { parseCliArgs, readScriptTmdbApiKey, readScriptUpstashConfig } from './shared.ts'

const TMDB_API_BASE = 'https://api.themoviedb.org/3'

interface TmdbPageResponse {
  readonly results?: readonly TMDbTitle[]
}

function intFlag(value: string | boolean | undefined, fallback: number): number {
  if (typeof value !== 'string') return fallback
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

async function fetchTmdbPage(
  apiKey: string,
  endpoint: string,
  params: Record<string, string>
): Promise<readonly TMDbTitle[]> {
  const url = new URL(`${TMDB_API_BASE}${endpoint}`)
  url.search = new URLSearchParams({ api_key: apiKey, language: 'en-US', ...params }).toString()
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(
      `TMDb bootstrap failed for ${endpoint}: ${response.status} ${response.statusText}`
    )
  }
  const payload = (await response.json()) as TmdbPageResponse
  return Array.isArray(payload.results) ? payload.results : []
}

function titleMediaType(title: TMDbTitle, fallback: MediaType): MediaType {
  return title.media_type === 'tv' ? 'tv' : title.media_type === 'movie' ? 'movie' : fallback
}

async function fetchPages(
  apiKey: string,
  endpoint: string,
  pages: number,
  extraParams: Record<string, string> = {}
): Promise<readonly TMDbTitle[]> {
  const batches = await Promise.all(
    Array.from({ length: pages }, async (_, index) =>
      fetchTmdbPage(apiKey, endpoint, { page: String(index + 1), ...extraParams })
    )
  )
  return batches.flat()
}

function documentsFromTitles(titles: readonly TMDbTitle[], fallback: MediaType) {
  return titles
    .map((item) =>
      titleDocumentFromTmdbTitle({
        mediaType: titleMediaType(item, fallback),
        title: item,
        aliases: [],
        locale: 'en-US',
      })
    )
    .filter((document): document is NonNullable<typeof document> => document !== null)
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2))
  const apiKey = readScriptTmdbApiKey(process.env)
  const upstash = readScriptUpstashConfig(process.env)
  const indexer = createTitleIndexer(upstash)
  const pages = Math.min(
    5,
    intFlag(args.get('pages'), Number(process.env.UPSTASH_SEARCH_BOOTSTRAP_PAGES ?? 2))
  )
  const includeNowPlaying =
    args.has('include-now-playing') || process.env.UPSTASH_SEARCH_BOOTSTRAP_NOW_PLAYING === '1'
  const includeUpcoming =
    args.has('include-upcoming') || process.env.UPSTASH_SEARCH_BOOTSTRAP_UPCOMING === '1'

  const sources = await Promise.all([
    fetchPages(apiKey, '/trending/all/day', pages).then((titles) =>
      documentsFromTitles(titles, 'movie')
    ),
    fetchPages(apiKey, '/movie/popular', pages).then((titles) =>
      documentsFromTitles(titles, 'movie')
    ),
    fetchPages(apiKey, '/tv/popular', pages).then((titles) => documentsFromTitles(titles, 'tv')),
    fetchPages(apiKey, '/movie/top_rated', pages).then((titles) =>
      documentsFromTitles(titles, 'movie')
    ),
    fetchPages(apiKey, '/tv/top_rated', pages).then((titles) => documentsFromTitles(titles, 'tv')),
    ...(includeNowPlaying
      ? [
          fetchPages(apiKey, '/movie/now_playing', pages, { region: 'US' }).then((titles) =>
            documentsFromTitles(titles, 'movie')
          ),
        ]
      : []),
    ...(includeUpcoming
      ? [
          fetchPages(apiKey, '/movie/upcoming', pages, { region: 'US' }).then((titles) =>
            documentsFromTitles(titles, 'movie')
          ),
        ]
      : []),
  ])
  const documents = sources.flat()

  const unique = new Map(documents.map((document) => [document.id, document] as const))
  await indexer.upsertDocument([...unique.values()])

  console.info(
    JSON.stringify({
      sourceCount: sources.length,
      titleCount: documents.length,
      indexedCount: unique.size,
      pages,
      includeNowPlaying,
      includeUpcoming,
    })
  )
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
