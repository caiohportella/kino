import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getMediaRowNavigationState,
  getMediaRowScrollDistance,
} from '../../media-row-navigation.ts'

test('media row starts with only next navigation available', () => {
  assert.deepEqual(
    getMediaRowNavigationState({
      clientWidth: 1000,
      scrollLeft: 0,
      scrollWidth: 2200,
    }),
    {
      hasOverflow: true,
      canScrollPrev: false,
      canScrollNext: true,
    }
  )
})

test('media row exposes both directions while between edges', () => {
  assert.deepEqual(
    getMediaRowNavigationState({
      clientWidth: 1000,
      scrollLeft: 500,
      scrollWidth: 2200,
    }),
    {
      hasOverflow: true,
      canScrollPrev: true,
      canScrollNext: true,
    }
  )
})

test('media row hides next navigation at the end', () => {
  assert.deepEqual(
    getMediaRowNavigationState({
      clientWidth: 1000,
      scrollLeft: 1200,
      scrollWidth: 2200,
    }),
    {
      hasOverflow: true,
      canScrollPrev: true,
      canScrollNext: false,
    }
  )
})

test('media row has no navigation when content fits', () => {
  assert.deepEqual(
    getMediaRowNavigationState({
      clientWidth: 1000,
      scrollLeft: 0,
      scrollWidth: 900,
    }),
    {
      hasOverflow: false,
      canScrollPrev: false,
      canScrollNext: false,
    }
  )
})

test('media row arrow advances ninety percent of the viewport', () => {
  assert.equal(getMediaRowScrollDistance(1000), 900)
})
