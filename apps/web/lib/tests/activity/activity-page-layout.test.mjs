import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const pageUrl = new URL('../../../app/activity/page.tsx', import.meta.url)

test('activity uses the wide application canvas', async () => {
  const source = await readFile(pageUrl, 'utf8')

  assert.doesNotMatch(
    source,
    /max-w-280/,
    'activity should not constrain the feed to a narrow centered rail'
  )
})

test('activity keeps one chronological column on wide screens', async () => {
  const source = await readFile(pageUrl, 'utf8')

  assert.doesNotMatch(
    source,
    /2xl:grid-cols-2/,
    'activity groups should remain a single chronological column'
  )

  assert.doesNotMatch(
    source,
    /2xl:col-span-2/,
    'activity items should not need outer-grid spanning'
  )
})
