import assert from 'node:assert/strict'
import test from 'node:test'

import { selectAffinityReleaseCandidates } from '../../discover/release-affinity-candidates.ts'

function candidate(id, name = `Candidate ${id}`) {
  return {
    id,
    name,
    score: 50,
    averageRating: 4.5,
    titleCount: 3,
  }
}

test('selects candidates from every affinity kind', () => {
  const result = selectAffinityReleaseCandidates({
    actors: [candidate(1)],
    directors: [candidate(2)],
    studios: [candidate(3)],
  })

  assert.deepEqual(
    result.map((item) => ({
      kind: item.kind,
      id: item.source.id,
    })),
    [
      { kind: 'actor', id: 1 },
      { kind: 'director', id: 2 },
      { kind: 'studio', id: 3 },
    ]
  )
})

test('keeps ranking information for diagnostics', () => {
  const result = selectAffinityReleaseCandidates({
    actors: [candidate(10), candidate(20), candidate(30)],
    directors: [],
    studios: [],
  })

  assert.deepEqual(
    result.map((item) => item.rank),
    [1, 2, 3]
  )
})

test('caps each affinity kind independently', () => {
  const result = selectAffinityReleaseCandidates(
    {
      actors: [candidate(1), candidate(2), candidate(3), candidate(4)],
      directors: [candidate(10), candidate(20), candidate(30), candidate(40)],
      studios: [candidate(100), candidate(200), candidate(300), candidate(400)],
    },
    3
  )

  assert.equal(result.length, 9)

  assert.deepEqual(
    result.filter((item) => item.kind === 'actor').map((item) => item.source.id),
    [1, 2, 3]
  )

  assert.deepEqual(
    result.filter((item) => item.kind === 'director').map((item) => item.source.id),
    [10, 20, 30]
  )

  assert.deepEqual(
    result.filter((item) => item.kind === 'studio').map((item) => item.source.id),
    [100, 200, 300]
  )
})
