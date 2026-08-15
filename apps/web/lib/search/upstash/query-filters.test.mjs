import assert from 'node:assert/strict'
import test from 'node:test'

import { buildPersonQuery, buildTitleQuery, buildUserQuery } from './query-filters.ts'

test('builds Redis Search smart, fuzzy, should, and boost clauses', () => {
  const title = buildTitleQuery('godf', { autocomplete: true })
  const serialized = JSON.stringify(title)
  assert.match(serialized, /\$should/)
  assert.match(serialized, /\$smart/)
  assert.match(serialized, /\$fuzzy/)
  assert.match(serialized, /prefix/)
  assert.match(serialized, /\$boost/)
  assert.match(serialized, /"entityType":\{"\$in"|"entityType":\{"\$eq"|"entityType"/)
  assert.deepEqual(buildTitleQuery('godf', { mediaTypes: ['movie'] }).$must[0], {
    entityType: { $eq: 'movie' },
  })
  assert.deepEqual(buildTitleQuery('godf', { mediaTypes: ['movie', 'series'] }).$must[0], {
    $should: [{ entityType: { $eq: 'movie' } }, { entityType: { $eq: 'series' } }],
  })
  assert.match(JSON.stringify(buildPersonQuery('oppenhimer')), /\$fuzzy/)
  assert.match(JSON.stringify(buildPersonQuery('oppenhimer')), /person/)
  assert.match(JSON.stringify(buildUserQuery('alice')), /username/)
  assert.match(JSON.stringify(buildUserQuery('alice')), /user/)
})
