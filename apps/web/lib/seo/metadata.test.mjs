import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const localeFiles = {
  en: 'en-GB.json',
  pt: 'pt-BR.json',
  fr: 'fr-FR.json',
  it: 'it-IT.json',
  no: 'nb-NO.json',
}

const metadataKeys = [
  'siteDescription',
  'settingsTitle',
  'settingsDescription',
  'importTitle',
  'importDescription',
  'discoverTitle',
  'discoverDescription',
  'diaryTitle',
  'diaryDescription',
  'searchTitle',
  'searchDescription',
  'watchlistsTitle',
  'watchlistsDescription',
  'activityTitle',
  'activityDescription',
  'titleNotFound',
  'personNotFound',
  'profileUnavailable',
  'profileNotFound',
  'profileDescription',
  'watchlistUnavailable',
  'watchlistDescription',
  'watchlistEmptyDescription',
  'titleDescription',
  'personDescription',
]

test('every supported web locale has the complete metadata dictionary', async () => {
  for (const [locale, filename] of Object.entries(localeFiles)) {
    const source = await readFile(
      new URL(`../../../../packages/i18n/generated/${filename}`, import.meta.url),
      'utf8'
    )
    const metadata = JSON.parse(source).metadata
    for (const key of metadataKeys) assert.equal(typeof metadata[key], 'string', `${locale}.${key}`)
  }
})

test('web metadata resolves locale on the server and avoids static route metadata', async () => {
  const helper = await readFile(new URL('./server-metadata.ts', import.meta.url), 'utf8')

  const settings = await readFile(new URL('../../app/settings/layout.tsx', import.meta.url), 'utf8')

  const title = await readFile(new URL('../../app/title/[id]/page.tsx', import.meta.url), 'utf8')

  assert.match(helper, /getServerMetadataContext\(\)/)
  assert.match(helper, /openGraph/)
  assert.match(settings, /generateMetadata/)
  assert.doesNotMatch(settings, /export const metadata/)
  assert.match(title, /getServerMetadataContext\(\)/)
  assert.match(title, /getTitleSeoData\(tmdbId, type, language\)/)
  assert.match(title, /getTitleSeoData\(tmdbId, type, 'en'\)/)
})

test('title metadata and JSON-LD use the same server-resolved locale', async () => {
  const title = await readFile(new URL('../../app/title/[id]/page.tsx', import.meta.url), 'utf8')

  assert.equal((title.match(/getServerMetadataContext\(\)/g) || []).length, 2)
  assert.equal((title.match(/getTitleSeoData\(tmdbId, type, language\)/g) || []).length, 2)
  assert.match(title, /getTitleSeoData\(tmdbId, type, ['"]en['"]\)/)
})

test('metadata social titles are formatted once while document titles use the root template', async () => {
  const helper = await readFile(new URL('./server-metadata.ts', import.meta.url), 'utf8')

  assert.match(helper, /title,\n    description/)
  assert.match(helper, /const socialTitle = `\$\{title\} \| \$\{SITE_NAME\}`/)
})
