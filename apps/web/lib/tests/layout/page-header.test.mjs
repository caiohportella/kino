import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const pages = [
  {
    name: 'activity',
    path: '../../../app/activity/page.tsx',
    key: 'activity.headerPhrase',
  },
  {
    name: 'diary',
    path: '../../../app/diary/page.tsx',
    key: 'diary.headerPhrase',
  },
  {
    name: 'watchlists',
    path: '../../../app/watchlists/page.tsx',
    key: 'watchlists.headerPhrase',
  },
  {
    name: 'search',
    path: '../../../app/search/page.tsx',
    key: 'search.headerPhrase',
  },
  {
    name: 'settings',
    path: '../../../app/settings/page.tsx',
    key: 'settings.headerPhrase',
  },
  {
    name: 'import',
    path: '../../../app/import/page.tsx',
    key: 'importFlow.headerPhrase',
  },
]

for (const page of pages) {
  test(`${page.name} uses a descriptive PageHeader phrase`, async () => {
    const source = await readFile(new URL(page.path, import.meta.url), 'utf8')

    assert.match(
      source,
      new RegExp(page.key.replace('.', '\\.')),
      `${page.name} should use its dedicated header phrase`
    )

    assert.match(
      source,
      /defaultValue:/,
      `${page.name} header phrase should provide a Tolgee extraction default`
    )
  })
}

test('diary no longer repeats its section name as an eyebrow', async () => {
  const source = await readFile(new URL('../../../app/diary/page.tsx', import.meta.url), 'utf8')

  assert.doesNotMatch(
    source,
    /eyebrow=\{t\(["']diary\.title["']\)\}/,
    'the diary page should not repeat its navigation label'
  )
})
