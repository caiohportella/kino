import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeProfileWatchlistCard } from './profile-watchlist-card.ts'

const watchlist = {
  coverImages: ['/first.jpg', '/second.jpg'],
  coverVersion: 'version-one',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  id: '796859a0-f2ab-4833-813d-592d09f8d2e1',
  isShared: false,
  name: 'Must Watch',
  titleCount: 2,
  updatedAt: new Date('2026-07-26T12:00:00.000Z'),
  userId: 'user-id',
  visibility: 'public',
}

test('normalizes a public watchlist for the shared title card presentation', () => {
  const item = normalizeProfileWatchlistCard(watchlist, {
    count: '2 titles',
    href: '/watchlists/796859a0-f2ab-4833-813d-592d09f8d2e1-must-watch',
    imageUrl: '/api/og/watchlist/796859a0-f2ab-4833-813d-592d09f8d2e1/cover?v=first',
  })

  assert.equal(item.title, 'Must Watch')
  assert.equal(item.subtitle, '2 titles')
  assert.equal(item.href, '/watchlists/796859a0-f2ab-4833-813d-592d09f8d2e1-must-watch')
  assert.match(item.imageUrl, /^\/api\/og\/watchlist\/.+\/cover\?v=/)
  assert.doesNotMatch(item.href, /type=|tmdb/i)
})

test('preserves the content-versioned cover URL supplied by the summary adapter', () => {
  const original = normalizeProfileWatchlistCard(watchlist, {
    count: '2 titles',
    href: '/watchlists/list',
    imageUrl: '/api/og/watchlist/list/cover?v=first',
  })
  assert.equal(original.imageUrl, '/api/og/watchlist/list/cover?v=first')
})
