import { readFile } from 'node:fs/promises'

export const webLocales = ['en', 'pt', 'fr', 'it', 'no', 'de', 'es']

const localeFiles = {
  en: 'en-GB.json',
  pt: 'pt-BR.json',
  fr: 'fr-FR.json',
  it: 'it-IT.json',
  no: 'nb-NO.json',
  de: 'de-DE.json',
  es: 'es-ES.json',
}

export async function readLocale(locale) {
  const filename = localeFiles[locale]

  if (!filename) {
    throw new Error(`Unsupported web locale: ${locale}`)
  }

  const url = new URL(`../../../packages/i18n/generated/${filename}`, import.meta.url)

  return JSON.parse(await readFile(url, 'utf8'))
}
