import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  SEARCH_CARD_GAP_PX,
  SEARCH_CARD_MIN_WIDTH_PX,
  searchSkeletonCapacity,
} from './presentation.ts'

test('derives sufficient skeleton capacity from the same card and gap geometry as loaded results', () => {
  const cases = [
    [320, 4],
    [768, 8],
    [1024, 12],
    [1320, 14],
  ]
  for (const [width, minimum] of cases) {
    assert.ok(
      searchSkeletonCapacity({
        cardWidth: SEARCH_CARD_MIN_WIDTH_PX,
        containerWidth: width,
        gap: SEARCH_CARD_GAP_PX,
        padding: 0,
        rows: 2,
      }) >= minimum
    )
  }
})

test('keeps controls and full-width result sections in separate standard containers', async () => {
  const source = await readFile(new URL('../../app/search/page.tsx', import.meta.url), 'utf8')
  assert.match(source, /data-search-controls/)
  assert.match(source, /data-search-results/)
  assert.match(source, /className="content-frame min-w-0"/)
  assert.doesNotMatch(source, /result\.score[\s\S]{0,80}vote_average|vote_average:\s*result\.score/)
})

test('search skeleton and loaded title groups share poster-grid geometry', async () => {
  const [page, skeleton] = await Promise.all([
    readFile(new URL('../../app/search/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../../components/skeletons/page-skeletons.tsx', import.meta.url), 'utf8'),
  ])
  assert.match(page, /entityType === 'title'[\s\S]*?'poster-grid'/)
  assert.match(skeleton, /data-search-skeleton-group[\s\S]*?poster-grid/)
  assert.match(skeleton, /searchSkeletonCapacity/)
})
