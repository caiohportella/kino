import { KINO_LOCALES, type KinoLanguage } from '@kino/core'

export type LocalizedAliasValue = string | readonly (string | null | undefined)[] | null | undefined
export type LocalizedAliasInput = Readonly<Record<string, LocalizedAliasValue>>
export type LocalizedTitleAliases = Partial<Record<KinoLanguage, string>>

function normalizeText(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/gu, ' ') : ''
}

function languageForLocale(value: string): KinoLanguage | null {
  const base = value.trim().toLocaleLowerCase('en-US').split('-')[0] ?? ''
  return Object.hasOwn(KINO_LOCALES, base) ? (base as KinoLanguage) : null
}

function valuesOf(value: LocalizedAliasValue): readonly (string | null | undefined)[] {
  return typeof value === 'string' || value == null ? [value] : value
}

export function mergeLocalizedTitleAliases(input: LocalizedAliasInput): LocalizedTitleAliases {
  const values = new Map<KinoLanguage, string[]>()
  for (const [locale, rawValue] of Object.entries(input)) {
    const language = languageForLocale(locale)
    if (!language) continue
    const current = values.get(language) ?? []
    for (const value of valuesOf(rawValue)) {
      const normalized = normalizeText(value)
      if (normalized && !current.includes(normalized)) current.push(normalized)
    }
    if (current.length > 0) values.set(language, current)
  }
  return Object.fromEntries(
    [...values.entries()].map(([language, aliases]) => [language, aliases.join(' ')])
  ) as LocalizedTitleAliases
}
