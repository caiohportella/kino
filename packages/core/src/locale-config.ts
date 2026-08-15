export const KINO_LOCALES = {
  en: {
    locale: 'en-GB',
    region: 'GB',
  },
  pt: {
    locale: 'pt-BR',
    region: 'BR',
  },
  fr: {
    locale: 'fr-FR',
    region: 'FR',
  },
  it: {
    locale: 'it-IT',
    region: 'IT',
  },
  no: {
    locale: 'nb-NO',
    region: 'NO',
  },
  es: {
    locale: 'es-ES',
    region: 'ES',
  },
  de: {
    locale: 'de-DE',
    region: 'DE',
  },
} as const

export type KinoLanguage = keyof typeof KINO_LOCALES

export const SUPPORTED_LANGUAGES = Object.keys(KINO_LOCALES) as KinoLanguage[]

export function getLocale(language: KinoLanguage) {
  return KINO_LOCALES[language].locale
}

export function getRegion(language: KinoLanguage) {
  return KINO_LOCALES[language].region
}
