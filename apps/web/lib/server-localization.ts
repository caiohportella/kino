import en from '@locales/en/translation.json'
import fr from '@locales/fr/translation.json'
import it from '@locales/it/translation.json'
import no from '@locales/no/translation.json'
import pt from '@locales/pt/translation.json'
import { cookies, headers } from 'next/headers'
import type { KinoLanguage } from '@/stores/settings-store'
import { isSupportedLanguage } from './i18n-shared'

const dictionaries = {
  en,
  fr,
  it,
  no,
  pt,
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

  return function translate(key: string): string {
    const parts = key.split('.')

    let value: unknown = dictionary

    for (const part of parts) {
      if (typeof value !== 'object' || value === null) {
        return key
      }

      value = (value as Record<string, unknown>)[part]
    }

    return typeof value === 'string' ? value : key
  }
}
