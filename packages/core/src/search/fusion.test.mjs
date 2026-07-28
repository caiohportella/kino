import assert from 'node:assert/strict'
import test from 'node:test'
import { fuseSearchCandidates, normalizeProviderScore } from './fusion.ts'

const alien = {
  id: 'movie:348',
  entityType: 'movie',
  title: 'Alien',
  tmdbId: 348,
  year: 1979,
}

test('normalizes arbitrary provider score ranges into a bounded relevance score', () => {
  assert.equal(normalizeProviderScore(75, { minimum: 0, maximum: 100 }), 0.75)
  assert.equal(
    normalizeProviderScore(20, { minimum: 0, maximum: 100, direction: 'lower_is_better' }),
    0.8
  )
  assert.equal(normalizeProviderScore(150, { minimum: 0, maximum: 100 }), 1)
  assert.equal(normalizeProviderScore(Number.NaN, { minimum: 0, maximum: 1 }), 0)
  assert.equal(normalizeProviderScore(1, { minimum: 1, maximum: 1 }), 0)
})

test('merges duplicate entity evidence and source identities', () => {
  const fused = fuseSearchCandidates([
    {
      sourceId: 'vector',
      candidates: [{ source: 'semantic', entity: alien, semanticScore: 0.91 }],
    },
    {
      sourceId: 'catalog',
      candidates: [
        {
          source: 'lexical',
          entity: alien,
          lexicalScore: 1,
          exactMatch: true,
          prefixMatch: true,
          localeRelevance: 0.8,
        },
      ],
    },
  ])

  assert.deepEqual(fused, [
    {
      identity: 'movie:348',
      entity: alien,
      sources: ['catalog', 'vector'],
      semanticScore: 0.91,
      lexicalScore: 1,
      exactMatch: true,
      prefixMatch: true,
      localeRelevance: 0.8,
    },
  ])
})

test('fusion output is identical when providers and candidates are reversed', () => {
  const sources = [
    {
      sourceId: 'people',
      candidates: [
        {
          source: 'person',
          entity: {
            id: 'person:3084',
            entityType: 'person',
            title: 'Marlon Brando',
            tmdbId: 3084,
          },
          confidence: 0.97,
        },
      ],
    },
    {
      sourceId: 'catalog',
      candidates: [
        { source: 'semantic', entity: alien, semanticScore: 0.91 },
        { source: 'semantic', entity: { ...alien, id: 'alternate:348' }, semanticScore: 0.8 },
      ],
    },
  ]

  const reversed = [...sources]
    .reverse()
    .map((source) => ({ ...source, candidates: [...source.candidates].reverse() }))
  assert.deepEqual(fuseSearchCandidates(sources), fuseSearchCandidates(reversed))
})
