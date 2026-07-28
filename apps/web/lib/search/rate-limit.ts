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
