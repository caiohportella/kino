export interface VectorServerConfig {
  readonly url: string
  readonly token: string
}

export interface RedisServerConfig {
  readonly url: string
  readonly token: string
}

export class SearchServerConfigurationError extends Error {
  readonly code = 'invalid_server_configuration'

  constructor(message = 'Search server configuration is invalid') {
    super(message)
    this.name = 'SearchServerConfigurationError'
  }
}

type ServerEnvironment = Readonly<Record<string, string | undefined>>

function readPairedServerConfig(
  env: ServerEnvironment,
  urlKey: string,
  tokenKey: string,
  label: string
): { url: string; token: string } | null {
  const url = env[urlKey]
  const token = env[tokenKey]
  if (url === undefined && token === undefined) return null
  if (!url || !token || token.trim() !== token || token.length === 0) {
    throw new SearchServerConfigurationError(`${label} server configuration is invalid`)
  }
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
      throw new SearchServerConfigurationError(`${label} server configuration is invalid`)
    }
  } catch (error) {
    if (error instanceof SearchServerConfigurationError) throw error
    throw new SearchServerConfigurationError(`${label} server configuration is invalid`)
  }
  return { url, token }
}

export function readTmdbServerApiKey(env: ServerEnvironment = process.env): string | null {
  const apiKey = env.TMDB_API_KEY
  return apiKey && apiKey.trim() === apiKey ? apiKey : null
}

export function readVectorServerEnv(
  env: ServerEnvironment = process.env
): VectorServerConfig | null {
  return readPairedServerConfig(
    env,
    'UPSTASH_VECTOR_REST_URL',
    'UPSTASH_VECTOR_REST_TOKEN',
    'Vector'
  )
}

export function readRedisServerEnv(env: ServerEnvironment = process.env): RedisServerConfig | null {
  return readPairedServerConfig(env, 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'Redis')
}
