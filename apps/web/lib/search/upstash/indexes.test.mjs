import assert from 'node:assert/strict'
import test from 'node:test'

import {
  LEGACY_SEARCH_INDEX_NAMES,
  PERSON_KEY_PREFIX,
  SEARCH_INDEX_NAME,
  SEARCH_KEY_PREFIXES,
  setupRedisSearchIndexes,
  TITLE_KEY_PREFIX,
  USER_KEY_PREFIX,
} from './indexes.ts'

test('exports one unified Redis Search index and exact key prefixes', () => {
  assert.equal(SEARCH_INDEX_NAME, 'kino-search')
  assert.deepEqual(LEGACY_SEARCH_INDEX_NAMES, ['kino-titles', 'kino-people', 'kino-users'])
  assert.deepEqual(SEARCH_KEY_PREFIXES, [
    'kino:search:title:',
    'kino:search:person:',
    'kino:search:user:',
  ])
  assert.equal(TITLE_KEY_PREFIX, 'kino:search:title:')
  assert.equal(PERSON_KEY_PREFIX, 'kino:search:person:')
  assert.equal(USER_KEY_PREFIX, 'kino:search:user:')
})

test('sets up one JSON index with all prefixes and existsOk', async () => {
  const calls = []
  const redis = {
    search: {
      createIndex: async (config) => {
        calls.push(config)
      },
    },
    exec: async () => [],
  }

  await setupRedisSearchIndexes(redis)

  assert.deepEqual(
    calls.map(({ name, dataType, prefix, existsOk }) => ({ name, dataType, prefix, existsOk })),
    [{ name: 'kino-search', dataType: 'json', prefix: SEARCH_KEY_PREFIXES, existsOk: true }]
  )
  assert.ok(calls.every((call) => call.schema && typeof call.schema === 'object'))
})

test('removes only known legacy indexes before creating the unified index', async () => {
  const dropped = []
  const calls = []
  const redis = {
    search: {
      createIndex: async (config) => calls.push(config),
      index: ({ name }) => ({ drop: async () => dropped.push(name) }),
    },
    exec: async (args) => {
      assert.deepEqual(args, ['SEARCH.LISTINDEXES'])
      return [
        ['name', 'kino-titles', 'type', 'JSON'],
        ['name', 'kino-search', 'type', 'JSON'],
        ['name', 'unrelated-index', 'type', 'JSON'],
        ['name', 'kino-people', 'type', 'JSON'],
        ['name', 'kino-users', 'type', 'JSON'],
      ]
    },
  }

  await setupRedisSearchIndexes(redis)

  assert.deepEqual(dropped, ['kino-titles', 'kino-people', 'kino-users'])
  assert.equal(calls.length, 1)
  assert.equal(calls[0].name, 'kino-search')
})

test('does not drop the unified index when setup is rerun on the correct database', async () => {
  const dropped = []
  const redis = {
    search: {
      createIndex: async () => undefined,
      index: ({ name }) => ({ drop: async () => dropped.push(name) }),
    },
    exec: async () => [['name', 'kino-search', 'type', 'JSON']],
  }

  await setupRedisSearchIndexes(redis)

  assert.deepEqual(dropped, [])
})
