import assert from 'node:assert/strict'
import test from 'node:test'
import { hasHorizontalOverflow } from './use-horizontal-overflow.ts'

test('horizontal overflow requires content to exceed the viewport by the epsilon', () => {
  assert.equal(hasHorizontalOverflow({ clientWidth: 600, scrollWidth: 600 }), false)
  assert.equal(hasHorizontalOverflow({ clientWidth: 600, scrollWidth: 600.5 }), false)
  assert.equal(hasHorizontalOverflow({ clientWidth: 600, scrollWidth: 602 }), true)
})
