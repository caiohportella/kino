import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('watchlist preview titles carry the batched viewer watched state', async () => {
  const typesSource = await readFile(
    new URL('../../../../../packages/core/src/types.ts', import.meta.url),
    'utf8'
  )
  const databaseSource = await readFile(
    new URL('../../../../../packages/core/src/database.ts', import.meta.url),
    'utf8'
  )

  assert.match(typesSource, /interface WatchlistPreviewTitle[\s\S]*watched: boolean/)
  assert.match(databaseSource, /const watchedTitleIds = new Set<string>\(\)/)
  assert.match(databaseSource, /watched: watchedTitleIds\.has\(item\.title\.id\)/)
})

test('watchlist posters render watched indicators without intercepting poster links', async () => {
  const previewSource = await readFile(
    new URL('../../../components/watchlist/watchlist-preview-posters.tsx', import.meta.url),
    'utf8'
  )
  const detailSource = await readFile(
    new URL('../../../app/watchlists/[id]/page.tsx', import.meta.url),
    'utf8'
  )
  const posterSource = await readFile(
    new URL('../../../components/kino/index.tsx', import.meta.url),
    'utf8'
  )

  assert.match(previewSource, /title\.watched/)
  assert.match(previewSource, /Check/)
  assert.match(previewSource, /pointer-events-none/)
  assert.match(detailSource, /const completed = isItemWatched\(item\)/)
  assert.match(posterSource, /details\?\.completed/)
  assert.match(posterSource, /<Check/)
})
