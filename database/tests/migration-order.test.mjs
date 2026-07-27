import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migrationUrl = new URL(
  '../migrations/2026-07-27-add-reviews-and-halfstar-ratings.sql',
  import.meta.url
)

test('normalizes legacy tenth-star title ratings before adding the half-step constraint', async () => {
  const sql = await readFile(migrationUrl, 'utf8')
  const normalization = sql.indexOf('UPDATE public.title_ratings')
  const constraint = sql.indexOf('ADD CONSTRAINT title_ratings_rating_range_step_check')

  assert.notEqual(normalization, -1, 'missing title rating normalization')
  assert.ok(normalization < constraint, 'title ratings must be normalized before validation')
})

test('normalizes legacy tenth-star episode ratings before adding the half-step constraint', async () => {
  const sql = await readFile(migrationUrl, 'utf8')
  const normalization = sql.indexOf('UPDATE public.episode_ratings')
  const constraint = sql.indexOf('ADD CONSTRAINT episode_ratings_rating_range_step_check')

  assert.notEqual(normalization, -1, 'missing episode rating normalization')
  assert.ok(normalization < constraint, 'episode ratings must be normalized before validation')
})
