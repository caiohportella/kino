import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isSearchResponseV1,
  normalizeProviderCandidate,
  normalizeSearchQuery,
  normalizeSearchRequestV1,
} from './normalize.ts'
import { SEARCH_SCHEMA_VERSION } from './types.ts'

test('folds accents, case, whitespace, and a terminal release year', () => {
  assert.deepEqual(normalizeSearchQuery('  Amélie   2001 '), {
    original: 'Amélie 2001',
    folded: 'amelie 2001',
    tokens: ['amelie', '2001'],
    year: 2001,
  })
})

test('normalizes empty, punctuation-only, and non-terminal years', () => {
  assert.deepEqual(normalizeSearchQuery(' \t '), {
    original: '',
    folded: '',
    tokens: [],
  })
  assert.deepEqual(normalizeSearchQuery('!!!'), {
    original: '!!!',
    folded: '',
    tokens: [],
  })
  assert.deepEqual(normalizeSearchQuery('2001: A Space Odyssey'), {
    original: '2001: A Space Odyssey',
    folded: '2001 a space odyssey',
    tokens: ['2001', 'a', 'space', 'odyssey'],
  })
})

test('accepts version one requests and rejects unsupported request schemas', () => {
  assert.deepEqual(
    normalizeSearchRequestV1({
      schemaVersion: SEARCH_SCHEMA_VERSION,
      query: '  Alien 1979 ',
      locale: 'pt-br',
      region: 'br',
      mediaTypes: ['movie', 'movie'],
      page: 2,
      limit: 10,
    }),
    {
      schemaVersion: 1,
      query: 'Alien 1979',
      locale: 'pt-BR',
      region: 'BR',
      mediaTypes: ['movie'],
      page: 2,
      limit: 10,
    }
  )

  assert.throws(
    () => normalizeSearchRequestV1({ schemaVersion: 2, query: 'Alien' }),
    (error) =>
      error.code === 'unsupported_version' &&
      error.supportedMinimum === 1 &&
      error.supportedMaximum === 1 &&
      error.upgradeRequired === true
  )
})

test('accepts additive optional response fields without changing version compatibility', () => {
  assert.equal(
    isSearchResponseV1({
      schemaVersion: 1,
      query: {
        original: 'Alien',
        folded: 'alien',
        tokens: ['alien'],
      },
      results: [],
      groups: [],
      total: 0,
      page: 1,
      limit: 20,
      futureOptionalField: { safeToIgnore: true },
    }),
    true
  )
  assert.equal(isSearchResponseV1({ schemaVersion: 2, results: [], groups: [] }), false)
})

test('normalizes provider-neutral candidate data and discards unknown fields', () => {
  assert.deepEqual(
    normalizeProviderCandidate({
      source: 'semantic',
      entity: {
        id: 'movie:194',
        entityType: 'movie',
        title: ' Amélie ',
        tmdbId: 194,
        year: 2001,
        locale: 'fr-fr',
        route: '/movie/194',
        vendorNamespace: 'must-not-escape',
      },
      semanticScore: 1.4,
      providerInternalId: 'must-not-escape',
    }),
    {
      source: 'semantic',
      entity: {
        id: 'movie:194',
        entityType: 'movie',
        title: 'Amélie',
        tmdbId: 194,
        year: 2001,
        locale: 'fr-FR',
        route: '/movie/194',
      },
      semanticScore: 1,
    }
  )
})

test('rejects malformed provider candidates', () => {
  for (const malformed of [
    null,
    {},
    { source: 'semantic', semanticScore: 0.5 },
    {
      source: 'semantic',
      semanticScore: Number.NaN,
      entity: { id: 'movie:1', entityType: 'movie', title: 'Alien' },
    },
    {
      source: 'semantic',
      semanticScore: 0.5,
      entity: { id: '', entityType: 'movie', title: 'Alien' },
    },
  ]) {
    assert.equal(normalizeProviderCandidate(malformed), null)
  }
})
