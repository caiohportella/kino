export type KinoShareResourceType = 'profile' | 'title' | 'person' | 'watchlist' | 'activity'

export interface KinoShareResource {
  type: KinoShareResourceType
  title: string
  description?: string
  subtitle?: string
  canonicalUrl: string
  imageUrl?: string | null
  shareText?: string
  shareable?: boolean
}

export type ShareDestinationId = 'whatsapp' | 'reddit' | 'x' | 'facebook' | 'telegram'

export interface ShareDestination {
  id: ShareDestinationId
  labelKey: string
  color: string
  buildUrl: (context: ShareUrlContext) => string
}

export interface ShareUrlContext {
  title: string
  text: string
  url: string
}

export const shareDestinations: ShareDestination[] = [
  {
    id: 'whatsapp',
    labelKey: 'sharing.whatsapp',
    color: '#25d366',
    buildUrl: ({ text, url }) =>
      `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`.trim())}`,
  },
  {
    id: 'reddit',
    labelKey: 'sharing.reddit',
    color: '#ff4500',
    buildUrl: ({ title, url }) =>
      `https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`,
  },
  {
    id: 'x',
    labelKey: 'sharing.x',
    color: '#111111',
    buildUrl: ({ text, url }) =>
      `https://x.com/intent/post?text=${encodeURIComponent(text.slice(0, 240))}&url=${encodeURIComponent(url)}`,
  },
  {
    id: 'facebook',
    labelKey: 'sharing.facebook',
    color: '#1877f2',
    buildUrl: ({ url }) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    id: 'telegram',
    labelKey: 'sharing.telegram',
    color: '#229ed9',
    buildUrl: ({ text, url }) =>
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
  },
]

export function normalizeShareUrl(url: string, origin: string) {
  return new URL(url, origin).toString()
}

export function supportsNativeShare() {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function'
}

export function supportsFileShare(file?: File) {
  if (!file || !supportsNativeShare() || typeof navigator.canShare !== 'function') return false
  try {
    return navigator.canShare({ files: [file] })
  } catch {
    return false
  }
}

export function isShareCancellation(error: unknown) {
  return (
    error instanceof DOMException &&
    (error.name === 'AbortError' || error.name === 'NotAllowedError')
  )
}
