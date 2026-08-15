import { readRedisServerEnv, readTmdbServerApiKey } from '../../../../../lib/search/server-env.ts'
import { createRedisSearchClient } from '../../../../../lib/search/upstash/client.ts'
import { personDocumentFromTmdb } from '../../../../../lib/search/upstash/person-document.ts'
import { createPersonIndexer } from '../../../../../lib/search/upstash/person-indexer.ts'
import { normalizeTitleDocument } from '../../../../../lib/search/upstash/title-document.ts'
import { createTitleIndexer } from '../../../../../lib/search/upstash/title-indexer.ts'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function validBody(value: unknown): value is { tmdbId: number; type: 'movie' | 'tv' } {
  if (!value || typeof value !== 'object') return false
  const body = value as Record<string, unknown>
  return (
    Number.isInteger(body.tmdbId) &&
    Number(body.tmdbId) > 0 &&
    (body.type === 'movie' || body.type === 'tv')
  )
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!validBody(body)) return Response.json({ error: 'invalid_body' }, { status: 400 })
  const config = readRedisServerEnv()
  const apiKey = readTmdbServerApiKey()
  if (!config || !apiKey) return Response.json({ ok: true, indexed: false })
  const type = body.type
  const base = `https://api.themoviedb.org/3/${type}/${body.tmdbId}`
  const url = new URL(base)
  url.search = new URLSearchParams({
    api_key: apiKey,
    append_to_response: 'credits,external_ids',
  }).toString()
  try {
    const response = await fetch(url, { cache: 'no-store' })
    if (!response.ok) return Response.json({ ok: true, indexed: false }, { status: 202 })
    const payload = (await response.json()) as Record<string, any>
    const mediaType = type === 'tv' ? 'series' : 'movie'
    const title = normalizeTitleDocument({
      tmdbId: body.tmdbId,
      type,
      title: payload.title ?? payload.name,
      originalTitle: payload.original_title,
      originalName: payload.original_name,
      overview: payload.overview,
      year: Number((payload.release_date ?? payload.first_air_date ?? '').slice(0, 4)) || null,
      popularity: payload.popularity,
      voteAverage: payload.vote_average,
      voteCount: payload.vote_count,
      posterPath: payload.poster_path,
      backdropPath: payload.backdrop_path,
    })
    const redis = createRedisSearchClient(config)
    if (title) await createTitleIndexer({ client: redis }).upsertDocument(title)
    const credits = payload.credits as Record<string, unknown> | undefined
    const people = [
      ...(Array.isArray(credits?.cast) ? credits.cast : []),
      ...(Array.isArray(credits?.crew) ? credits.crew : []),
    ]
      .filter((person): person is Record<string, any> =>
        Boolean(person && typeof person === 'object' && Number.isInteger(person.id) && person.name)
      )
      .slice(0, 100)
      .map((person) =>
        personDocumentFromTmdb({
          id: person.id,
          name: person.name,
          known_for_department: person.known_for_department,
          popularity: person.popularity,
          profile_path: person.profile_path,
        })
      )
      .filter((person): person is NonNullable<typeof person> => person !== null)
    if (people.length) await createPersonIndexer({ client: redis }).upsertDocument(people)
    return Response.json({ ok: true, indexed: Boolean(title), mediaType })
  } catch {
    return Response.json({ ok: true, indexed: false }, { status: 202 })
  }
}
