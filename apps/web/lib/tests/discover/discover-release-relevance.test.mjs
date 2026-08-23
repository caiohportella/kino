import assert from 'node:assert/strict'
import test from 'node:test'

import { rankPersonalizedNewReleases } from '../../discover/release-relevance.ts'

function release(id, mediaType = 'movie') {
  return {
    id,
    media_type: mediaType,
  }
}

function identities(items) {
  return items.map((item) => `${item.media_type}:${item.id}`)
}

test('preserves release order when there are no personalization signals', () => {
  const releases = [release(1), release(2), release(3)]

  const result = rankPersonalizedNewReleases(releases, {
    relatedReleases: [],
  })

  assert.deepEqual(
    result.map((item) => item.id),
    [1, 2, 3]
  )
})

test('promotes releases connected to affinity signals', () => {
  const releases = [release(1), release(2), release(3)]

  const result = rankPersonalizedNewReleases(releases, {
    relatedReleases: [
      {
        kind: 'actor',
        items: [release(3)],
      },
    ],
  })

  assert.deepEqual(
    result.map((item) => item.id),
    [3, 1, 2]
  )
})

test('actor director and studio signals can combine for the same release', () => {
  const releases = [release(1), release(2), release(3)]

  const result = rankPersonalizedNewReleases(releases, {
    relatedReleases: [
      {
        kind: 'actor',
        items: [release(3)],
      },
      {
        kind: 'director',
        items: [release(3)],
      },
      {
        kind: 'studio',
        items: [release(3)],
      },
    ],
  })

  assert.deepEqual(
    result.map((item) => item.id),
    [3, 1, 2]
  )
})

test('multiple independent affinity matches strengthen a release', () => {
  const releases = [release(1), release(2), release(3)]

  const result = rankPersonalizedNewReleases(releases, {
    relatedReleases: [
      {
        kind: 'actor',
        items: [release(2), release(3)],
      },
      {
        kind: 'director',
        items: [release(3)],
      },
    ],
  })

  assert.deepEqual(
    result.map((item) => item.id),
    [3, 2, 1]
  )
})

test('keeps movie and tv ids separate when numeric ids match', () => {
  const releases = [release(10, 'movie'), release(10, 'tv'), release(20, 'movie')]

  const result = rankPersonalizedNewReleases(releases, {
    relatedReleases: [
      {
        kind: 'actor',
        items: [release(10, 'tv')],
      },
    ],
  })

  assert.deepEqual(identities(result), ['tv:10', 'movie:10', 'movie:20'])
})

test('preserves the existing order when personalization scores tie', () => {
  const releases = [release(1), release(2), release(3)]

  const result = rankPersonalizedNewReleases(releases, {
    relatedReleases: [
      {
        kind: 'actor',
        items: [release(1), release(2)],
      },
    ],
  })

  assert.deepEqual(
    result.map((item) => item.id),
    [1, 2, 3]
  )
})

test('can insert a relevant release that was not in the generic release feed', () => {
  const releases = [release(1), release(2)]

  const result = rankPersonalizedNewReleases(releases, {
    relatedReleases: [
      {
        kind: 'actor',
        items: [release(3)],
      },
    ],
  })

  assert.deepEqual(
    result.map((item) => item.id),
    [3, 1, 2]
  )
})

test('deduplicates releases collected from several affinity sources', () => {
  const releases = [release(1), release(2)]

  const related = release(3)

  const result = rankPersonalizedNewReleases(releases, {
    relatedReleases: [
      {
        kind: 'actor',
        items: [related],
      },
      {
        kind: 'director',
        items: [related],
      },
      {
        kind: 'studio',
        items: [related],
      },
    ],
  })

  assert.deepEqual(
    result.map((item) => item.id),
    [3, 1, 2]
  )

  assert.equal(result.filter((item) => item.id === 3).length, 1)
})

test('studio-only injected titles do not automatically outrank the generic release feed', () => {
  const releases = [release(1), release(2)]

  const result = rankPersonalizedNewReleases(releases, {
    relatedReleases: [
      {
        kind: 'studio',
        items: [release(3)],
      },
    ],
  })

  assert.deepEqual(
    result.map((item) => item.id),
    [1, 2, 3]
  )
})

test('actor and director matches can outrank the generic release baseline', () => {
  const releases = [release(1), release(2)]

  const related = release(3)

  const result = rankPersonalizedNewReleases(releases, {
    relatedReleases: [
      {
        kind: 'actor',
        items: [related],
      },
      {
        kind: 'director',
        items: [related],
      },
    ],
  })

  assert.deepEqual(
    result.map((item) => item.id),
    [3, 1, 2]
  )
})
