import assert from 'node:assert/strict'
import test from 'node:test'

import { createPersonIndexer } from './person-indexer.ts'
import {
  createTitleIndexer,
  titleDocumentFromSearchEntity,
  titleDocumentsFromSearchResponse,
} from './title-indexer.ts'
import { createUserIndexer } from './user-indexer.ts'

function fakeRedis() {
  const writes = []
  const deletes = []
  const pipelines = []
  const redis = {
    json: {
      set: async (key, path, value) => {
        writes.push({ key, path, value })
        return 'OK'
      },
    },
    del: async (key) => {
      deletes.push(key)
      return 1
    },
    pipeline() {
      const commands = []
      pipelines.push(commands)
      return {
        json: {
          set(key, path, value) {
            commands.push({ key, path, value })
            return this
          },
        },
        async exec() {
          writes.push(...commands)
          return commands.map(() => 'OK')
        },
      }
    },
    search: { index: () => ({}) },
  }
  return { redis, writes, deletes, pipelines }
}

test('title indexer writes stable JSON keys in batches and deletes by media identity', async () => {
  const fake = fakeRedis()
  const indexer = createTitleIndexer({ client: fake.redis, batchSize: 2 })
  await indexer.upsertDocument([
    {
      id: 'title:movie:1',
      entityType: 'movie',
      mediaType: 'movie',
      tmdbId: 1,
      title: 'One',
      originalTitle: 'One',
      aliases: '',
      localizedTitles: {},
      overview: '',
    },
    {
      id: 'title:movie:2',
      entityType: 'movie',
      mediaType: 'movie',
      tmdbId: 2,
      title: 'Two',
      originalTitle: 'Two',
      aliases: '',
      localizedTitles: {},
      overview: '',
    },
    {
      id: 'title:series:3',
      entityType: 'series',
      mediaType: 'series',
      tmdbId: 3,
      title: 'Three',
      originalTitle: 'Three',
      aliases: '',
      localizedTitles: {},
      overview: '',
    },
  ])
  await indexer.deleteTitle('tv', 3)

  assert.deepEqual(
    fake.pipelines.map((batch) => batch.length),
    [2, 1]
  )
  assert.deepEqual(
    fake.writes.map((write) => write.key),
    ['kino:search:title:movie:1', 'kino:search:title:movie:2', 'kino:search:title:series:3']
  )
  assert.deepEqual(
    fake.writes.map((write) => write.path),
    ['$', '$', '$']
  )
  assert.deepEqual(fake.deletes, ['kino:search:title:series:3'])
})

test('title indexer preserves audience metrics through direct and lazy title write paths', async () => {
  const fake = fakeRedis()
  const indexer = createTitleIndexer({ client: fake.redis })
  await indexer.upsert({
    tmdbId: 7,
    type: 'movie',
    title: 'Dune',
    popularity: 455.2,
    voteAverage: 8.4,
    voteCount: 30012,
  })

  assert.deepEqual(fake.writes[0]?.value, {
    id: 'title:movie:7',
    entityType: 'movie',
    mediaType: 'movie',
    tmdbId: 7,
    title: 'Dune',
    originalTitle: 'Dune',
    aliases: '',
    localizedTitles: {},
    overview: '',
    popularity: 455.2,
    voteAverage: 8.4,
    voteCount: 30012,
  })

  const lazyDocument = titleDocumentFromSearchEntity({
    id: 'title:movie:8',
    entityType: 'movie',
    title: 'Arrival',
    tmdbId: 8,
    summary: 'First contact changes everything.',
    year: 2016,
    popularity: 220.3,
    voteCount: 18123,
    tmdbVoteAverage: 7.9,
  })
  assert.equal(lazyDocument?.voteAverage, 7.9)

  const lazyDocuments = titleDocumentsFromSearchResponse({
    sourceId: 'tmdb',
    candidates: [
      {
        source: 'lexical',
        lexicalScore: 1,
        exactMatch: true,
        entity: {
          id: 'title:movie:9',
          entityType: 'movie',
          title: 'Blade Runner 2049',
          tmdbId: 9,
          popularity: 512.7,
          voteCount: 20567,
          tmdbVoteAverage: 8,
        },
      },
    ],
  })
  assert.deepEqual(lazyDocuments, [
    {
      id: 'title:movie:9',
      entityType: 'movie',
      mediaType: 'movie',
      tmdbId: 9,
      title: 'Blade Runner 2049',
      originalTitle: 'Blade Runner 2049',
      aliases: '',
      localizedTitles: {},
      overview: '',
      popularity: 512.7,
      voteAverage: 8,
      voteCount: 20567,
    },
  ])
})

test('person and user indexers use their dedicated prefixes and reject failed explicit writes', async () => {
  const fake = fakeRedis()
  const person = createPersonIndexer({ client: fake.redis })
  const user = createUserIndexer({ client: fake.redis })
  await person.upsertDocument({
    id: 'person:7',
    entityType: 'person',
    tmdbId: 7,
    name: 'Seven',
    aliases: '',
  })
  await user.upsertDocument({
    id: 'user:abc',
    entityType: 'user',
    userId: 'abc',
    username: 'abc',
    displayName: '',
    firstName: '',
    lastName: '',
    bio: '',
    popularity: 0,
  })
  await person.deletePerson(7)
  await user.deleteUser('abc')

  assert.deepEqual(
    fake.writes.map((write) => write.key),
    ['kino:search:person:7', 'kino:search:user:abc']
  )
  assert.deepEqual(fake.deletes, ['kino:search:person:7', 'kino:search:user:abc'])

  const failing = fakeRedis()
  failing.redis.pipeline = () => ({
    json: {
      set() {
        return this
      },
    },
    async exec() {
      throw new Error('index unavailable')
    },
  })
  await assert.rejects(
    () =>
      createUserIndexer({ client: failing.redis }).upsertDocument({
        id: 'user:x',
        entityType: 'user',
        userId: 'x',
        username: 'x',
        displayName: '',
        firstName: '',
        lastName: '',
        bio: '',
        popularity: 0,
      }),
    /index unavailable/
  )
})
