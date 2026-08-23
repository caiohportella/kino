import { type KinoLanguage, SUPPORTED_LANGUAGES } from '@kino/core/locale-config'

export function isSupportedLanguage(language: string): language is KinoLanguage {
  return SUPPORTED_LANGUAGES.some((supportedLanguage) => supportedLanguage === language)
}
