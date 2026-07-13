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
])

export function isReservedProfileRoute(username: string) {
  return RESERVED_PROFILE_ROUTES.has(username.toLowerCase())
}
