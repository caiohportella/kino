import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { createProfileRefreshActions } from './profileRefreshActions.ts'

test('section retries dispatch only their own query', async () => {
  const calls = []
  const actions = createProfileRefreshActions({
    identity: async () => calls.push('identity'),
    relationship: async () => calls.push('relationship'),
    watchedMovies: async () => calls.push('movies'),
    watchedSeries: async () => calls.push('series'),
  })

  await actions.retryWatchedMovies()
  assert.deepEqual(calls, ['movies'])
  calls.length = 0
  await actions.retryWatchedSeries()
  assert.deepEqual(calls, ['series'])
})

test('relationship retry dispatches only the relationship query', async () => {
  const calls = []
  const actions = createProfileRefreshActions({
    identity: async () => calls.push('identity'),
    relationship: async () => calls.push('relationship'),
    watchedMovies: async () => calls.push('movies'),
    watchedSeries: async () => calls.push('series'),
  })

  await actions.retryRelationship()
  assert.deepEqual(calls, ['relationship'])
})

test('pull refresh updates every rendered profile slice', async () => {
  const calls = []
  const actions = createProfileRefreshActions({
    identity: async () => calls.push('identity'),
    relationship: async () => calls.push('relationship'),
    watchedMovies: async () => calls.push('movies'),
    watchedSeries: async () => calls.push('series'),
  })
  await actions.refreshAll()
  assert.deepEqual(new Set(calls), new Set(['identity', 'relationship', 'movies', 'series']))
})

test('useFollowSystem has no independent relationship fetch owner', async () => {
  const source = await readFile(new URL('./useFollowSystem.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /getFollowCounts|checkFollowStatus|loadFollowData/)
  assert.match(source, /profileQueryKeys\.relationship/)
  assert.match(source, /setQueryData/)
  assert.match(source, /invalidateQueries/)
})

test('both screens render counts and status from the profile relationship slice', async () => {
  for (const relativePath of ['../../app/profile/[id].tsx', '../../app/(tabs)/profile.tsx']) {
    const source = await readFile(new URL(relativePath, import.meta.url), 'utf8')
    assert.match(source, /relationship/)
    assert.match(source, /useFollowSystem\([\s\S]*relationship/)
    assert.match(source, /retryWatchedMovies/)
    assert.match(source, /retryWatchedSeries/)
  }
})
