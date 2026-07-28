export type AuthCallbackPayload = {
  code?: string
  accessToken?: string
  refreshToken?: string
  error?: string
}

function combinedParams(url: string) {
  const parsed = new URL(url)
  const hash = new URLSearchParams(parsed.hash.replace(/^#/, ''))
  return { query: parsed.searchParams, hash }
}

function first(query: URLSearchParams, hash: URLSearchParams, name: string) {
  return query.get(name) || hash.get(name) || undefined
}

export function getAuthCallbackPayload(url: string): AuthCallbackPayload {
  const { query, hash } = combinedParams(url)
  return {
    code: first(query, hash, 'code'),
    accessToken: first(query, hash, 'access_token'),
    refreshToken: first(query, hash, 'refresh_token'),
    error:
      first(query, hash, 'error_description') ||
      first(query, hash, 'error_code') ||
      first(query, hash, 'error'),
  }
}

export function sanitizeAuthError(error: string) {
  const normalized = error.toLowerCase()
  if (normalized.includes('expired'))
    return 'The authentication request has expired. Please try again.'
  if (normalized.includes('access_denied')) return 'Google authentication was canceled.'
  return 'Google authentication could not be completed. Please try again.'
}
