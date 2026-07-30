import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('mobile title review cards keep the avatar bounded and let the review body use the content column', async () => {
  const source = await readFile(
    new URL('../components/reviews/ReviewCard.tsx', import.meta.url),
    'utf8'
  )

  assert.match(source, /className="w-full flex-row gap-3 border-t border-black\/30 py-4"/)
  assert.match(source, /className="h-10 w-10 shrink-0 rounded-full"/)
  assert.match(
    source,
    /className="h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary"/
  )
  assert.match(source, /className="min-w-0 flex-1"/)
  assert.match(source, /className="w-full text-sm leading-6 text-text-primary"/)
})
