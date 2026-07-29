export function resolveKinoApiOrigin(
  configured: string | undefined,
  environment = process.env.NODE_ENV
) {
  const value = configured?.trim()
  if (!value) {
    if (environment === 'production') {
      throw new Error('EXPO_PUBLIC_KINO_API_URL is required for production builds.')
    }
    throw new Error(
      'EXPO_PUBLIC_KINO_API_URL must use an explicit LAN, tunnel, or preview origin in development.'
    )
  }

  const url = new (URL as unknown as URLConstructor)(value)
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('EXPO_PUBLIC_KINO_API_URL must use HTTP or HTTPS.')
  }
  if (
    environment === 'production' &&
    (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1')
  ) {
    throw new Error('Production EXPO_PUBLIC_KINO_API_URL cannot use localhost.')
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
