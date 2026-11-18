import {
  isOfficiallyReleasedEpisode,
  KinoDatabaseService,
  type MediaType,
  parseDateOnly,
  TMDbService,
  type TMDbTitle,
  transformMovieToTitleDetails,
  transformTVToTitleDetails,
} from '@kino/core'
import type { KinoLanguage } from '@kino/core/locale-config'
import { unstable_cache } from 'next/cache'
import { titlePath } from '@/lib/routes'
import { decodeHtmlEntities } from '@/lib/text'
import { AgentError, parsers } from './contract'
import { type agentDb, agentOrigin } from './server'

type CatalogItem = TMDbTitle & {
  original_title?: string
  original_name?: string
  popularity?: number
}

export type StoredTitle = {
  tmdb_id: number
  type: MediaType
  title: string
  release_year: number | null
  cover_image: string | null
}

export function tmdb(language: KinoLanguage) {
  const key = process.env.TMDB_API_KEY || process.env.NEXT_PUBLIC_TMDB_API_KEY
  if (!key) throw new AgentError('temporary_unavailable')
  const service = new TMDbService(key)
  service.setLanguage(language)
  return service
}

export function normalizeName(value: string) {
  return value
    .normalize('NFKD')
    .replace(/\p{Mark}/gu, '')
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .trim()
}

export function imagePath(value: string | null) {
  return (
    value?.match(
      /^(?:https:\/\/image\.tmdb\.org\/t\/p\/(?:original|w\d+))?(\/[a-z\d_.-]+\.(?:jpg|jpeg|png|webp))$/i
    )?.[1] ?? null
  )
}

function presentation(item: CatalogItem, type: MediaType) {
  const name = type === 'movie' ? item.title : item.name
  const original = type === 'movie' ? item.original_title : item.original_name
  const year =
    Number((type === 'movie' ? item.release_date : item.first_air_date)?.slice(0, 4)) || null
  return {
    title: decodeHtmlEntities(name || original || String(item.id)),
    original_title: original ? decodeHtmlEntities(original) : null,
    year,
  }
}

function titleRef(item: CatalogItem, type: MediaType, canonicalName?: string) {
  const info = presentation(item, type)
  const path = imagePath(item.poster_path)
  return {
    id: `${type}:${item.id}`,
    tmdb_id: item.id,
    media_type: type,
    ...info,
    poster: path
      ? {
          w92: `https://image.tmdb.org/t/p/w92${path}`,
          w185: `https://image.tmdb.org/t/p/w185${path}`,
          w342: `https://image.tmdb.org/t/p/w342${path}`,
          w500: `https://image.tmdb.org/t/p/w500${path}`,
          alt: `${info.title}${info.year ? ` (${info.year})` : ''}`,
        }
      : null,
    url: new URL(titlePath(item.id, canonicalName ?? info.title, type), agentOrigin()).toString(),
  }
}

export const catalogDetail = unstable_cache(
  async (language: KinoLanguage, type: MediaType, id: number) => {
    const service = tmdb(language)
    return type === 'movie'
      ? { type, item: await service.getMovieDetails(id) }
      : { type, item: await service.getTVDetails(id) }
  },
  ['agent-catalog-details-v1'],
  { revalidate: 3600 }
)

function catalogMissing(error: unknown) {
  return error instanceof Error && error.message.startsWith('TMDb API error 404:')
}

async function canonicalName(language: KinoLanguage, type: MediaType, item: CatalogItem) {
  if (language === 'en') return presentation(item, type).title
  const canonical = await catalogDetail('en', type, item.id)
  return presentation(canonical.item, type).title
}

export async function localizedRef(language: KinoLanguage, row: StoredTitle) {
  try {
    const { item } = await catalogDetail(language, row.type, row.tmdb_id)
    return titleRef(item, row.type, await canonicalName(language, row.type, item))
  } catch (error) {
    if (!catalogMissing(error)) throw error
    const base = {
      id: row.tmdb_id,
      overview: '',
      poster_path: row.cover_image,
      backdrop_path: null,
      vote_average: 0,
      vote_count: 0,
      genre_ids: [],
    }
    const date = row.release_year ? String(row.release_year) : undefined
    return titleRef(
      row.type === 'movie'
        ? { ...base, title: row.title, release_date: date }
        : { ...base, name: row.title, first_air_date: date },
      row.type
    )
  }
}

export async function searchTitles(
  language: KinoLanguage,
  args: ReturnType<typeof parsers.search_titles>
) {
  const service = tmdb(language)
  const first = await service.search(args.query)
  const rows = [...first.results]
  if (first.total_pages > 1) rows.push(...(await service.search(args.query, 2)).results)
  const query = normalizeName(args.query)
  if (!query) throw new AgentError('validation_error')
  const articleFree = (name: string) =>
    name.replace(/^(?:the|an|a|le|la|les|el|los|las|il|lo|gli|o|os|as|der|die|das) /, '')
  const comparableQuery = articleFree(query)
  const matches = rows
    .flatMap((item: CatalogItem) => {
      const type = item.media_type
      if (!type || (args.media_type && args.media_type !== type)) return []
      const info = presentation(item, type)
      if (args.year && args.year !== info.year) return []
      const names = [normalizeName(info.title), normalizeName(info.original_title ?? '')]
      const exact = names.includes(query)
      const plausible = exact || names.some((name) => articleFree(name) === comparableQuery)
      return [{ type, item, exact, plausible }]
    })
    .sort(
      (a, b) =>
        Number(b.exact) - Number(a.exact) ||
        Number(b.plausible) - Number(a.plausible) ||
        (b.item.popularity ?? 0) - (a.item.popularity ?? 0)
    )
  const unique = [...new Map(matches.map((m) => [`${m.type}:${m.item.id}`, m])).values()]
  if (!unique.length) throw new AgentError('title_not_found')
  const best = unique[0]!
  const confident =
    best.exact &&
    unique.filter((candidate) => candidate.plausible).length === 1 &&
    first.total_pages <= 2
  const candidates = await Promise.all(
    unique.slice(0, args.limit).map(async ({ item, type, exact }) => ({
      ...titleRef(item, type, await canonicalName(language, type, item)),
      overview_short: decodeHtmlEntities(item.overview).slice(0, 240),
      popularity: item.popularity ?? null,
      exact_title_match: exact,
    }))
  )
  return {
    candidates,
    ambiguous: !confident,
    best_match_id: confident ? candidates[0]!.id : null,
    ...(confident ? {} : { ambiguity_code: 'ambiguous_title' }),
  }
}

export async function resolveTitle(
  db: ReturnType<typeof agentDb>,
  language: KinoLanguage,
  id: string
) {
  const [rawType, rawId] = id.split(':')
  const type = rawType as MediaType
  const tmdbId = Number(rawId)
  const detail = await catalogDetail(language, type, tmdbId).catch((error: unknown) => {
    if (catalogMissing(error)) throw new AgentError('title_not_found')
    throw error
  })
  const ref = titleRef(detail.item, detail.type, await canonicalName(language, type, detail.item))
  const { data: existing, error } = await db
    .from('titles')
    .select('id,type')
    .eq('tmdb_id', tmdbId)
    .maybeSingle()
  if (error) throw error
  if (existing && existing.type !== type) throw new AgentError('title_not_found')
  if (existing) return { id: existing.id as string, ref, detail }

  // Persist the same representation as a title-page visit. The type check also covers
  // a concurrent insert of a different TMDB media type sharing this numeric ID.
  const base = language === 'en' ? detail : await catalogDetail('en', type, tmdbId)
  const service = tmdb('en')
  const metadata =
    base.type === 'movie'
      ? transformMovieToTitleDetails(service, base.item, await service.getMovieCredits(tmdbId))
      : transformTVToTitleDetails(service, base.item, await service.getTVCredits(tmdbId))
  const kinoId = await new KinoDatabaseService(db).getOrCreateTitle(metadata)
  const stored = await db.from('titles').select('type').eq('id', kinoId).single()
  if (stored.error) throw stored.error
  if (stored.data.type !== type) throw new AgentError('title_not_found')
  return { id: kinoId, ref, detail }
}

const seasonDetails = unstable_cache(
  async (language: KinoLanguage, id: number, season: number) =>
    tmdb(language).getSeasonDetails(id, season),
  ['agent-catalog-season-v1'],
  { revalidate: 900 }
)

export async function releasedEpisodes(
  language: KinoLanguage,
  detail: Awaited<ReturnType<typeof catalogDetail>>,
  today: string,
  includeSpecials: boolean
) {
  if (detail.type !== 'tv') throw new AgentError('validation_error')
  const seasons = detail.item.seasons.filter(
    (s) => s.season_number > 0 || (includeSpecials && s.season_number === 0)
  )
  const now = parseDateOnly(today)
  if (!now) throw new AgentError('temporary_unavailable')
  const result = []
  for (let index = 0; index < seasons.length; index += 5) {
    const batch = await Promise.all(
      seasons
        .slice(index, index + 5)
        .map((s) => seasonDetails(language, detail.item.id, s.season_number))
    )
    for (const season of batch) {
      for (const episode of season.episodes) {
        const eligible =
          episode.season_number === 0 && includeSpecials
            ? isOfficiallyReleasedEpisode({ ...episode, season_number: 1 }, now)
            : isOfficiallyReleasedEpisode(episode, now)
        if (!eligible) continue
        const still = imagePath(episode.still_path)
        result.push({
          season: episode.season_number,
          episode: episode.episode_number,
          name: decodeHtmlEntities(episode.name),
          runtime_min: episode.runtime && episode.runtime > 0 ? episode.runtime : null,
          still: still ? `https://image.tmdb.org/t/p/w300${still}` : null,
        })
      }
    }
  }
  return result.sort((a, b) => a.season - b.season || a.episode - b.episode)
}

export async function recommendationRef(language: KinoLanguage, type: MediaType, id: number) {
  const { item } = await catalogDetail(language, type, id)
  return {
    title: titleRef(item, type, await canonicalName(language, type, item)),
    overview_short: decodeHtmlEntities(item.overview).slice(0, 240),
    genres: item.genres,
    runtime_min: 'runtime' in item ? (item.runtime ?? null) : null,
    seasons: 'number_of_seasons' in item ? item.number_of_seasons : null,
    community_rating: item.vote_count > 0 ? item.vote_average : null,
  }
}
