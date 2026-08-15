import { type MediaType } from '@kino/core'

import {
  createTitleIndexer,
  titleDocumentFromTmdbTitle,
} from '../../lib/search/upstash/title-indexer.ts'
import { createScriptTmdbService, parseCliArgs, readScriptUpstashConfig } from './shared.ts'

function mediaTypeFromArg(value: string | boolean | undefined): MediaType {
  const raw = typeof value === 'string' ? value : ''

  if (raw === 'tv' || raw === 'series') return 'tv'
  if (raw === 'movie') return 'movie'

  throw new Error('Usage: pnpm upstash:reindex-title --mediaType=movie|tv --tmdbId=<id>')
}

function tmdbIdFromArg(value: string | boolean | undefined): number {
  const raw = typeof value === 'string' ? value : ''
  const parsed = Number(raw)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error('Missing or invalid --tmdbId')
  }
  return parsed
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2))
  const upstash = readScriptUpstashConfig(process.env)
  const tmdb = createScriptTmdbService(process.env)
  const indexer = createTitleIndexer(upstash)
  const mediaType = mediaTypeFromArg(args.get('mediaType'))
  const tmdbId = tmdbIdFromArg(args.get('tmdbId'))

  if (mediaType === 'movie') {
    const [movie, credits] = await Promise.all([
      tmdb.getMovieDetails(tmdbId),
      tmdb.getMovieCredits(tmdbId),
    ])
    const director = credits.crew.filter((person) => person.job === 'Director')
    const document = titleDocumentFromTmdbTitle({
      mediaType,
      title: movie,
      cast: credits.cast,
      directors: director,
      locale: 'en-US',
    })
    if (document) await indexer.upsertDocument(document)
  } else {
    const [tv, credits] = await Promise.all([tmdb.getTVDetails(tmdbId), tmdb.getTVCredits(tmdbId)])
    const creators = credits.crew.filter((person) => person.job === 'Creator')
    const directors = credits.crew.filter((person) => person.job === 'Director')
    const document = titleDocumentFromTmdbTitle({
      mediaType,
      title: tv,
      cast: credits.cast,
      creators,
      directors,
      locale: 'en-US',
    })
    if (document) await indexer.upsertDocument(document)
  }

  console.info(JSON.stringify({ tmdbId, mediaType, indexed: true }))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
