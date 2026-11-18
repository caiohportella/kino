import { randomUUID } from 'node:crypto'
import { getLocale, getRegion, type KinoLanguage } from '@kino/core/locale-config'
import { watchlistPath } from '@/lib/routes'
import {
  localizedRef,
  normalizeName,
  recommendationRef,
  releasedEpisodes,
  resolveTitle,
  type StoredTitle,
  searchTitles,
  tmdb,
} from './catalog'
import {
  AgentError,
  ATTRIBUTION,
  agentFailure,
  type ErrorCode,
  type Operation,
  parsers,
  readJson,
  UUID,
  WRITE_OPERATIONS,
  type WriteOperation,
} from './contract'
import { agentDb, agentOrigin, agentRpc, bearerHash, digest } from './server'

type Db = ReturnType<typeof agentDb>
type Viewer = {
  user_id: string
  language: KinoLanguage
  timezone: string
  today: string
  default_list_id: string | null
}
type Auth = Partial<Viewer> & { error: ErrorCode | null; retry_after?: number }
type List = {
  id: string
  name: string
  visibility: string
  description: string | null
  item_count: number
}
type AccessibleList = List & { owned: boolean; editable: boolean }
type Entry = { id: string; watched_at: string; catalog: StoredTitle }
type TasteEntry = Entry & {
  rating: number | null
  rating_source: 'title_rating' | 'episode_average' | null
}
type Taste = { top_rated: TasteEntry[]; recent: TasteEntry[]; counts: { rated_titles: number } }

function listRef<T extends List>(list: T) {
  return { ...list, url: new URL(watchlistPath(list.id, list.name), agentOrigin()).toString() }
}

async function findWatchlist(db: Db, viewer: Viewer, name: string | null) {
  const rows = await agentRpc<AccessibleList[]>(db, 'kino_agent_lists', { p_user: viewer.user_id })
  if (name === null) {
    const selected = rows.find((row) => row.id === viewer.default_list_id && row.editable)
    if (selected) return { matches: [listRef(selected)] }
    throw new AgentError('default_list_required', {
      candidates: rows.filter((row) => row.editable).map(listRef),
    })
  }

  const normalized = normalizeName(name)
  const canonical = name.trim().normalize('NFC').toLowerCase()
  const matches = rows.filter((row) => row.name.trim().normalize('NFC').toLowerCase() === canonical)
  if (matches.length) return { matches: matches.map(listRef), ambiguous: matches.length > 1 }
  const suggestions = rows.filter((row) => {
    const candidate = normalizeName(row.name)
    return (
      normalized &&
      candidate &&
      (candidate.includes(normalized) ||
        normalized.includes(candidate) ||
        candidate.startsWith(normalized.slice(0, Math.max(3, normalized.length - 2))))
    )
  })
  throw new AgentError('list_not_found', { candidates: suggestions.slice(0, 8).map(listRef) })
}

function readCursor(cursor: string | null, signature: string) {
  if (!cursor) return { time: null, id: null }
  const [time, id, scope, ...extra] = Buffer.from(cursor, 'base64url').toString().split('|')
  if (
    !time ||
    !id ||
    !UUID.test(id) ||
    scope !== signature ||
    extra.length ||
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?\+00:00$/.test(time) ||
    !Number.isFinite(Date.parse(time))
  )
    throw new AgentError('validation_error')
  return { time, id }
}

async function diary(db: Db, viewer: Viewer, args: ReturnType<typeof parsers.get_diary>) {
  const { since, until, collapse_episodes, limit } = args
  const signature = digest(
    JSON.stringify([viewer.user_id, viewer.timezone, since, until, collapse_episodes])
  )
  const { time, id } = readCursor(args.cursor, signature)
  const result = await agentRpc<{ total: number; entries: Entry[] }>(db, 'kino_agent_diary', {
    p_user: viewer.user_id,
    p_timezone: viewer.timezone,
    p_since: since,
    p_until: until,
    p_collapse: collapse_episodes,
    p_before_time: time,
    p_before_id: id,
    p_limit: limit,
  })
  const page = result.entries.slice(0, limit)
  const last = page.at(-1)
  const entries = await Promise.all(
    page.map(async ({ catalog, watched_at: _timestamp, ...entry }) => ({
      ...entry,
      title: await localizedRef(viewer.language, catalog),
    }))
  )
  return {
    entries,
    total: result.total,
    next_cursor:
      last && result.entries.length > limit
        ? Buffer.from(`${last.watched_at}|${last.id}|${signature}`).toString('base64url')
        : null,
  }
}

async function tasteProfile(db: Db, viewer: Viewer) {
  const result = await agentRpc<Taste>(db, 'kino_agent_taste', { p_user: viewer.user_id })
  const render = ({ catalog, id: _internalId, ...entry }: TasteEntry) =>
    localizedRef(viewer.language, catalog).then((title) => ({ ...entry, title }))
  const [top_rated, recent] = await Promise.all([
    Promise.all(result.top_rated.map(render)),
    Promise.all(result.recent.map(render)),
  ])
  return { ...result, top_rated, recent }
}

async function candidates(db: Db, viewer: Viewer, args: ReturnType<typeof parsers.get_candidates>) {
  const taste = await agentRpc<Taste>(db, 'kino_agent_taste', { p_user: viewer.user_id })
  if (taste.counts.rated_titles < 5)
    throw new AgentError('insufficient_history', { counts: taste.counts })
  const service = tmdb(viewer.language)
  const seeds = taste.top_rated
    .filter(
      (entry) =>
        (entry.rating ?? 0) >= 4 && (!args.media_type || entry.catalog.type === args.media_type)
    )
    .slice(0, args.seed_count)
  const pages = await Promise.all(
    seeds.map(async (seed) => {
      const { type, tmdb_id } = seed.catalog
      const related = await service.getRecommendations(type, tmdb_id)
      return related.map(({ id }) => ({ id: `${type}:${id}`, tmdb_id: id, media_type: type, seed }))
    })
  )
  const pool = new Map<string, (typeof pages)[number][number]>()
  for (const candidate of pages.flat()) {
    if (!pool.has(candidate.id)) pool.set(candidate.id, candidate)
  }
  if (pool.size === 0) return { candidates: [], counts: taste.counts }
  const state = await agentRpc<Array<{ id: string; watched: boolean; in_watchlist: boolean }>>(
    db,
    'kino_agent_candidate_state',
    {
      p_user: viewer.user_id,
      p_candidates: [...pool.values()].map(({ seed: _seed, ...candidate }) => candidate),
    }
  )
  const states = new Map(state.map((item) => [item.id, item]))
  const selected = [...pool.values()]
    .flatMap((item) => {
      const status = states.get(item.id)
      return status && !status.watched ? [{ ...item, in_watchlist: status.in_watchlist }] : []
    })
    .slice(0, args.limit)
  return {
    candidates: await Promise.all(
      selected.map(async (item) => ({
        ...(await recommendationRef(viewer.language, item.media_type, item.tmdb_id)),
        seed: {
          title: await localizedRef(viewer.language, item.seed.catalog),
          rating: item.seed.rating,
          rating_source: item.seed.rating_source,
          relation: 'tmdb_recommendation',
        },
        in_watchlist: item.in_watchlist,
      }))
    ),
    counts: taste.counts,
  }
}

type WriteResult = { error?: ErrorCode; list?: List; candidates?: List[] } & Record<string, unknown>

function writeResponse(result: WriteResult) {
  const { error, list, candidates, ...data } = result
  if (error)
    throw new AgentError(error, {
      ...data,
      ...(candidates ? { candidates: candidates.map(listRef) } : {}),
    })
  return { ...data, ...(list ? { list: listRef(list) } : {}) }
}

async function write(
  db: Db,
  viewer: Viewer,
  hash: string,
  requestId: string,
  operation: WriteOperation,
  input: unknown
) {
  const { idempotency_key, ...args } = parsers[operation](input)
  const key = digest(idempotency_key)
  const fingerprint = digest(JSON.stringify(args))
  const replay = await agentRpc<WriteResult | null>(db, 'kino_agent_replay', {
    p_user: viewer.user_id,
    p_operation: operation,
    p_key: key,
    p_fingerprint: fingerprint,
  })
  if (replay) return writeResponse(replay)

  const title = 'title_id' in args ? args.title_id : 'series_id' in args ? args.series_id : null
  const resolved = title ? await resolveTitle(db, viewer.language, title) : null
  const episodes =
    resolved && 'selector' in args
      ? await releasedEpisodes(
          viewer.language,
          resolved.detail,
          viewer.today,
          'season' in args.selector && args.selector.season === 0
        )
      : undefined
  const result = await agentRpc<WriteResult>(db, 'kino_agent_write', {
    p_hash: hash,
    p_operation: operation,
    p_key: key,
    p_fingerprint: fingerprint,
    p_request_id: requestId,
    p_args: args,
    p_title_id: resolved?.id ?? null,
    p_today: viewer.today,
    p_context: { title: resolved?.ref, released: episodes },
  })
  return writeResponse(result)
}

async function read(
  db: Db,
  viewer: Viewer,
  operation: Exclude<Operation, WriteOperation>,
  input: unknown
) {
  switch (operation) {
    case 'search_titles':
      return searchTitles(viewer.language, parsers.search_titles(input))
    case 'find_watchlist':
      return findWatchlist(db, viewer, parsers.find_watchlist(input).name)
    case 'get_diary':
      return diary(db, viewer, parsers.get_diary(input))
    case 'get_taste_profile':
      parsers.get_taste_profile(input)
      return tasteProfile(db, viewer)
    case 'get_candidates':
      return candidates(db, viewer, parsers.get_candidates(input))
  }
}

export function isWrite(operation: Operation): operation is WriteOperation {
  return (WRITE_OPERATIONS as readonly string[]).includes(operation)
}

export function handleAgentRequest(request: Request, operation: string) {
  return runAgentOperation(
    operation,
    () => {
      if (new URL(request.url).search) throw new AgentError('validation_error')
      return bearerHash(request)
    },
    () => readJson(request)
  )
}

export async function runAgentOperation(
  operation: string,
  credential: () => string,
  readInput: () => Promise<unknown>
) {
  const requestId = randomUUID()
  let meta: { request_id: string; attribution: string; today?: string; user?: object } = {
    request_id: requestId,
    attribution: ATTRIBUTION,
  }
  try {
    if (!Object.hasOwn(parsers, operation)) throw new AgentError('validation_error')
    const action = operation as Operation
    const hash = credential()
    const db = agentDb()
    const auth = await agentRpc<Auth>(db, 'kino_agent_auth', {
      p_hash: hash,
      p_scope: isWrite(action) ? 'write' : 'read',
    })
    if (auth.today && auth.language && auth.timezone)
      meta = {
        ...meta,
        today: auth.today,
        user: {
          locale: getLocale(auth.language),
          region: getRegion(auth.language),
          timezone: auth.timezone,
        },
      }
    if (auth.error)
      throw new AgentError(auth.error, auth.retry_after ? { retry_after: auth.retry_after } : {})
    const input = await readInput()
    const result = isWrite(action)
      ? await write(db, auth as Viewer, hash, requestId, action, input)
      : await read(db, auth as Viewer, action, input)
    return Response.json({ ...result, meta }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    if (!(error instanceof AgentError)) console.error('[kino-agent] request failed', { requestId })
    return agentFailure(error, meta)
  }
}
