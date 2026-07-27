import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('profile review cards link titles while preserving independent controls', async () => {
  const source = await readFile(
    new URL('../components/reviews/profile-review-card.tsx', import.meta.url),
    'utf8'
  )

  assert.match(source, /titlePath\(/)
  assert.match(source, /reviews\.openForTitle/)
  assert.match(source, /line-clamp-5/)
  assert.match(source, /md:line-clamp-4/)
  assert.match(source, /break-words/)
  assert.match(source, /ReviewAuthor/)
  assert.match(source, /ReviewOwnerActions/)
  assert.match(source, /aria-pressed=/)
  assert.match(source, /event\.stopPropagation\(\)/)
  assert.equal(source.includes('<Link href={href}>'), false)
})
