import assert from 'node:assert/strict'
import { test } from 'node:test'

test('the package root resolves in Node stripped-TypeScript mode', async () => {
  const core = await import('@kino/core')

  assert.equal(typeof core.reduceAuthResolution, 'function')
  assert.equal(typeof core.buildSearchIndexDocumentV1, 'function')
  assert.equal(typeof core.runSearchPipelineV1, 'function')
})
