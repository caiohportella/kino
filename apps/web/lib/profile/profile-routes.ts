export const RESERVED_PROFILE_ROUTES = new Set([
  'api',
  'auth',
  'diary',
  'discover',
  'import',
  'person',
  'profile',
  'search',
  'settings',
  'title',
  'watchlists',
  'movies',
  'series',
])

export function isReservedProfileRoute(username: string) {
  return RESERVED_PROFILE_ROUTES.has(username.toLowerCase())
}

export function normalizeProfileUsername(value: string) {
  try {
    const decoded = /%[0-9a-f]{2}/i.test(value) ? decodeURIComponent(value) : value
    const username = decoded.trim()
    return username && !username.includes('/') ? username : null
  } catch {
    return null
  }
}

export function isProfileSectionPath(pathname: string, username: string) {
  const canonicalUsername = normalizeProfileUsername(username)
  if (!canonicalUsername || !pathname.startsWith('/') || pathname.includes('//')) {
    return false
  }

  const [routeUsername] = pathname.split('/').filter(Boolean)
  if (!routeUsername) return false

  return normalizeProfileUsername(routeUsername) === canonicalUsername
}

export function profileOgPath(username: string) {
  return `/api/${encodeURIComponent(username)}?v=4`
}
