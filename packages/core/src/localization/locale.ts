import type { NormalizedLocale } from './types.ts'

const LANGUAGE_PATTERN = /^[a-zA-Z]{2,3}$/
const SCRIPT_PATTERN = /^[a-zA-Z]{4}$/
const REGION_PATTERN = /^(?:[a-zA-Z]{2}|\d{3})$/
const VARIANT_PATTERN = /^[a-zA-Z0-9]{4,8}$/

export function normalizeLocale(input: string): NormalizedLocale {
  const value = input.trim().replaceAll('_', '-')
  const parts = value.split('-')

  if (
    !LANGUAGE_PATTERN.test(parts[0] ?? '') ||
    parts.slice(1).some((part) => {
      return !SCRIPT_PATTERN.test(part) && !REGION_PATTERN.test(part) && !VARIANT_PATTERN.test(part)
    })
  ) {
    throw new TypeError(`Invalid locale: "${input}"`)
  }

  return parts
    .map((part, index) => {
      if (index === 0) return part.toLowerCase()
      if (SCRIPT_PATTERN.test(part)) {
        return `${part[0]?.toUpperCase()}${part.slice(1).toLowerCase()}`
      }
      if (REGION_PATTERN.test(part)) return part.toUpperCase()
      return part.toLowerCase()
    })
    .join('-')
}

export function normalizeRegion(input: string): string {
  const value = input.trim()
  if (!REGION_PATTERN.test(value)) {
    throw new TypeError(`Invalid region: "${input}"`)
  }
  return value.toUpperCase()
}

export function localeBaseLanguage(locale: string): string {
  return normalizeLocale(locale).split('-')[0] as string
}

export function localeRegion(locale: string): string | null {
  const parts = normalizeLocale(locale).split('-')
  return parts.find((part, index) => index > 0 && REGION_PATTERN.test(part)) ?? null
}
