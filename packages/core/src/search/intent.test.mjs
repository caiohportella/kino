import assert from 'node:assert/strict'
import test from 'node:test'
import { detectSearchIntent } from './intent.ts'
import { normalizeSearchQuery } from './normalize.ts'

const cases = [
  {
    query: 'Marlon Brando',
    evidence: { personConfidence: 0.95 },
    want: { kind: 'person', personName: 'Marlon Brando' },
  },
  {
    query: 'movies with Marlon Brando',
    evidence: { personConfidence: 0.95 },
    want: {
      kind: 'relationship',
      personName: 'Marlon Brando',
      role: 'acting',
      mediaTypes: ['movie'],
    },
  },
  {
    query: 'films directed by Sofia Coppola',
    evidence: { personConfidence: 0.96 },
    want: {
      kind: 'relationship',
      personName: 'Sofia Coppola',
      role: 'directing',
      mediaTypes: ['movie'],
    },
  },
  {
    query: 'shows starring Pedro Pascal',
    evidence: { personConfidence: 0.99 },
    want: {
      kind: 'relationship',
      personName: 'Pedro Pascal',
      role: 'acting',
      mediaTypes: ['series'],
    },
  },
  {
    query: 'Alien 1979',
    evidence: { exactTitleConfidence: 0.98 },
    want: { kind: 'title_year', title: 'Alien', year: 1979 },
  },
  {
    query: 'space horror from the 1980s',
    evidence: {},
    want: { kind: 'semantic_discovery' },
  },
]

for (const { query, evidence, want } of cases) {
  test(`detects ${query} deterministically`, () => {
    assert.deepEqual(detectSearchIntent(normalizeSearchQuery(query), evidence), want)
  })
}

test('uses provider person confidence only as supplied evidence at the boundary', () => {
  const query = normalizeSearchQuery('Marlon Brando')
  assert.deepEqual(detectSearchIntent(query, { personConfidence: 0.8 }), {
    kind: 'person',
    personName: 'Marlon Brando',
  })
  assert.deepEqual(detectSearchIntent(query, { personConfidence: 0.799 }), {
    kind: 'ambiguous',
  })
})

test('detects exact titles and franchises from explicit evidence', () => {
  assert.deepEqual(
    detectSearchIntent(normalizeSearchQuery('The Godfather'), { exactTitleConfidence: 0.9 }),
    { kind: 'exact_title', title: 'The Godfather' }
  )
  assert.deepEqual(
    detectSearchIntent(normalizeSearchQuery('Alien franchise'), { franchiseConfidence: 0.9 }),
    { kind: 'franchise', franchiseName: 'Alien' }
  )
})
