import assert from 'node:assert/strict'
import test from 'node:test'
import { isShareCancellation, normalizeShareUrl, shareResource } from './native-share.ts'

test('normalizes relative canonical URLs against the application origin', () => {
  assert.equal(
    normalizeShareUrl('/person/42-agnes-varda', 'https://kino.example'),
    'https://kino.example/person/42-agnes-varda'
  )
})

test('opens native sharing with the canonical URL when available', async () => {
  let shared
  const result = await shareResource(
    {
      canonicalUrl: '/title/194-amelie?type=movie',
      shareText: 'Veja Amélie no Kino',
      title: 'Amélie',
    },
    {
      copy: async () => assert.fail('clipboard fallback should not run'),
      origin: 'https://kino.example',
      share: async (data) => {
        shared = data
      },
    }
  )

  assert.equal(result, 'shared')
  assert.equal(shared.url, 'https://kino.example/title/194-amelie?type=movie')
})

test('copies the canonical URL when native sharing is unavailable', async () => {
  let copied = ''
  const result = await shareResource(
    { canonicalUrl: '/watchlists/public-list', title: 'Public list' },
    {
      copy: async (value) => {
        copied = value
      },
      origin: 'https://kino.example',
    }
  )

  assert.equal(result, 'copied')
  assert.equal(copied, 'https://kino.example/watchlists/public-list')
})

test('treats native share cancellation as a neutral result', async () => {
  const result = await shareResource(
    { canonicalUrl: '/profile', title: 'Profile' },
    {
      copy: async () => assert.fail('clipboard fallback should not run'),
      origin: 'https://kino.example',
      share: async () => {
        throw new DOMException('Canceled', 'AbortError')
      },
    }
  )

  assert.equal(result, 'cancelled')
  assert.equal(isShareCancellation(new Error('Network failed')), false)
})
