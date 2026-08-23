import assert from 'node:assert/strict'
import test from 'node:test'

import { readStandaloneMode, resolveStandaloneMode } from './use-standalone-mode.ts'

test('display-mode standalone is authoritative', () => {
  assert.equal(resolveStandaloneMode({ matches: true }, false), true)
})

test('iOS navigator.standalone enables standalone mode', () => {
  assert.equal(resolveStandaloneMode({ matches: false }, true), true)
})

test('ordinary browser mode stays false', () => {
  assert.equal(resolveStandaloneMode({ matches: false }, false), false)
})

test('reading standalone mode is safe without browser globals', () => {
  assert.equal(readStandaloneMode(undefined, undefined), false)
})
