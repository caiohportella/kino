import { KINO_SEARCH_SCHEMA } from './schemas.ts'

export const SEARCH_INDEX_NAME = 'kino-search' as const
export const LEGACY_SEARCH_INDEX_NAMES = ['kino-titles', 'kino-people', 'kino-users'] as const

export const TITLE_KEY_PREFIX = 'kino:search:title:' as const
export const PERSON_KEY_PREFIX = 'kino:search:person:' as const
export const USER_KEY_PREFIX = 'kino:search:user:' as const
export const SEARCH_KEY_PREFIXES = [TITLE_KEY_PREFIX, PERSON_KEY_PREFIX, USER_KEY_PREFIX] as const

export type RedisSearchIndexName = typeof SEARCH_INDEX_NAME
export type UpstashIndexName = RedisSearchIndexName

type RedisSearchSetupClient = {
  search: {
    createIndex: (config: any) => Promise<unknown>
    index: (config: { name: string }) => { drop: () => Promise<unknown> }
  }
  exec: <TResult>(args: [string, ...Array<string | number | boolean>]) => Promise<TResult>
}

function listedIndexNames(response: unknown): string[] {
  if (!Array.isArray(response)) return []
  return response.flatMap((entry) => {
    if (!Array.isArray(entry)) return []
    const nameIndex = entry.indexOf('name')
    const name = nameIndex >= 0 ? entry[nameIndex + 1] : entry[1]
    return typeof name === 'string' ? [name] : []
  })
}

export async function setupRedisSearchIndexes(redis: RedisSearchSetupClient): Promise<void> {
  const indexes = listedIndexNames(await redis.exec<unknown>(['SEARCH.LISTINDEXES']))
  const legacyIndexes = new Set<string>(LEGACY_SEARCH_INDEX_NAMES)
  await Promise.all(
    indexes
      .filter((name) => legacyIndexes.has(name))
      .map((name) => redis.search.index({ name }).drop())
  )
  await redis.search.createIndex({
    name: SEARCH_INDEX_NAME,
    dataType: 'json',
    prefix: [...SEARCH_KEY_PREFIXES],
    schema: KINO_SEARCH_SCHEMA,
    existsOk: true,
  })
}
