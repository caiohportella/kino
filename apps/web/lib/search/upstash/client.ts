import { Redis } from '@upstash/redis'

import { type RedisSearchIndexName, SEARCH_INDEX_NAME } from './indexes.ts'
import { KINO_SEARCH_SCHEMA } from './schemas.ts'

export interface RedisSearchClientConfig {
  readonly url: string
  readonly token: string
}

export function createRedisSearchClient(config: RedisSearchClientConfig): Redis {
  return new Redis({
    url: config.url,
    token: config.token,
  })
}

export function getKinoSearchIndex(redis: Redis) {
  return redis.search.index({ name: SEARCH_INDEX_NAME, schema: KINO_SEARCH_SCHEMA })
}

export type RedisSearchIndex = ReturnType<typeof getKinoSearchIndex>

// Compatibility aliases for callers being migrated to Redis Search.
export type UpstashSearchClientConfig = RedisSearchClientConfig
export const createUpstashSearchClient = createRedisSearchClient
export function createUpstashIndex(redis: Redis, name: RedisSearchIndexName) {
  if (name !== SEARCH_INDEX_NAME) throw new Error(`Unsupported Redis Search index: ${name}`)
  return getKinoSearchIndex(redis)
}
