import type { MediaType, OgImageKind } from '@kino/core'

export function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function parseResourceSegment(segment: string) {
  const match = segment.match(/^(\d+)(?:-(.+))?$/)
  return match ? { id: Number(match[1]), slug: match[2] || '' } : { id: Number.NaN, slug: '' }
}

export function isCanonicalResourceSegment(segment: string, id: number, name: string) {
  return segment === `${id}-${slugify(name)}`
}

export function titlePath(id: number, title: string, type: MediaType) {
  return `/title/${id}-${slugify(title)}?type=${type}`
}

export function personPath(id: number, name: string) {
  return `/person/${id}-${slugify(name)}`
}

export function ogImagePath(
  kind: OgImageKind,
  id?: string | number,
  query?: Record<string, string>
) {
  const encodedId = id === undefined ? undefined : encodeURIComponent(String(id))

  const path =
    kind === 'profile' && encodedId
      ? `/api/${encodedId}`
      : `/api/${kind}${encodedId ? `/${encodedId}` : ''}`

  const params = new URLSearchParams(query)

  return params.size ? `${path}?${params.toString()}` : path
}

export function watchlistPath(id: string, name: string) {
  return `/watchlists/${id}-${slugify(name)}`
}

export function watchlistCoverPath(id: string, cacheKey?: string) {
  const path = `/api/og/watchlist/${encodeURIComponent(id)}/cover`
  return cacheKey ? `${path}?v=${encodeURIComponent(cacheKey)}` : path
}

export function parseWatchlistSegment(segment: string) {
  const id = segment.slice(0, 36)
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
    ? { id, slug: segment.slice(37) }
    : { id: segment, slug: '' }
}
