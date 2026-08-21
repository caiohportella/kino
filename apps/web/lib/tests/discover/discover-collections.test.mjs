import assert from 'node:assert/strict'
import test from 'node:test'

test('parses a supported collection id', async () => {
  const { parseDiscoverCollection } = await import('../../discover/collections.ts')

  assert.equal(parseDiscoverCollection('hidden-gems')?.id, 'hidden-gems')
})

test('invalid collection ids resolve to null', async () => {
  const { parseDiscoverCollection } = await import('../../discover/collections.ts')

  assert.equal(parseDiscoverCollection('whatever'), null)
  assert.equal(parseDiscoverCollection(null), null)
})

test('explicit filters narrow Hidden Gems without replacing its criteria', async () => {
  const { mergeDiscoverCriteria, parseDiscoverCollection } = await import('../../discover/collections.ts')

  const result = mergeDiscoverCriteria({
    collection: parseDiscoverCollection('hidden-gems'),
    filters: { mediaType: 'movie', genreIds: [18], minRating: 8 },
    page: 1,
  })

  assert.equal(result.requests.length, 1)
  assert.equal(result.requests[0].type, 'movie')
  assert.equal(result.requests[0].params.with_genres, '18')
  assert.equal(result.requests[0].params['vote_average.gte'], '8')
  assert.ok(result.requests[0].params['vote_count.gte'])
  assert.ok(result.queryKey.includes('hidden-gems'))
})

test('normal and collection states use different query keys', async () => {
  const { mergeDiscoverCriteria, parseDiscoverCollection } = await import('../../discover/collections.ts')

  const filters = { mediaType: 'all', genreIds: [], minRating: 0 }
  const normal = mergeDiscoverCriteria({ collection: null, filters, page: 1 })
  const curated = mergeDiscoverCriteria({
    collection: parseDiscoverCollection('quick-watch'),
    filters,
    page: 1,
  })

  assert.notDeepEqual(normal.queryKey, curated.queryKey)
})

test('query keys use effective collection rating criteria', async () => {
  const { mergeDiscoverCriteria, parseDiscoverCollection } = await import('../../discover/collections.ts')

  const collection = parseDiscoverCollection('hidden-gems')
  const baseline = mergeDiscoverCriteria({
    collection,
    filters: { mediaType: 'movie', genreIds: [], minRating: 0 },
    page: 1,
  })
  const redundantRating = mergeDiscoverCriteria({
    collection,
    filters: { mediaType: 'movie', genreIds: [], minRating: 6 },
    page: 1,
  })

  assert.deepEqual(redundantRating.requests, baseline.requests)
  assert.deepEqual(redundantRating.queryKey, baseline.queryKey)
})

test('quick watch query keys collapse incompatible tv state', async () => {
  const { mergeDiscoverCriteria, parseDiscoverCollection } = await import('../../discover/collections.ts')

  const collection = parseDiscoverCollection('quick-watch')
  const allMedia = mergeDiscoverCriteria({
    collection,
    filters: { mediaType: 'all', genreIds: [], minRating: 0 },
    page: 1,
  })
  const movieOnly = mergeDiscoverCriteria({
    collection,
    filters: { mediaType: 'movie', genreIds: [], minRating: 0 },
    page: 1,
  })

  assert.deepEqual(allMedia.requests, movieOnly.requests)
  assert.deepEqual(allMedia.queryKey, movieOnly.queryKey)
})

test('quick watch does not build a tv query', async () => {
  const { buildDiscoverCollectionParams, parseDiscoverCollection } = await import('../../discover/collections.ts')

  assert.equal(
    buildDiscoverCollectionParams(parseDiscoverCollection('quick-watch'), 'tv'),
    null,
  )
})
