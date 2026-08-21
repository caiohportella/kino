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

test('something weird keeps a collection-only genre mix', async () => {
  const { buildDiscoverCollectionParams, parseDiscoverCollection } = await import('../../discover/collections.ts')

  const params = buildDiscoverCollectionParams(
    parseDiscoverCollection('something-weird'),
    'movie',
  )

  assert.equal(params.with_genres, '14|27|878|9648')
  assert.equal(params['popularity.lte'], '35')
  assert.equal(params['vote_average.gte'], '6')
})

test('new this month uses an explicit date window deterministically', async () => {
  const { buildDiscoverCollectionParams, parseDiscoverCollection } = await import('../../discover/collections.ts')

  const dateWindow = {
    start: '2024-02-10',
    end: '2024-02-19',
  }

  const first = buildDiscoverCollectionParams(
    parseDiscoverCollection('new-this-month'),
    'movie',
    { dateWindow },
  )
  const second = buildDiscoverCollectionParams(
    parseDiscoverCollection('new-this-month'),
    'movie',
    { dateWindow },
  )

  assert.equal(first['release_date.gte'], '2024-02-10')
  assert.equal(first['release_date.lte'], '2024-02-19')
  assert.deepEqual(second, first)
})
