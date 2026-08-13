import assert from 'node:assert/strict'
import test from 'node:test'

import { createRedisTitleSearchProvider } from './title-search-provider.ts'

function fakeIndex(dataByEntityType) {
  const calls = []
  return {
    calls,
    index: {
      async query(options) {
        calls.push(options)
        const serialized = JSON.stringify(options.filter)
        const data = serialized.includes('person')
          ? (dataByEntityType.person ?? [])
          : (dataByEntityType.title ?? [])
        return data.map((value, index) => ({
          key: value.key ?? `key:${index}`,
          score: value.score ?? 0.8,
          data: value.data,
        }))
      },
    },
  }
}

test('queries titles and people in parallel and returns Kino lexical/person candidates', async () => {
  const searchIndex = fakeIndex({
    title: [
      {
        data: {
          id: 'title:movie:238',
          entityType: 'movie',
          mediaType: 'movie',
          tmdbId: 238,
          title: 'The Godfather',
          originalTitle: 'The Godfather',
          aliases: '',
          localizedTitles: {},
          overview: '',
          popularity: 100,
        },
      },
    ],
    person: [
      {
        data: {
          id: 'person:238',
          entityType: 'person',
          tmdbId: 238,
          name: 'Francis Ford Coppola',
          aliases: 'godf',
          popularity: 40,
        },
      },
    ],
  })
  const provider = createRedisTitleSearchProvider({
    searchIndex: searchIndex.index,
  })
  const result = await provider.search({ query: 'godf', topK: 8, locale: 'en-GB' })

  assert.equal(result.sourceId, 'redis-search')
  assert.ok(result.candidates.some((candidate) => candidate.source === 'lexical'))
  assert.ok(result.candidates.some((candidate) => candidate.source === 'person'))
  assert.equal(searchIndex.calls.length, 2)
})

test('keeps movie and series identities separate when numeric TMDb IDs match', async () => {
  const searchIndex = fakeIndex({
    title: [
      {
        data: {
          id: 'title:movie:238',
          entityType: 'movie',
          mediaType: 'movie',
          tmdbId: 238,
          title: 'The Godfather',
          originalTitle: 'The Godfather',
          aliases: '',
          localizedTitles: {},
          overview: '',
        },
      },
      {
        data: {
          id: 'title:series:238',
          entityType: 'series',
          mediaType: 'series',
          tmdbId: 238,
          title: 'Godfather',
          originalTitle: 'Godfather',
          aliases: '',
          localizedTitles: {},
          overview: '',
        },
      },
    ],
    person: [],
  })
  const result = await createRedisTitleSearchProvider({
    searchIndex: searchIndex.index,
  }).search({ query: 'godfather', topK: 8 })
  const ids = result.candidates.map((candidate) => candidate.entity.id)
  assert.ok(ids.includes('title:movie:238'))
  assert.ok(ids.includes('title:series:238'))
})
