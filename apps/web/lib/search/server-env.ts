export interface VectorServerConfig {
  readonly url: string
  readonly token: string
}

export class SearchServerConfigurationError extends Error {
  readonly code = 'invalid_server_configuration'

  constructor() {
    super('Vector search server configuration is invalid')
    this.name = 'SearchServerConfigurationError'
  }
}

type ServerEnvironment = Readonly<Record<string, string | undefined>>

export function readVectorServerEnv(
  env: ServerEnvironment = process.env
): VectorServerConfig | null {
  const url = env.UPSTASH_VECTOR_REST_URL
  const token = env.UPSTASH_VECTOR_REST_TOKEN
  if (url === undefined && token === undefined) return null
  if (!url || !token || token.trim() !== token || token.length === 0) {
    throw new SearchServerConfigurationError()
  }
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
      throw new SearchServerConfigurationError()
    }
  } catch (error) {
    if (error instanceof SearchServerConfigurationError) throw error
    throw new SearchServerConfigurationError()
  }
  return { url, token }
}
