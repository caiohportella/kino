import { createRedisSearchClient, type RedisSearchClientConfig } from './client.ts'

export interface RedisJsonClient {
  readonly json: {
    set(key: string, path: string, value: unknown): Promise<unknown>
  }
  readonly del: (key: string) => Promise<unknown>
  readonly pipeline?: () => RedisPipeline
}

export interface RedisPipeline {
  readonly json: {
    set(key: string, path: string, value: unknown): RedisPipeline
  }
  exec(): Promise<unknown>
}

export interface RedisIndexerOptions {
  readonly client?: RedisJsonClient
  readonly url?: string
  readonly token?: string
  readonly batchSize?: number
}

export type RedisIndexerConfig = RedisIndexerOptions | RedisSearchClientConfig

export function resolveRedisClient(config: RedisIndexerConfig): {
  client: RedisJsonClient
  batchSize: number
} {
  if ('client' in config && config.client) {
    return { client: config.client, batchSize: config.batchSize ?? 100 }
  }
  if ('url' in config && config.url && 'token' in config && config.token) {
    return {
      client: createRedisSearchClient({ url: config.url, token: config.token }),
      batchSize: 'batchSize' in config ? (config.batchSize ?? 100) : 100,
    }
  }
  throw new Error('Missing Redis Search client configuration')
}

export function createBestEffortIndexer<T extends (...args: any[]) => Promise<unknown>>(
  operation: T,
  onError: (error: unknown) => void = () => undefined
): (...args: Parameters<T>) => Promise<void> {
  return async (...args) => {
    try {
      await operation(...args)
    } catch (error) {
      onError(error)
    }
  }
}

export function toArray<T>(value: T | readonly T[]): readonly T[] {
  return (Array.isArray(value) ? value : [value]) as readonly T[]
}

export async function writeJsonDocuments(
  client: RedisJsonClient,
  documents: readonly { readonly key: string; readonly value: unknown }[],
  batchSize: number
): Promise<void> {
  for (let index = 0; index < documents.length; index += batchSize) {
    const batch = documents.slice(index, index + batchSize)
    if (client.pipeline) {
      const pipeline = client.pipeline()
      for (const document of batch) pipeline.json.set(document.key, '$', document.value)
      await pipeline.exec()
      continue
    }
    await Promise.all(batch.map((document) => client.json.set(document.key, '$', document.value)))
  }
}
