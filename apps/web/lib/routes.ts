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
  const encodedId =
    id === undefined ? undefined : encodeURIComponent(String(id))

  const path =
    kind === 'profile' && encodedId
      ? `/api/${encodedId}`
      : `/api/${kind}${encodedId ? `/${encodedId}` : ''}`

  const params = new URLSearchParams(query)

  return params.size ? `${path}?${params.toString()}` : path
}