const DEFAULT_WEB_ORIGIN = 'https://kino.vercel.app'
const DEFAULT_APP_SCHEME = 'kino'
const AUTH_REDIRECT_STORAGE_KEY = 'kino-auth-redirect-path'

function stripTrailingSlash(value: string) {
  return value.replace(/\/+$/, '')
}

function normalizeOrigin(value: string) {
  const origin = stripTrailingSlash(value)
  if (origin.startsWith('http://') || origin.startsWith('https://')) return origin
  return `https://${origin}`
}

export function getWebAuthCallbackUrl() {
  const explicitRedirect = process.env.NEXT_PUBLIC_AUTH_REDIRECT_URL
  if (explicitRedirect) return explicitRedirect

  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_VERCEL_URL
  if (configuredOrigin) return `${normalizeOrigin(configuredOrigin)}/auth/callback`

  if (typeof window !== 'undefined') {
    return `${window.location.origin}/auth/callback`
  }

  return `${DEFAULT_WEB_ORIGIN}/auth/callback`
}

export function isSafeInternalRedirect(value: string | null | undefined) {
  return Boolean(value && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/auth'))
}

export function storeAuthRedirect(pathname: string) {
  if (typeof window === 'undefined' || !isSafeInternalRedirect(pathname)) return
  window.localStorage.setItem(AUTH_REDIRECT_STORAGE_KEY, pathname)
}

export function consumeStoredAuthRedirect(fallback = '/profile') {
  if (typeof window === 'undefined') return fallback
  const storedPath = window.localStorage.getItem(AUTH_REDIRECT_STORAGE_KEY)
  window.localStorage.removeItem(AUTH_REDIRECT_STORAGE_KEY)
  return isSafeInternalRedirect(storedPath) ? storedPath! : fallback
}

export function getNativeAuthCallbackUrl(
  searchParams: URLSearchParams,
  hashParams?: URLSearchParams
) {
  const appScheme = process.env.NEXT_PUBLIC_APP_SCHEME || DEFAULT_APP_SCHEME
  const query = searchParams.toString()
  const hash = hashParams?.toString()
  return `${appScheme}://auth/callback${query ? `?${query}` : ''}${hash ? `#${hash}` : ''}`
}

export function shouldAttemptNativeAuthHandoff() {
  if (typeof navigator === 'undefined') return false
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
}
