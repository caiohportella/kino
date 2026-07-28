import { localeBaseLanguage, normalizeLocale } from './locale.ts'

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
  readonly matches: (language: string | null | undefined) => boolean
}

type ImageQualityCandidate = Omit<LocalizedImageCandidate, 'language'> & { filePath: string }

export function selectLocalizedImage(input: SelectLocalizedImageInput): LocalizedImageSelection {
  const locale = normalizeLocale(input.locale)
  const baseLanguage = localeBaseLanguage(locale)
  const fallbackLocale = normalizeOptionalLocale(input.fallbackLocale)
  const originalLanguage = normalizeOptionalLocale(input.originalLanguage)
  const candidates = input.candidates
    .filter((candidate): candidate is LocalizedImageCandidate & { filePath: string } =>
      isProviderPath(candidate.filePath)
    )
    .map((candidate) => ({
      ...candidate,
      language: normalizeCandidateLocale(candidate.language),
    }))

  const tiers: readonly ImageTier[] = [
    {
      fallbackReason: null,
      languageTier: 'exact',
      matches: (language) => language === locale,
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
      .filter((candidate) => tier.matches(candidate.language))
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
  const aspectDifference =
    aspectDistance(left, preferredAspectRatio) - aspectDistance(right, preferredAspectRatio)
  if (aspectDifference !== 0) return aspectDifference

  const qualityDifference = finiteOrZero(right.quality) - finiteOrZero(left.quality)
  if (qualityDifference !== 0) return qualityDifference

  const resolutionDifference = pixelArea(right) - pixelArea(left)
  if (resolutionDifference !== 0) return resolutionDifference

  const voteAverageDifference = finiteOrZero(right.voteAverage) - finiteOrZero(left.voteAverage)
  if (voteAverageDifference !== 0) return voteAverageDifference

  const voteCountDifference = finiteOrZero(right.voteCount) - finiteOrZero(left.voteCount)
  if (voteCountDifference !== 0) return voteCountDifference

  const leftIdentity = left.id?.trim() || left.filePath
  const rightIdentity = right.id?.trim() || right.filePath
  const identityOrder = leftIdentity.localeCompare(rightIdentity)
  return identityOrder || left.filePath.localeCompare(right.filePath)
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
  return (finitePositive(candidate.width) ?? 0) * (finitePositive(candidate.height) ?? 0)
}

function finitePositive(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

function finiteOrZero(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}
