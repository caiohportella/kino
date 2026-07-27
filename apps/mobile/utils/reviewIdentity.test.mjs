import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('mobile optimistic reviews use the Kino profile instead of provider metadata', async () => {
  const source = await readFile(new URL('../app/title/[id].tsx', import.meta.url), 'utf8')

  for (const forbidden of [
    'user.user_metadata.avatar_url',
    'user.user_metadata.full_name',
    'user.user_metadata.display_name',
  ]) {
    assert.equal(source.includes(forbidden), false, `must not use ${forbidden}`)
  }
  assert.match(source, /toReviewAuthor\s*\(/)
})
