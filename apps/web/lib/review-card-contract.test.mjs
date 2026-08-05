import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('published reviews expose linked Kino authors and direct owner controls', async () => {
  const [card, author, actions] = await Promise.all([
    readFile(new URL('../components/reviews/review-card.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../components/reviews/review-author.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../components/reviews/review-owner-actions.tsx', import.meta.url), 'utf8'),
  ])

  assert.equal(card.includes('DropdownMenu'), false)
  assert.equal(card.includes('MoreHorizontal'), false)
  assert.match(card, /size="xs"/)
  assert.match(card, /whitespace-pre-wrap/)
  assert.equal(card.includes('line-clamp'), false)
  assert.match(author, /normalizeProfileUsername/)
  assert.match(card, /variant="name"/)
  assert.match(actions, /Pencil/)
  assert.match(actions, /Trash2/)
  assert.match(actions, /Tooltip/)
  assert.match(actions, /aria-label=/)
})
