'use client'

import en from '../../../locales/en/translation.json'
import fr from '../../../locales/fr/translation.json'
import it from '../../../locales/it/translation.json'
import no from '../../../locales/no/translation.json'
import pt from '../../../locales/pt/translation.json'
import type { KinoLanguage } from '@/stores/settings-store'
import { useSettingsStore } from '@/stores/settings-store'

type TranslationResource = Record<string, unknown>
type TranslationOptions = Record<string, string | number | boolean | null | undefined> & {
  defaultValue?: string
}

export const resources: Record<KinoLanguage, TranslationResource> = {
  en,
  fr,
  it,
  no,
  pt,
}

export const supportedLanguages = ['en', 'fr', 'it', 'no', 'pt'] as const satisfies readonly KinoLanguage[]

export function isSupportedLanguage(language: string): language is KinoLanguage {
  return supportedLanguages.includes(language as KinoLanguage)
}

export function translate(language: KinoLanguage, key: string, options: TranslationOptions = {}) {
  const template = resolveTranslation(resources[language], key) ?? resolveTranslation(resources.en, key)
  const fallback = options.defaultValue ?? key
  return interpolate(template ?? fallback, options)
}

export function useTranslation() {
  const language = useSettingsStore((state) => state.language)

  return {
    i18n: {
      language,
      changeLanguage: async (nextLanguage: KinoLanguage) => {
        useSettingsStore.getState().setLanguage(nextLanguage)
      },
    },
    t: (key: string, options?: TranslationOptions) => translate(language, key, options),
  }
}

function resolveTranslation(resource: TranslationResource, key: string) {
  let current: unknown = resource

  for (const segment of key.split('.')) {
    if (!isRecord(current)) return null
    current = current[segment]
  }

  return typeof current === 'string' ? current : null
}

function interpolate(template: string, options: TranslationOptions) {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, token: string) => {
    const value = options[token]
    return value === undefined || value === null ? '' : String(value)
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
