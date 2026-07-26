import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isShareCancellation,
  normalizeShareUrl,
  shareDestinations,
  supportsFileShare,
  supportsNativeShare,
} from './share-destinations.ts'

const context = {
  title: 'Amélie & friends',
  text: 'Veja “Amélie” no Kino',
  url: 'https://kino.example/title/194-amelie?type=movie',
}

test('share destinations encode non-ASCII text and canonical URLs', () => {
  for (const destination of shareDestinations) {
    const url = destination.buildUrl(context)
    assert.doesNotMatch(url, /\s/)
    assert.ok(url.includes(encodeURIComponent(context.url)))
  }
  assert.match(
    shareDestinations.find((item) => item.id === 'reddit').buildUrl(context),
    /reddit\.com\/submit/
  )
  assert.match(
    shareDestinations.find((item) => item.id === 'x').buildUrl(context),
    /x\.com\/intent\/post/
  )
})

test('normalizes relative routes against the application origin', () => {
  assert.equal(
    normalizeShareUrl('/person/42-agnes-varda', 'https://kino.example'),
    'https://kino.example/person/42-agnes-varda'
  )
})

test('capability detection does not claim unavailable browser features', () => {
  const previousNavigator = globalThis.navigator
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {},
  })
  assert.equal(supportsNativeShare(), false)
  assert.equal(supportsFileShare(), false)
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: previousNavigator,
  })
})

test('recognizes neutral native-share cancellation', () => {
  assert.equal(isShareCancellation(new DOMException('Canceled', 'AbortError')), true)
  assert.equal(isShareCancellation(new Error('Network failed')), false)
})
