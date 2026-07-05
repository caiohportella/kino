import { makeRedirectUri } from 'expo-auth-session'
import { Platform } from 'react-native'

const DEFAULT_WEB_ORIGIN = 'https://kino.vercel.app'
const DEFAULT_APP_SCHEME = 'kino'

type BrowserGlobal = typeof globalThis & {
  window?: {
    location?: {
      origin?: string
    }
  }
}

function stripTrailingSlash(value: string) {
  return value.replace(/\/+$/, '')
}

function toAuthCallbackUrl(value: string) {
  const normalized = stripTrailingSlash(value)
  return normalized.endsWith('/auth/callback') ? normalized : `${normalized}/auth/callback`
}

export function getEmailAuthRedirectUrl() {
  const explicitRedirect = process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL
  if (explicitRedirect) return explicitRedirect

  const browserOrigin = (globalThis as BrowserGlobal).window?.location?.origin
  if (Platform.OS === 'web' && browserOrigin) {
    return `${browserOrigin}/auth/callback`
  }

  return toAuthCallbackUrl(process.env.EXPO_PUBLIC_WEB_URL || DEFAULT_WEB_ORIGIN)
}

export function getNativeAuthRedirectUrl() {
  return makeRedirectUri({
    scheme: process.env.EXPO_PUBLIC_APP_SCHEME || DEFAULT_APP_SCHEME,
    path: 'auth/callback',
  })
}
