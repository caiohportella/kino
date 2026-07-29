import { isIP } from 'node:net'

export interface SearchRateLimitDecision {
  readonly allowed: boolean
  readonly remaining: number
  readonly retryAfterSeconds?: number
}

export interface SearchRateLimiter {
  check(key: string, signal?: AbortSignal): Promise<SearchRateLimitDecision>
}

export interface TrustedRateLimitStore {
  consume(
    input: {
      readonly key: string
      readonly limit: number
      readonly windowMs: number
    },
    signal?: AbortSignal
  ): Promise<SearchRateLimitDecision>
}

interface MemoryRateLimiterOptions {
  readonly limit: number
  readonly windowMs: number
  readonly maxKeys: number
  readonly now?: () => number
}

interface TrustedStoreRateLimiterOptions {
  readonly limit: number
  readonly windowMs: number
  readonly store: TrustedRateLimitStore
}

interface UpstashRedisRateLimitStoreOptions {
  readonly url: string
  readonly token: string
  readonly fetch: typeof globalThis.fetch
}

interface FallbackSearchRateLimiterOptions {
  readonly primary: SearchRateLimiter
  readonly fallback: SearchRateLimiter
}

interface MemoryWindow {
  count: number
  windowStartedAt: number
  lastSeenAt: number
}

function assertPositiveInteger(value: number, field: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new TypeError(`${field} must be a positive integer`)
  }
}

export function createMemorySearchRateLimiter(
  options: MemoryRateLimiterOptions
): SearchRateLimiter {
  assertPositiveInteger(options.limit, 'limit')
  assertPositiveInteger(options.windowMs, 'windowMs')
  assertPositiveInteger(options.maxKeys, 'maxKeys')
  const now = options.now ?? Date.now
  const windows = new Map<string, MemoryWindow>()

  function evictLeastRecentlySeen(): void {
    let oldestKey: string | undefined
    let oldestSeenAt = Number.POSITIVE_INFINITY
    for (const [key, window] of windows) {
      if (window.lastSeenAt < oldestSeenAt) {
        oldestKey = key
        oldestSeenAt = window.lastSeenAt
      }
    }
    if (oldestKey !== undefined) windows.delete(oldestKey)
  }

  return {
    async check(key): Promise<SearchRateLimitDecision> {
      const checkedAt = now()
      let window = windows.get(key)
      if (!window || checkedAt - window.windowStartedAt >= options.windowMs) {
        if (!window && windows.size >= options.maxKeys) evictLeastRecentlySeen()
        window = { count: 0, windowStartedAt: checkedAt, lastSeenAt: checkedAt }
        windows.set(key, window)
      }
      window.lastSeenAt = checkedAt
      if (window.count >= options.limit) {
        return {
          allowed: false,
          remaining: 0,
          retryAfterSeconds: Math.max(
            1,
            Math.ceil((window.windowStartedAt + options.windowMs - checkedAt) / 1_000)
          ),
        }
      }
      window.count += 1
      return {
        allowed: true,
        remaining: options.limit - window.count,
      }
    },
  }
}

export function createTrustedStoreSearchRateLimiter(
  options: TrustedStoreRateLimiterOptions
): SearchRateLimiter {
  assertPositiveInteger(options.limit, 'limit')
  assertPositiveInteger(options.windowMs, 'windowMs')
  return {
    check(key, signal) {
      return options.store.consume(
        {
          key,
          limit: options.limit,
          windowMs: options.windowMs,
        },
        signal
      )
    },
  }
}

const FIXED_WINDOW_SCRIPT =
  "local count=redis.call('INCR',KEYS[1]); if count==1 then redis.call('PEXPIRE',KEYS[1],ARGV[1]) end; return count"

function resultNumber(value: unknown): number | undefined {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('result' in value) ||
    typeof value.result !== 'number' ||
    !Number.isFinite(value.result)
  ) {
    return undefined
  }
  return value.result
}

export function createUpstashRedisRateLimitStore(
  options: UpstashRedisRateLimitStoreOptions
): TrustedRateLimitStore {
  const baseUrl = options.url.replace(/\/+$/u, '')
  return {
    async consume(input, signal): Promise<SearchRateLimitDecision> {
      const redisKey = `kino:search:${input.key.slice(0, 128)}`
      const response = await options.fetch(`${baseUrl}/pipeline`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${options.token}`,
        },
        body: JSON.stringify([
          ['EVAL', FIXED_WINDOW_SCRIPT, '1', redisKey, String(input.windowMs)],
          ['PTTL', redisKey],
        ]),
        cache: 'no-store',
        signal,
      })
      if (!response.ok) throw new Error('Trusted rate-limit store unavailable')
      const payload: unknown = await response.json()
      if (!Array.isArray(payload) || payload.length !== 2) {
        throw new Error('Trusted rate-limit store returned an invalid response')
      }
      const count = resultNumber(payload[0])
      const ttlMs = resultNumber(payload[1])
      if (count === undefined || ttlMs === undefined || count < 1) {
        throw new Error('Trusted rate-limit store returned an invalid response')
      }
      return count > input.limit
        ? {
            allowed: false,
            remaining: 0,
            retryAfterSeconds: Math.max(1, Math.ceil(Math.max(0, ttlMs) / 1_000)),
          }
        : { allowed: true, remaining: Math.max(0, input.limit - count) }
    },
  }
}

export function createFallbackSearchRateLimiter(
  options: FallbackSearchRateLimiterOptions
): SearchRateLimiter {
  return {
    async check(key, signal): Promise<SearchRateLimitDecision> {
      try {
        return await options.primary.check(key, signal)
      } catch (error) {
        if (signal?.aborted || (error instanceof Error && error.name === 'AbortError')) {
          throw error
        }
        return options.fallback.check(key, signal)
      }
    },
  }
}

export function searchClientKey(request: Request): string {
  const forwarded = request.headers.get('x-vercel-forwarded-for')
  const address = forwarded?.split(',', 1)[0]?.trim()
  return address && isIP(address) !== 0 ? `ip:${address}` : 'ip:unknown'
}
