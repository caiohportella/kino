import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveLocalizedTitlePresentation } from '../../localization/localized-title-presentation.ts'

const request = { tmdbId: 7, type: 'movie' }

test('uses localized presentation without persisted title or cover fallbacks', () => {
  const result = resolveLocalizedTitlePresentation({
    data: {
      'movie:7': { backdropPath: null, posterPath: '/p.jpg', title: 'Localized', year: 1972 },
    },
    errors: [],
    isError: false,
    missing: [],
    request,
    unknownTitle: 'Unknown title',
  })
  assert.equal(result.title, 'Localized')
  assert.equal(result.status, 'ready')
})

test('retains grid identity with stable placeholders for total, partial, and missing failures', () => {
  for (const input of [
    { errors: [], isError: true, missing: [] },
    { errors: [{ tmdbId: 7, type: 'movie' }], isError: false, missing: [] },
    { errors: [], isError: false, missing: [{ tmdbId: 7, type: 'movie' }] },
  ]) {
    const result = resolveLocalizedTitlePresentation({
      data: {},
      ...input,
      request,
      unknownTitle: 'Unknown title',
    })
    assert.equal(result.title, 'Unknown title')
    assert.equal(result.posterPath, null)
    assert.equal(result.status, input.missing.length ? 'missing' : 'error')
  }
})
