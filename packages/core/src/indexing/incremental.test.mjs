import assert from 'node:assert/strict'
import test from 'node:test'
import { decideIndexMutation } from './incremental.ts'

const previous = {
  id: 'movie:238',
  contentHash: 'same-content',
  indexVersion: 1,
}

test('skips an unchanged document with the same identity, hash, and schema version', () => {
  assert.equal(decideIndexMutation(previous, { ...previous }), 'skip')
})

test('upserts a new or changed document', () => {
  assert.equal(decideIndexMutation(undefined, previous), 'upsert')
  assert.equal(
    decideIndexMutation(previous, { ...previous, contentHash: 'changed-content' }),
    'upsert'
  )
  assert.equal(decideIndexMutation(previous, { ...previous, indexVersion: 2 }), 'upsert')
})

test('deletes a previously indexed document when the next document is missing', () => {
  assert.equal(decideIndexMutation(previous, undefined), 'delete')
})
