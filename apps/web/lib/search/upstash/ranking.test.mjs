import assert from 'node:assert/strict'
import test from 'node:test'

import { scoreTitleSearchHit, scoreUserSearchHit } from './ranking.ts'

function titleHit(overrides = {}) {
  return {
    id: 'title:tv:60059',
    score: 0.82,
    metadata: {
      entityType: 'title',
      tmdbId: 60059,
      mediaType: 'tv',
      year: 2015,
      popularity: 320,
      voteAverage: 8.7,
      voteCount: 6000,
      posterPath: '/poster.jpg',
      backdropPath: '/backdrop.jpg',
      locale: 'en-US',
      ...overrides.metadata,
    },
    content: {
      name: 'Better Call Saul',
      originalName: 'Better Call Saul',
      overview: 'A lawyer finds himself in a maze of trouble.',
      aliases: 'Slippin Jimmy | Better Call Saul',
      genres: 'Crime Drama',
      cast: 'Bob Odenkirk Rhea Seehorn Jonathan Banks',
      creators: 'Vince Gilligan Peter Gould',
      directors: '',
      keywords: 'lawyer crime',
      ...overrides.content,
    },
  }
}

function userHit(overrides = {}) {
  return {
    id: 'user:alice',
    score: 0.64,
    metadata: {
      entityType: 'user',
      userId: 'alice',
      username: 'alice',
      avatarUrl: null,
      ...overrides.metadata,
    },
    content: {
      username: 'alice',
      name: 'Alice Example',
      bio: 'Movies, TV, and sci-fi.',
      ...overrides.content,
    },
  }
}

test('exact title match beats a weak semantic match', () => {
  const exact = scoreTitleSearchHit({
    query: 'better call saul',
    hit: titleHit(),
    source: 'upstash',
  })
  const weak = scoreTitleSearchHit({
    query: 'better',
    hit: titleHit({
      content: {
        name: 'Better Things',
        originalName: 'Better Things',
        overview: 'A different series.',
        aliases: 'Better Things',
      },
      metadata: { tmdbId: 12345, popularity: 30, voteCount: 100 },
    }),
    source: 'upstash',
  })

  assert.ok(exact)
  assert.ok(weak)
  assert.equal(exact.exactMatch, true)
  assert.equal(exact.finalScore > weak.finalScore, true)
})

test('prefix title matches receive a meaningful boost', () => {
  const prefix = scoreTitleSearchHit({ query: 'better call', hit: titleHit(), source: 'upstash' })
  const nonPrefix = scoreTitleSearchHit({
    query: 'call better',
    hit: titleHit({ content: { name: 'Better Call Saul' } }),
    source: 'upstash',
  })

  assert.ok(prefix)
  assert.ok(nonPrefix)
  assert.equal(prefix.prefixMatch, true)
  assert.equal(prefix.finalScore > nonPrefix.finalScore, true)
})

test('popularity can lift a dominant title above an obscure literal-ish match', () => {
  const dominant = scoreTitleSearchHit({
    query: 'superman',
    hit: titleHit({
      content: { name: 'Superman', originalName: 'Superman' },
      metadata: { tmdbId: 111, popularity: 900, voteCount: 15000 },
    }),
    source: 'upstash',
  })
  const obscure = scoreTitleSearchHit({
    query: 'superman',
    hit: titleHit({
      content: { name: 'The Superman', originalName: 'The Superman' },
      metadata: { tmdbId: 999, popularity: 2, voteCount: 2 },
    }),
    source: 'upstash',
  })

  assert.ok(dominant)
  assert.ok(obscure)
  assert.equal(dominant.finalScore > obscure.finalScore, true)
})

test('tv documents normalize to Kino series entities', () => {
  const result = scoreTitleSearchHit({
    query: 'better call saul',
    hit: titleHit(),
    source: 'upstash',
  })
  assert.ok(result)
  assert.equal(result.entity.entityType, 'series')
  assert.equal(result.entity.id, 'title:series:60059')
  assert.equal(result.entity.tmdbVoteAverage, 8.7)
})

test('exact usernames outrank semantic profile matches', () => {
  const exact = scoreUserSearchHit({ query: '@alice', hit: userHit(), source: 'upstash' })
  const semantic = scoreUserSearchHit({
    query: 'alice',
    hit: userHit({
      content: { username: 'not-alice', name: 'Alice Example', bio: 'A person who likes movies.' },
      metadata: { username: 'not-alice', userId: 'bob' },
    }),
    source: 'upstash',
  })

  assert.ok(exact)
  assert.ok(semantic)
  assert.equal(exact.exactMatch, true)
  assert.equal(exact.finalScore > semantic.finalScore, true)
})
