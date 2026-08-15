import type { KinoLanguage } from '@kino/core/locale-config'
import de from '@kino/i18n/generated/de-DE.json'
import en from '@kino/i18n/generated/en-GB.json'
import es from '@kino/i18n/generated/es-ES.json'
import fr from '@kino/i18n/generated/fr-FR.json'
import it from '@kino/i18n/generated/it-IT.json'
import no from '@kino/i18n/generated/nb-NO.json'
import pt from '@kino/i18n/generated/pt-BR.json'
import { cookies, headers } from 'next/headers'
import { isSupportedLanguage } from './i18n-shared'

const dictionaries = {
  en,
  fr,
  it,
  no,
  pt,
  de,
  es,
} as const

export async function getRequestLanguage(): Promise<KinoLanguage> {
  const cookieStore = await cookies()

  const cookieLanguage = cookieStore.get('kino-language')?.value

  if (cookieLanguage && isSupportedLanguage(cookieLanguage)) {
    return cookieLanguage
  }

  const headerStore = await headers()

  const acceptLanguage = headerStore.get('accept-language')

  if (!acceptLanguage) return 'en'

  for (const entry of acceptLanguage.split(',').map((value) => value.trim())) {
    const candidate = entry.split(';')[0]?.toLowerCase().split('-')[0]

    if (candidate && isSupportedLanguage(candidate)) {
      return candidate
    }
  }

  return 'en'
}

export async function getTranslations(language: KinoLanguage) {
  const dictionary = dictionaries[language] ?? dictionaries.en

  return function translate(key: string, options: Record<string, string | number> = {}): string {
    const parts = key.split('.')

    let value: unknown = dictionary

    for (const part of parts) {
      if (typeof value !== 'object' || value === null) {
        return key
      }

      value = (value as Record<string, unknown>)[part]
    }

    if (typeof value !== 'string') return key
    return value.replace(/\{\{\s*(\w+)(?:\s*,\s*number)?\s*\}\}/g, (_match, token: string) =>
      options[token] === undefined ? '' : String(options[token])
    )
  }
}
