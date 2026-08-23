'use client'

import de from '@kino/i18n/generated/de-DE.json'
import en from '@kino/i18n/generated/en-GB.json'
import es from '@kino/i18n/generated/es-ES.json'
import fr from '@kino/i18n/generated/fr-FR.json'
import it from '@kino/i18n/generated/it-IT.json'
import no from '@kino/i18n/generated/nb-NO.json'
import pt from '@kino/i18n/generated/pt-BR.json'
import { cloneElement, isValidElement, type ReactNode } from 'react'
import { useSettingsStore } from '@/stores/settings-store'
import {
  getLocale,
  getRegion,
  type KinoLanguage,
  SUPPORTED_LANGUAGES,
} from '../../../../packages/core/src/locale-config'
import { getPluralTranslationKey } from './i18n-plural'

export type TranslationResource = Record<string, unknown>
export type TranslationOptions = Record<string, string | number | boolean | null | undefined> & {
  defaultValue?: string
}
export type RichTranslationOptions = Record<
  string,
  ReactNode | string | number | boolean | null | undefined
> & {
  defaultValue?: string
}
export type TFunction = (key: string, options?: TranslationOptions) => string

export const resources: Record<KinoLanguage, TranslationResource> = {
  en,
  fr,
  it,
  no,
  pt,
  de,
  es,
}

export const supportedLanguages = SUPPORTED_LANGUAGES

export function isSupportedLanguage(language: string): language is KinoLanguage {
  return supportedLanguages.includes(language as KinoLanguage)
}

export function translate(language: KinoLanguage, key: string, options: TranslationOptions = {}) {
  const template = resolveTranslationTemplate(language, key, options)
  const fallback = options.defaultValue ?? key
  return interpolate(template ?? fallback, options)
}

export function translateRich(
  language: KinoLanguage,
  key: string,
  options: RichTranslationOptions = {}
) {
  const template = resolveTranslationTemplate(language, key, options)
  const fallback = options.defaultValue ?? key
  return interpolateRich(template ?? fallback, options)
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
    rt: (key: string, options?: RichTranslationOptions) => translateRich(language, key, options),
    t: (key: string, options?: TranslationOptions) => translate(language, key, options),
  }
}

export function useLocale() {
  const language = useSettingsStore((state) => state.language)

  return {
    locale: getLocale(language),
    region: getRegion(language),
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

function resolveTranslationTemplate(
  language: KinoLanguage,
  key: string,
  options: TranslationOptions | RichTranslationOptions
) {
  const resolvedKey = getPluralTranslationKey(
    getLocale(language),
    key,
    typeof options.count === 'number' ? options.count : undefined
  )
  return (
    resolveTranslation(resources[language], resolvedKey) ??
    resolveTranslation(resources.en, resolvedKey) ??
    resolveTranslation(resources[language], key) ??
    resolveTranslation(resources.en, key)
  )
}

function interpolate(template: string, options: TranslationOptions) {
  return template.replace(/{{\s*(\w+)(?:\s*,\s*number)?\s*}}/g, (_match, token: string) => {
    const value = options[token]
    return value === undefined || value === null ? '' : String(value)
  })
}

function interpolateRich(template: string, options: RichTranslationOptions) {
  const parts: ReactNode[] = []
  const pattern = /{{\s*(\w+)(?:\s*,\s*number)?\s*}}/g
  let lastIndex = 0
  let tokenIndex = 0

  for (;;) {
    const match = pattern.exec(template)
    if (!match) break
    if (match.index > lastIndex) {
      parts.push(template.slice(lastIndex, match.index))
    }
    const token = match[1]
    if (!token) continue
    const value = options[token]
    if (value !== undefined && value !== null) {
      parts.push(
        isValidElement(value)
          ? cloneElement(value, {
              key: `${token}-${tokenIndex}`,
            })
          : (value as ReactNode)
      )
    }
    lastIndex = match.index + match[0].length
    tokenIndex += 1
  }

  if (lastIndex < template.length) {
    parts.push(template.slice(lastIndex))
  }

  return parts
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
