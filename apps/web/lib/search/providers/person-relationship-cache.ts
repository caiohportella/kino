import {
  evaluateRelationshipRecord,
  PERSON_RELATIONSHIP_SCHEMA_VERSION,
  type PersonRelationshipRecord,
  type PersonRelationshipRecordEvaluation,
} from '../person-relationships.ts'

export interface PersonRelationshipStore {
  get(key: string): Promise<unknown>
  set(key: string, value: PersonRelationshipRecord): Promise<void>
}

export interface PersonRelationshipRefreshInput {
  readonly personId: number
  readonly reason: 'missing' | 'incomplete' | 'stale'
}

export interface PersonRelationshipRefreshScheduler {
  schedule(input: PersonRelationshipRefreshInput): void | Promise<void>
}

export interface PersonRelationshipCache {
  get(personId: number): Promise<PersonRelationshipRecordEvaluation>
  set(record: PersonRelationshipRecord): Promise<void>
  scheduleRefresh(input: PersonRelationshipRefreshInput): Promise<void>
}

interface UpstashPersonRelationshipStoreOptions {
  readonly url: string
  readonly token: string
  readonly fetch: typeof globalThis.fetch
  readonly ttlSeconds?: number
}

export function personRelationshipCacheKey(personId: number): string {
  return `search:person-relationships:v${PERSON_RELATIONSHIP_SCHEMA_VERSION}:${personId}`
}

export function createUpstashPersonRelationshipStore(
  options: UpstashPersonRelationshipStoreOptions
): PersonRelationshipStore {
  const baseUrl = options.url.replace(/\/+$/u, '')
  const ttlSeconds = options.ttlSeconds ?? 30 * 24 * 60 * 60

  async function command(parts: readonly string[]): Promise<unknown> {
    const response = await options.fetch(`${baseUrl}/pipeline`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${options.token}`,
      },
      body: JSON.stringify([parts]),
      cache: 'no-store',
    })
    if (!response.ok) throw new Error('Person relationship store unavailable')
    const payload: unknown = await response.json()
    if (
      !Array.isArray(payload) ||
      payload.length !== 1 ||
      !payload[0] ||
      typeof payload[0] !== 'object' ||
      !('result' in payload[0])
    ) {
      throw new Error('Person relationship store returned an invalid response')
    }
    return payload[0].result
  }

  return {
    async get(key) {
      const result = await command(['GET', key])
      if (result === null) return null
      if (typeof result !== 'string') {
        throw new Error('Person relationship store returned an invalid record')
      }
      try {
        return JSON.parse(result) as unknown
      } catch {
        throw new Error('Person relationship store returned an invalid record')
      }
    },

    async set(key, value) {
      await command(['SET', key, JSON.stringify(value), 'EX', String(ttlSeconds)])
    },
  }
}

export function createPersonRelationshipCache(options: {
  readonly store: PersonRelationshipStore
  readonly scheduler?: PersonRelationshipRefreshScheduler
  readonly now?: () => number
}): PersonRelationshipCache {
  const scheduleRefresh = async (input: PersonRelationshipRefreshInput): Promise<void> => {
    if (!options.scheduler) return
    try {
      void Promise.resolve(options.scheduler.schedule(input)).catch(() => undefined)
    } catch {
      // Relationship refresh is best-effort and never affects the search response.
    }
  }

  return {
    async get(personId) {
      let value: unknown
      try {
        value = await options.store.get(personRelationshipCacheKey(personId))
      } catch {
        return { state: 'missing' }
      }

      const result = evaluateRelationshipRecord(value, { now: options.now?.() })
      if (result.state === 'stale_complete') {
        await scheduleRefresh({ personId, reason: 'stale' })
      }
      return result
    },

    async set(record) {
      await options.store.set(personRelationshipCacheKey(record.personId), record)
    },

    scheduleRefresh,
  }
}
