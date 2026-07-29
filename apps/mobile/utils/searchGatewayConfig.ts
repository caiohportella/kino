export class SearchGatewayConfigurationError extends Error {
  readonly code = 'invalid_search_gateway_configuration'

  constructor(message: string) {
    super(message)
    this.name = 'SearchGatewayConfigurationError'
  }
}

export function resolveKinoApiOrigin(
  configured: string | undefined,
  environment = process.env.NODE_ENV
) {
  const value = configured?.trim()
  if (!value) {
    if (environment === 'production') {
      throw new SearchGatewayConfigurationError(
        'EXPO_PUBLIC_KINO_API_URL is required for production builds.'
      )
    }
    throw new SearchGatewayConfigurationError(
      'EXPO_PUBLIC_KINO_API_URL must use an explicit LAN, tunnel, or preview origin in development.'
    )
  }

  let url: InstanceType<URLConstructor>
  try {
    url = new (URL as unknown as URLConstructor)(value)
  } catch {
    throw new SearchGatewayConfigurationError(
      'EXPO_PUBLIC_KINO_API_URL must be a valid absolute URL.'
    )
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new SearchGatewayConfigurationError('EXPO_PUBLIC_KINO_API_URL must use HTTP or HTTPS.')
  }
  if (
    environment === 'production' &&
    (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1')
  ) {
    throw new SearchGatewayConfigurationError(
      'Production EXPO_PUBLIC_KINO_API_URL cannot use localhost.'
    )
  }
  if (environment === 'production' && url.protocol !== 'https:') {
    throw new SearchGatewayConfigurationError('Production EXPO_PUBLIC_KINO_API_URL must use HTTPS.')
  }

  url.pathname = url.pathname.replace(/\/+$/, '')
  url.search = ''
  url.hash = ''
  return url.toString().replace(/\/$/, '')
}

interface URLConstructor {
  new (
    value: string
  ): {
    hash: string
    hostname: string
    pathname: string
    protocol: string
    search: string
    toString(): string
  }
}
