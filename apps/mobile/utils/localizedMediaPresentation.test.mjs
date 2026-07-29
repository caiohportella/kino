import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveLocalizedMediaPresentation } from '../hooks/data/localizedMediaPresentation.ts'

const request = { tmdb_id: 7, type: 'movie' }

test('uses only verified localized presentation', () => {
  const result = resolveLocalizedMediaPresentation({
    data: { 'movie:7': { backdrop_path: '/b.jpg', poster_path: '/p.jpg', title: 'Localized' } },
    errors: [],
    isError: false,
    missing: [],
    request,
    unknownTitle: 'Unknown title',
  })
  assert.equal(result.title, 'Localized')
  assert.equal(result.status, 'ready')
})

test('retains card identity with a Kino placeholder for total and per-item failures', () => {
  for (const input of [
    { errors: [], isError: true, missing: [] },
    { errors: [{ tmdbId: 7, type: 'movie' }], isError: false, missing: [] },
    { errors: [], isError: false, missing: [{ tmdbId: 7, type: 'movie' }] },
  ]) {
    const result = resolveLocalizedMediaPresentation({
      data: {},
      ...input,
      request,
      unknownTitle: 'Unknown title',
    })
    assert.equal(result.title, 'Unknown title')
    assert.equal(result.poster_path, null)
    assert.equal(result.status, input.missing.length ? 'missing' : 'error')
  }
})
