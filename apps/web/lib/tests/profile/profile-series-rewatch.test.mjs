import assert from 'node:assert/strict'
import test from 'node:test'
import { deriveCompleteSeriesWatchPasses } from '../../profile/profile-series-rewatch.ts'

const requiredEpisodes = [
  { seasonNumber: 1, episodeNumber: 1 },
  { seasonNumber: 1, episodeNumber: 2 },
  { seasonNumber: 2, episodeNumber: 1 },
]

const watch = (seasonNumber, episodeNumber, watchedAt) => ({
  seasonNumber,
  episodeNumber,
  watchedAt,
})

test('does not create a rewatch pass when only one episode is repeated', () => {
  const passes = deriveCompleteSeriesWatchPasses(requiredEpisodes, [
    watch(1, 1, '2025-01-01T12:00:00.000Z'),
    watch(1, 2, '2025-01-02T12:00:00.000Z'),
    watch(2, 1, '2025-01-03T12:00:00.000Z'),
    watch(1, 1, '2026-01-01T12:00:00.000Z'),
  ])

  assert.equal(passes.length, 1)
})

test('does not create a rewatch pass when only one season is repeated', () => {
  const passes = deriveCompleteSeriesWatchPasses(requiredEpisodes, [
    watch(1, 1, '2025-01-01T12:00:00.000Z'),
    watch(1, 2, '2025-01-02T12:00:00.000Z'),
    watch(2, 1, '2025-01-03T12:00:00.000Z'),
    watch(1, 1, '2026-01-01T12:00:00.000Z'),
    watch(1, 2, '2026-01-02T12:00:00.000Z'),
  ])

  assert.equal(passes.length, 1)
})

test('creates a second pass only after every required episode is watched twice', () => {
  const passes = deriveCompleteSeriesWatchPasses(requiredEpisodes, [
    watch(1, 1, '2025-01-01T12:00:00.000Z'),
    watch(1, 2, '2025-01-02T12:00:00.000Z'),
    watch(2, 1, '2025-01-03T12:00:00.000Z'),

    watch(1, 1, '2026-02-01T12:00:00.000Z'),
    watch(1, 2, '2026-02-02T12:00:00.000Z'),
    watch(2, 1, '2026-02-03T12:00:00.000Z'),
  ])

  assert.deepEqual(passes, [
    {
      passNumber: 1,
      completedAt: '2025-01-03T12:00:00.000Z',
    },
    {
      passNumber: 2,
      completedAt: '2026-02-03T12:00:00.000Z',
    },
  ])
})

test('derives three complete passes from three occurrences of every episode', () => {
  const passes = deriveCompleteSeriesWatchPasses(requiredEpisodes, [
    watch(1, 1, '2024-01-01T12:00:00.000Z'),
    watch(1, 2, '2024-01-02T12:00:00.000Z'),
    watch(2, 1, '2024-01-03T12:00:00.000Z'),

    watch(1, 1, '2025-01-01T12:00:00.000Z'),
    watch(1, 2, '2025-01-02T12:00:00.000Z'),
    watch(2, 1, '2025-01-03T12:00:00.000Z'),

    watch(1, 1, '2026-01-01T12:00:00.000Z'),
    watch(1, 2, '2026-01-02T12:00:00.000Z'),
    watch(2, 1, '2026-01-03T12:00:00.000Z'),
  ])

  assert.equal(passes.length, 3)
  assert.deepEqual(
    passes.map((pass) => pass.completedAt),
    ['2024-01-03T12:00:00.000Z', '2025-01-03T12:00:00.000Z', '2026-01-03T12:00:00.000Z']
  )
})

test('derives passes deterministically when episodes are watched out of order', () => {
  const passes = deriveCompleteSeriesWatchPasses(requiredEpisodes, [
    watch(2, 1, '2025-01-03T12:00:00.000Z'),
    watch(1, 1, '2025-01-01T12:00:00.000Z'),
    watch(1, 2, '2025-01-02T12:00:00.000Z'),

    watch(1, 2, '2026-01-03T12:00:00.000Z'),
    watch(2, 1, '2026-01-01T12:00:00.000Z'),
    watch(1, 1, '2026-01-02T12:00:00.000Z'),
  ])

  assert.deepEqual(passes, [
    {
      passNumber: 1,
      completedAt: '2025-01-03T12:00:00.000Z',
    },
    {
      passNumber: 2,
      completedAt: '2026-01-03T12:00:00.000Z',
    },
  ])
})

test('does not count an incomplete required episode set as a complete pass', () => {
  const passes = deriveCompleteSeriesWatchPasses(requiredEpisodes, [
    watch(1, 1, '2025-01-01T12:00:00.000Z'),
    watch(1, 2, '2025-01-02T12:00:00.000Z'),
  ])

  assert.deepEqual(passes, [])
})

test('ignores season zero when determining complete-series passes', () => {
  const requiredWithSpecial = [...requiredEpisodes, { seasonNumber: 0, episodeNumber: 1 }]

  const passes = deriveCompleteSeriesWatchPasses(requiredWithSpecial, [
    watch(1, 1, '2025-01-01T12:00:00.000Z'),
    watch(1, 2, '2025-01-02T12:00:00.000Z'),
    watch(2, 1, '2025-01-03T12:00:00.000Z'),
  ])

  assert.deepEqual(passes, [
    {
      passNumber: 1,
      completedAt: '2025-01-03T12:00:00.000Z',
    },
  ])
})
