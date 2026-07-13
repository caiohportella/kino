import assert from 'node:assert/strict'
import test from 'node:test'
import { decodeHtmlEntities, socialMetadataText } from './text.ts'

test('decodes single and double encoded metadata text', () => {
  assert.equal(decodeHtmlEntities('A Widow&#x27;s Game'), "A Widow's Game")
  assert.equal(decodeHtmlEntities('A Widow&amp;#x27;s Game'), "A Widow's Game")
})

test('uses entity-free typographic apostrophes in social metadata', () => {
  assert.equal(socialMetadataText('A Widow&amp;#x27;s Game'), 'A Widow’s Game')
})
