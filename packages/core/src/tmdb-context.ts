import type {
  NormalizedWatchProviders,
  TMDbTitle,
  TMDbVideo,
  TMDbWatchProviderResponse,
  WatchProviderCategory,
} from './types'

export function normalizeFranchiseTitles(parts: TMDbTitle[], currentId: number) {
  const unique = new Map(
    parts
      .filter((item) => item.id !== currentId)
      .map((item) => [`movie-${item.id}`, { ...item, media_type: 'movie' as const }])
  )
  return Array.from(unique.values()).sort((left, right) => {
    const leftDate = left.release_date || ''
    const rightDate = right.release_date || ''
    if (!leftDate) return rightDate ? 1 : 0
    if (!rightDate) return -1
    return leftDate.localeCompare(rightDate)
  })
}

const LOCALE_REGIONS: Record<string, string> = {
  'en-US': 'US',
  'fr-FR': 'FR',
  'it-IT': 'IT',
  'nb-NO': 'NO',
  'no-NO': 'NO',
  'pt-BR': 'BR',
}

const LANGUAGE_DEFAULT_REGIONS: Record<string, string> = {
  fr: 'FR',
  it: 'IT',
  no: 'NO',
  pt: 'BR',
}

const CATEGORY_FIELDS: Array<
  [WatchProviderCategory, 'flatrate' | 'free' | 'ads' | 'rent' | 'buy']
> = [
  ['stream', 'flatrate'],
  ['free', 'free'],
  ['ads', 'ads'],
  ['rent', 'rent'],
  ['buy', 'buy'],
]

export function selectPreferredTrailer(videos: TMDbVideo[], locale: string): TMDbVideo | null {
  const language = locale.toLowerCase().split(/[-_]/)[0]
  const supported = videos.filter((video) => video.site.toLowerCase() === 'youtube' && video.key)
  if (supported.length === 0) return null

  const typeRank = (type: string) => {
    if (type === 'Trailer') return 3
    if (type === 'Teaser') return 2
    if (type === 'Clip') return 1
    return 0
  }

  return (
    supported.sort((left, right) => {
      const score = (video: TMDbVideo) =>
        typeRank(video.type) * 100 +
        Number(video.official) * 20 +
        Number(video.iso_639_1?.toLowerCase() === language) * 10
      return (
        score(right) - score(left) ||
        Date.parse(right.published_at || '') - Date.parse(left.published_at || '')
      )
    })[0] ?? null
  )
}

export function resolveWatchProviderRegion({
  storedRegion,
  locale,
  defaultRegion,
}: {
  storedRegion?: string | null
  locale: string
  defaultRegion?: string | null
}) {
  const explicit = storedRegion?.trim().toUpperCase()
  if (explicit && /^[A-Z]{2}$/.test(explicit)) return explicit

  const normalizedLocale = locale.replace('_', '-')
  if (LOCALE_REGIONS[normalizedLocale]) return LOCALE_REGIONS[normalizedLocale]

  const localeRegion = normalizedLocale.split('-')[1]?.toUpperCase()
  if (localeRegion && /^[A-Z]{2}$/.test(localeRegion)) return localeRegion

  const language = (normalizedLocale.split('-')[0] || '').toLowerCase()
  return LANGUAGE_DEFAULT_REGIONS[language] || defaultRegion?.toUpperCase() || 'US'
}

export function normalizeWatchProviders(
  response: TMDbWatchProviderResponse,
  region: string
): NormalizedWatchProviders {
  const normalizedRegion = region.toUpperCase()
  const availability = response.results?.[normalizedRegion]
  const groups: NormalizedWatchProviders['groups'] = {}

  if (availability) {
    for (const [category, field] of CATEGORY_FIELDS) {
      const providers = availability[field]
      if (!Array.isArray(providers) || providers.length === 0) continue
      const unique = new Map(providers.map((provider) => [provider.provider_id, provider]))
      groups[category] = Array.from(unique.values())
        .sort(
          (left, right) =>
            (left.display_priority ?? Number.MAX_SAFE_INTEGER) -
            (right.display_priority ?? Number.MAX_SAFE_INTEGER)
        )
        .map((provider) => ({ ...provider, category }))
    }
  }

  return {
    groups,
    link: availability?.link || null,
    region: normalizedRegion,
  }
}
