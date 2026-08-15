import { localeBaseLanguage, localeRegion, normalizeLocale, normalizeRegion } from './locale.ts'

export type LocalizedImageKind = 'poster' | 'backdrop' | 'logo' | 'profile'

export type LocalizedImageLanguageTier =
  | 'exact'
  | 'base'
  | 'fallback'
  | 'original'
  | 'neutral'
  | 'tmdb-default'
  | 'placeholder'

export type LocalizedImageFallbackReason =
  | 'base-language'
  | 'configured-fallback'
  | 'original-language'
  | 'language-neutral'
  | 'tmdb-default'
  | 'kino-placeholder'
  | null

export interface LocalizedImageCandidate {
  readonly aspectRatio?: number | null
  readonly filePath: string | null
  readonly height?: number | null
  readonly id?: string | null
  readonly language: string | null
  readonly quality?: number | null
  readonly region?: string | null
  readonly voteAverage?: number | null
  readonly voteCount?: number | null
  readonly width?: number | null
}

export interface SelectLocalizedImageInput {
  readonly candidates: readonly LocalizedImageCandidate[]
  readonly fallbackLocale?: string | null
  readonly kind: LocalizedImageKind
  readonly locale: string
  readonly originalLanguage?: string | null
  readonly placeholderPath?: string | null
  readonly tmdbDefaultPath?: string | null
}

export interface LocalizedImageSelection {
  readonly fallbackReason: LocalizedImageFallbackReason
  readonly languageTier: LocalizedImageLanguageTier
  readonly path: string | null
}

interface ImageTier {
  readonly fallbackReason: LocalizedImageFallbackReason
  readonly languageTier: LocalizedImageLanguageTier
  readonly matches: (
    language: string | null | undefined,
    region: string | null | undefined
  ) => boolean
}

type ImageQualityCandidate = Omit<LocalizedImageCandidate, 'language'> & {
  filePath: string
}

export function selectLocalizedImage(input: SelectLocalizedImageInput): LocalizedImageSelection {
  const locale = normalizeLocale(input.locale)
  const baseLanguage = localeBaseLanguage(locale)
  const requestedRegion = localeRegion(locale)
  const fallbackLocale = normalizeOptionalLocale(input.fallbackLocale)
  const originalLanguage = normalizeOptionalLocale(input.originalLanguage)
  const candidates = input.candidates
    .filter((candidate): candidate is LocalizedImageCandidate & { filePath: string } =>
      isProviderPath(candidate.filePath)
    )
    .map((candidate) => ({
      ...candidate,
      language: normalizeCandidateLocale(candidate.language),
      region: normalizeCandidateRegion(candidate.region),
    }))

  const tiers: readonly ImageTier[] = [
    {
      fallbackReason: null,
      languageTier: 'exact',
      matches: (language, region) =>
        (language === locale && (region === null || region === requestedRegion)) ||
        (language === baseLanguage && requestedRegion !== null && region === requestedRegion),
    },
    {
      fallbackReason: 'base-language',
      languageTier: 'base',
      matches: (language) => language === baseLanguage,
    },
    {
      fallbackReason: 'configured-fallback',
      languageTier: 'fallback',
      matches: (language) => localeMatches(language, fallbackLocale),
    },
    {
      fallbackReason: 'original-language',
      languageTier: 'original',
      matches: (language) => localeMatches(language, originalLanguage),
    },
    {
      fallbackReason: 'language-neutral',
      languageTier: 'neutral',
      matches: (language) => language === null,
    },
  ]

  for (const tier of tiers) {
    const selected = candidates
      .filter((candidate) => tier.matches(candidate.language, candidate.region))
      .sort((left, right) => compareQuality(left, right, input.kind))[0]

    if (selected) {
      return {
        fallbackReason: tier.fallbackReason,
        languageTier: tier.languageTier,
        path: selected.filePath,
      }
    }
  }

  if (isProviderPath(input.tmdbDefaultPath)) {
    return {
      fallbackReason: 'tmdb-default',
      languageTier: 'tmdb-default',
      path: input.tmdbDefaultPath,
    }
  }

  return {
    fallbackReason: 'kino-placeholder',
    languageTier: 'placeholder',
    path: input.placeholderPath?.trim() || null,
  }
}

function localeMatches(candidate: string | null | undefined, preferred: string | null) {
  if (!candidate || !preferred) return false
  return candidate === preferred || candidate === localeBaseLanguage(preferred)
}

function normalizeOptionalLocale(locale: string | null | undefined): string | null {
  if (!locale?.trim()) return null
  try {
    return normalizeLocale(locale)
  } catch {
    return null
  }
}

function normalizeCandidateLocale(locale: string | null): string | null | undefined {
  if (!locale?.trim()) return null
  try {
    return normalizeLocale(locale)
  } catch {
    return undefined
  }
}

function normalizeCandidateRegion(region: string | null | undefined): string | null | undefined {
  if (!region?.trim()) return null
  try {
    return normalizeRegion(region)
  } catch {
    return undefined
  }
}

function isProviderPath(path: string | null | undefined): path is string {
  const value = path?.trim()
  if (!value) return false
  return value.startsWith('/') || /^https:\/\/\S+$/i.test(value)
}

function compareQuality(
  left: ImageQualityCandidate,
  right: ImageQualityCandidate,
  kind: LocalizedImageKind
) {
  const preferredAspectRatio = kind === 'backdrop' || kind === 'logo' ? 16 / 9 : 2 / 3
  const aspectOrder = compareAscending(
    aspectDistance(left, preferredAspectRatio),
    aspectDistance(right, preferredAspectRatio)
  )
  if (aspectOrder !== 0) return aspectOrder

  const qualityOrder = compareDescending(finiteOrZero(left.quality), finiteOrZero(right.quality))
  if (qualityOrder !== 0) return qualityOrder

  const resolutionOrder = compareOptionalDescending(pixelArea(left), pixelArea(right))
  if (resolutionOrder !== 0) return resolutionOrder

  const voteAverageOrder = compareDescending(
    finiteOrZero(left.voteAverage),
    finiteOrZero(right.voteAverage)
  )
  if (voteAverageOrder !== 0) return voteAverageOrder

  const voteCountOrder = compareDescending(
    finiteOrZero(left.voteCount),
    finiteOrZero(right.voteCount)
  )
  if (voteCountOrder !== 0) return voteCountOrder

  const leftIdentity = left.id?.trim() || left.filePath
  const rightIdentity = right.id?.trim() || right.filePath
  const identityOrder = compareLexically(leftIdentity, rightIdentity)
  return identityOrder || compareLexically(left.filePath, right.filePath)
}

function aspectDistance(candidate: ImageQualityCandidate, preferredAspectRatio: number) {
  const aspectRatio =
    finitePositive(candidate.aspectRatio) ??
    (finitePositive(candidate.width) && finitePositive(candidate.height)
      ? (candidate.width as number) / (candidate.height as number)
      : null)
  return aspectRatio === null
    ? Number.POSITIVE_INFINITY
    : Math.abs(aspectRatio - preferredAspectRatio)
}

function pixelArea(candidate: ImageQualityCandidate) {
  const width = finitePositive(candidate.width)
  const height = finitePositive(candidate.height)
  if (width === null || height === null) return null
  const area = width * height
  return Number.isFinite(area) ? area : null
}

function finitePositive(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

function finiteOrZero(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function compareAscending(left: number, right: number) {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

function compareDescending(left: number, right: number) {
  return compareAscending(right, left)
}

function compareOptionalDescending(left: number | null, right: number | null) {
  if (left === null || right === null) return 0
  return compareDescending(left, right)
}

function compareLexically(left: string, right: string) {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}
