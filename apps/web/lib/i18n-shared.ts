import type { KinoLanguage } from '@/stores/settings-store'

export const supportedLanguages = [
  'en',
  'fr',
  'it',
  'no',
  'pt',
] as const satisfies readonly KinoLanguage[]

export function isSupportedLanguage(language: string): language is KinoLanguage {
  return supportedLanguages.includes(language as KinoLanguage)
}
