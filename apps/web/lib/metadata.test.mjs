import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const locales = ['en', 'pt', 'fr', 'it', 'no']
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
  for (const locale of locales) {
    const source = await readFile(
      new URL(`../../../locales/${locale}/translation.json`, import.meta.url),
      'utf8'
    )
    const metadata = JSON.parse(source).metadata
    for (const key of metadataKeys) assert.equal(typeof metadata[key], 'string', `${locale}.${key}`)
  }
})

test('web metadata resolves locale on the server and avoids static route metadata', async () => {
  const helper = await readFile(new URL('./server-metadata.ts', import.meta.url), 'utf8')
  const settings = await readFile(new URL('../app/settings/layout.tsx', import.meta.url), 'utf8')
  const title = await readFile(new URL('../app/title/[id]/layout.tsx', import.meta.url), 'utf8')

  assert.match(helper, /getRequestLanguage\(\)/)
  assert.match(helper, /openGraph/)
  assert.match(settings, /generateMetadata/)
  assert.doesNotMatch(settings, /export const metadata/)
  assert.match(title, /getTitleSeoDataBySegment\(tmdbId, segment\.slug, language\)/)
  assert.doesNotMatch(title, /getTitleSeoDataBySegment\(tmdbId, segment\.slug, 'en'\)/)
})

test('metadata social titles are formatted once while document titles use the root template', async () => {
  const helper = await readFile(new URL('./server-metadata.ts', import.meta.url), 'utf8')

  assert.match(helper, /title,\n    description/)
  assert.match(helper, /const socialTitle = `\$\{title\} \| \$\{SITE_NAME\}`/)
})
