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

export function personRelationshipCacheKey(personId: number): string {
  return `search:person-relationships:v${PERSON_RELATIONSHIP_SCHEMA_VERSION}:${personId}`
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
