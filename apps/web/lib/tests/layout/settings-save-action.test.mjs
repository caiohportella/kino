import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('settings places the responsive save action below the bio field', async () => {
  const source = await readFile(new URL('../../../app/settings/page.tsx', import.meta.url), 'utf8')

  assert.doesNotMatch(
    source,
    /fixed inset-x-0 bottom-0[\s\S]*?lg:hidden[\s\S]*?common\.save/,
    'the responsive save action should not compete with the fixed bottom navigation'
  )

  assert.match(
    source,
    /\{error \? <p className="text-sm text-red-300">\{error\}<\/p> : null\}\s*<div className="mt-5 lg:hidden">[\s\S]*?\{saveMutation\.isPending \? t\('common\.loading'\) : t\('common\.save'\)\}/,
    'the responsive save action should follow the bio field in normal flow'
  )

  const bioFieldIndex = source.indexOf("label={t('settings.bio')}")
  const responsiveSaveIndex = source.indexOf('<div className="mt-5 lg:hidden">')

  assert.ok(bioFieldIndex >= 0, 'the settings form should render the bio field')
  assert.ok(
    bioFieldIndex < responsiveSaveIndex,
    'the responsive save action should be rendered after the bio field'
  )
})
