export const ATTRIBUTION =
  'This product uses the TMDB API but is not endorsed or certified by TMDB.'

const errors = {
  ambiguous_title: [409, 'Choose the intended title.'],
  ambiguous_list: [409, 'Choose the intended watchlist.'],
  title_not_found: [404, 'No matching title was found.'],
  list_not_found: [404, 'No matching watchlist was found.'],
  default_list_required: [
    409,
    'Select a default watchlist or choose a destination for this request.',
  ],
  name_conflict: [409, 'You already have a watchlist with this name.'],
  invalid_rating: [422, 'Use half-star increments from 0.5 to 5. Rate individual episodes for TV.'],
  nothing_to_mark: [409, 'There are no eligible unwatched episodes in this selection.'],
  insufficient_history: [
    422,
    'Personalized candidates require at least five distinct rated titles.',
  ],
  unauthorized: [401, 'A valid Kino integration token is required.'],
  forbidden: [403, 'This connection lacks permission for this operation.'],
  rate_limited: [429, 'Too many requests. Try again shortly.'],
  validation_error: [400, 'The request contains missing or invalid parameters.'],
  idempotency_conflict: [409, 'This key has already been used with different parameters.'],
  temporary_unavailable: [503, 'Kino is temporarily unavailable.'],
} as const

export type ErrorCode = keyof typeof errors

export class AgentError extends Error {
  readonly code: ErrorCode
  readonly details: Record<string, unknown>

  constructor(code: ErrorCode, details: Record<string, unknown> = {}) {
    super(errors[code][1])
    this.code = code
    this.details = details
  }

  get status() {
    return errors[this.code][0]
  }
}

export const WRITE_OPERATIONS = [
  'add_to_watchlist',
  'create_watchlist',
  'log_watch',
  'mark_episodes',
] as const
export const READ_OPERATIONS = [
  'search_titles',
  'find_watchlist',
  'get_diary',
  'get_taste_profile',
  'get_candidates',
] as const
export type WriteOperation = (typeof WRITE_OPERATIONS)[number]
export type Operation = WriteOperation | (typeof READ_OPERATIONS)[number]

export const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i
const TITLE_ID = /^(movie|tv):[1-9][0-9]{0,9}$/
const KEY = /^[A-Za-z0-9._:-]{1,128}$/

type Obj = Record<string, unknown>
export function object(value: unknown, keys: string[]): Obj {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => !keys.includes(key))
  )
    throw new AgentError('validation_error')
  return value as Obj
}

export function string(value: unknown, max: number, allowBlank = false) {
  if (
    typeof value !== 'string' ||
    value.length > max ||
    (!allowBlank && !value.trim()) ||
    /[\x00-\x08\x0b\x0c\x0e-\x1f\u007f]/u.test(value) ||
    /[\uD800-\uDFFF]/u.test(value)
  )
    throw new AgentError('validation_error')
  return value
}

function integer(value: unknown, min: number, max: number) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max)
    throw new AgentError('validation_error')
  return value
}

export function choice<const T extends string>(value: unknown, choices: readonly T[]): T {
  if (typeof value !== 'string' || !choices.includes(value as T))
    throw new AgentError('validation_error')
  return value as T
}

function matching(value: unknown, pattern: RegExp) {
  if (typeof value !== 'string' || !pattern.test(value)) throw new AgentError('validation_error')
  return value
}

function bool(value: unknown, fallback: boolean) {
  if (value === undefined) return fallback
  if (typeof value !== 'boolean') throw new AgentError('validation_error')
  return value
}

function date(value: unknown) {
  if (value == null) return null
  const text = matching(value, /^(?:19\d\d|20\d\d|21\d\d)-\d\d-\d\d$/)
  const parsed = new Date(text)
  if (!Number.isFinite(+parsed) || parsed.toISOString().slice(0, 10) !== text)
    throw new AgentError('validation_error')
  return text
}

function rating(value: unknown) {
  if (value == null) return null
  if (typeof value !== 'number' || value < 0.5 || value > 5 || !Number.isInteger(value * 2)) {
    throw new AgentError('invalid_rating')
  }
  return value
}

const media = (value: unknown) => (value == null ? null : choice(value, ['movie', 'tv']))

function selector(value: unknown) {
  const data = object(value, ['type', 'n', 'scope', 'count', 'season', 'from', 'to'])
  switch (data.type) {
    case 'first_n':
      object(data, ['type', 'n', 'scope'])
      return {
        type: data.type,
        n: integer(data.n, 1, 100),
        scope: choice(data.scope, ['series_order']),
      }
    case 'next_unwatched':
      object(data, ['type', 'count'])
      return { type: data.type, count: integer(data.count ?? 1, 1, 100) }
    case 'range': {
      object(data, ['type', 'season', 'from', 'to'])
      const from = integer(data.from, 1, 10000)
      return {
        type: data.type,
        season: integer(data.season, 0, 10000),
        from,
        to: integer(data.to, from, 10000),
      }
    }
    case 'season':
      object(data, ['type', 'season'])
      return { type: data.type, season: integer(data.season, 0, 10000) }
    default:
      throw new AgentError('validation_error')
  }
}

function titleId(value: unknown) {
  const id = matching(value, TITLE_ID)
  integer(Number(id.split(':')[1]), 1, 2147483647)
  return id
}

export const parsers = {
  search_titles(value: unknown) {
    const x = object(value, ['query', 'media_type', 'year', 'limit'])
    return {
      query: string(x.query, 160).trim(),
      media_type: media(x.media_type),
      year: x.year == null ? null : integer(x.year, 1870, 2199),
      limit: integer(x.limit ?? 5, 1, 15),
    }
  },
  find_watchlist(value: unknown) {
    const x = object(value, ['name'])
    return { name: x.name == null ? null : string(x.name, 120) }
  },
  add_to_watchlist(value: unknown) {
    const x = object(value, ['list_id', 'title_id', 'idempotency_key'])
    return {
      list_id: matching(x.list_id, UUID).toLowerCase(),
      title_id: titleId(x.title_id),
      idempotency_key: matching(x.idempotency_key, KEY),
    }
  },
  create_watchlist(value: unknown) {
    const x = object(value, ['name', 'visibility', 'description', 'idempotency_key'])
    return {
      name: string(x.name, 120),
      visibility: choice(x.visibility, ['private', 'public']),
      description: x.description == null ? null : string(x.description, 1000, true),
      idempotency_key: matching(x.idempotency_key, KEY),
    }
  },
  log_watch(value: unknown) {
    const x = object(value, ['title_id', 'rating', 'watched_on', 'rewatch', 'idempotency_key'])
    return {
      title_id: titleId(x.title_id),
      rating: rating(x.rating),
      watched_on: date(x.watched_on),
      rewatch: bool(x.rewatch, false),
      idempotency_key: matching(x.idempotency_key, KEY),
    }
  },
  mark_episodes(value: unknown) {
    const x = object(value, ['series_id', 'selector', 'rating', 'watched_on', 'idempotency_key'])
    const id = titleId(x.series_id)
    if (!id.startsWith('tv:')) throw new AgentError('validation_error')
    return {
      series_id: id,
      selector: selector(x.selector),
      rating: rating(x.rating),
      watched_on: date(x.watched_on),
      idempotency_key: matching(x.idempotency_key, KEY),
    }
  },
  get_diary(value: unknown) {
    const x = object(value, ['limit', 'cursor', 'since', 'until', 'order', 'collapse_episodes'])
    const since = date(x.since)
    const until = date(x.until)
    if (since && until && since > until) throw new AgentError('validation_error')
    return {
      order: choice(x.order ?? 'watched_on_desc', ['watched_on_desc']),
      limit: integer(x.limit ?? 10, 1, 30),
      cursor: x.cursor == null ? null : matching(x.cursor, /^[\w-]{1,400}$/),
      since,
      until,
      collapse_episodes: bool(x.collapse_episodes, true),
    }
  },
  get_taste_profile(value: unknown) {
    return object(value, [])
  },
  get_candidates(value: unknown) {
    const x = object(value, ['media_type', 'limit', 'seed_count'])
    return {
      media_type: media(x.media_type),
      limit: integer(x.limit ?? 8, 1, 15),
      seed_count: integer(x.seed_count ?? 5, 1, 10),
    }
  },
}

export async function readJson(request: Request) {
  if (
    !/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') ?? '') ||
    !request.body
  )
    throw new AgentError('validation_error')
  const reader = request.body.getReader()
  const decoder = new TextDecoder('utf-8', { fatal: true })
  try {
    let size = 0
    let body = ''
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 8192) {
        await reader.cancel()
        throw new AgentError('validation_error')
      }
      body += decoder.decode(value, { stream: true })
    }
    return JSON.parse(body + decoder.decode()) as unknown
  } catch {
    throw new AgentError('validation_error')
  } finally {
    reader.releaseLock()
  }
}

export function agentFailure(error: unknown, meta: object) {
  const safe = error instanceof AgentError ? error : new AgentError('temporary_unavailable')
  const retryAfter = safe.details.retry_after
  return Response.json(
    {
      error: {
        code: safe.code,
        message: safe.message,
        candidates: [],
        retryable: safe.status === 429 || safe.status === 503,
        ...safe.details,
      },
      meta,
    },
    {
      status: safe.status,
      headers: {
        'Cache-Control': 'private, no-store',
        ...(typeof retryAfter === 'number' ? { 'Retry-After': String(retryAfter) } : {}),
        ...(safe.status === 401 ? { 'WWW-Authenticate': 'Bearer realm="Kino"' } : {}),
      },
    }
  )
}
