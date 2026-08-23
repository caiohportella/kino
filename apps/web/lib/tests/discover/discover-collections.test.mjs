import assert from 'node:assert/strict'
import test from 'node:test'

import {
  DISCOVER_COLLECTIONS,
  discoverCollectionMediaIdentity,
  getDiscoverCollection,
  getDiscoverCollectionTitleCount,
  isDiscoverCollectionId,
  parseDiscoverCollection,
} from '../../discover/collections.ts'

const EXPECTED_COLLECTION_IDS = [
  'star-wars',
  'mcu',
  'wizarding-world',
  'middle-earth',
  'jurassic',
  'pirates-of-the-caribbean',
  'the-godfather',
  'the-matrix',
  'rocky-creed',
  'john-wick',
  'alien',
  'james-bond',
  'planet-of-the-apes',
  'mission-impossible',
  'dc',
  'fast-and-furious',
  'toy-story',
  'shrek',
]

test('parses a supported franchise collection id', () => {
  const collection = parseDiscoverCollection('star-wars')

  assert.ok(collection)
  assert.equal(collection.id, 'star-wars')
  assert.equal(collection.titleDefault, 'Star Wars')
})

test('invalid collection ids resolve to null', () => {
  assert.equal(parseDiscoverCollection('whatever'), null)
  assert.equal(parseDiscoverCollection('hidden-gems'), null)
  assert.equal(parseDiscoverCollection(null), null)
})

test('recognizes only registered collection ids', () => {
  assert.equal(isDiscoverCollectionId('star-wars'), true)
  assert.equal(isDiscoverCollectionId('mcu'), true)
  assert.equal(isDiscoverCollectionId('shrek'), true)

  assert.equal(isDiscoverCollectionId('hidden-gems'), false)
  assert.equal(isDiscoverCollectionId('whatever'), false)
})

test('exports franchise collections in stable editorial order', () => {
  assert.deepEqual(
    DISCOVER_COLLECTIONS.map((collection) => collection.id),
    EXPECTED_COLLECTION_IDS
  )
})

test('collection ids are unique', () => {
  const ids = DISCOVER_COLLECTIONS.map((collection) => collection.id)

  assert.equal(new Set(ids).size, ids.length)
})

test('every collection exposes complete presentation metadata', () => {
  for (const collection of DISCOVER_COLLECTIONS) {
    assert.ok(collection.titleKey)
    assert.ok(collection.titleDefault)
    assert.ok(collection.descriptionKey)
    assert.ok(collection.descriptionDefault)

    assert.match(collection.titleKey, /^discover\.collections\./)
    assert.match(collection.descriptionKey, /^discover\.collections\./)

    assert.ok(collection.hero)
    assert.ok(collection.source)
    assert.ok(collection.views.length > 0)
  }
})

test('every collection hero has a stable movie or tv identity', () => {
  for (const collection of DISCOVER_COLLECTIONS) {
    const identity = discoverCollectionMediaIdentity(collection.hero)

    assert.match(identity, /^(movie|tv):\d+$/)
  }
})

test('media identity keeps movie and tv ids separate', () => {
  assert.equal(
    discoverCollectionMediaIdentity({
      tmdbId: 10,
      type: 'movie',
    }),
    'movie:10'
  )

  assert.equal(
    discoverCollectionMediaIdentity({
      tmdbId: 10,
      type: 'tv',
    }),
    'tv:10'
  )
})

test('getDiscoverCollection returns the registered collection definition', () => {
  const collection = getDiscoverCollection('middle-earth')

  assert.equal(collection.id, 'middle-earth')
  assert.equal(collection.titleDefault, 'Middle-earth')

  assert.equal(
    collection,
    DISCOVER_COLLECTIONS.find((item) => item.id === 'middle-earth')
  )
})

test('Star Wars combines franchise films with the wider universe', () => {
  const collection = getDiscoverCollection('star-wars')

  assert.equal(collection.source.type, 'composite')

  assert.deepEqual(
    collection.source.sources.map((source) => ({
      id: source.id,
      type: source.type,
    })),
    [
      {
        id: 'star-wars-films',
        type: 'tmdb-collection',
      },
      {
        id: 'star-wars-universe',
        type: 'tmdb-keyword',
      },
    ]
  )

  assert.deepEqual(
    collection.views.map((view) => view.id),
    ['skywalker-saga', 'movies', 'series', 'release-order']
  )
})

test('MCU keeps dynamic franchise membership separate from curated chronology', () => {
  const collection = getDiscoverCollection('mcu')

  assert.equal(collection.source.type, 'composite')

  const chronological = collection.views.find((view) => view.id === 'chronological')

  assert.ok(chronological)
  assert.equal(chronological.type, 'curated-order')
  assert.equal(chronological.includeUnranked, false)
  assert.ok(chronological.order.length > 0)

  const releaseOrder = collection.views.find((view) => view.id === 'release-order')

  assert.ok(releaseOrder)
  assert.equal(releaseOrder.type, 'release-order')
})

test('collections can expose multiple independently addressable franchise views', () => {
  const collection = getDiscoverCollection('wizarding-world')

  assert.deepEqual(
    collection.views.map((view) => view.id),
    ['harry-potter', 'fantastic-beasts', 'release-order']
  )

  const harryPotter = collection.views.find((view) => view.id === 'harry-potter')

  assert.ok(harryPotter)
  assert.equal(harryPotter.type, 'source')
  assert.deepEqual(harryPotter.sourceIds, ['harry-potter'])
})

test('release-range views can describe franchise eras', () => {
  const collection = getDiscoverCollection('james-bond')

  const classicEra = collection.views.find((view) => view.id === 'classic-era')

  assert.ok(classicEra)
  assert.equal(classicEra.type, 'release-range')
  assert.equal(classicEra.from, '1962-01-01')
  assert.equal(classicEra.to, '1971-12-31')
  assert.equal(classicEra.mediaType, 'movie')

  const danielCraigEra = collection.views.find((view) => view.id === 'daniel-craig-era')

  assert.ok(danielCraigEra)
  assert.equal(danielCraigEra.type, 'release-range')
  assert.equal(danielCraigEra.from, '2006-01-01')
  assert.equal(danielCraigEra.to, '2021-12-31')
})

test('static title counts are deterministic but do not represent resolved collection size', () => {
  for (const collection of DISCOVER_COLLECTIONS) {
    const count = getDiscoverCollectionTitleCount(collection)

    assert.equal(Number.isInteger(count), true)
    assert.ok(count >= 1)
  }

  assert.ok(
    getDiscoverCollectionTitleCount(getDiscoverCollection('mcu')) >
      getDiscoverCollectionTitleCount(getDiscoverCollection('the-matrix'))
  )
})
