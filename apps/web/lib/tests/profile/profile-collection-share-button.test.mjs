import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const componentUrl = new URL(
  '../../../components/profile/collections/profile-collection-share-button.tsx',
  import.meta.url
)

test('shares the exact profile collection URL including active filters', () => {
  assert.equal(
    existsSync(componentUrl),
    true,
    'ProfileCollectionShareButton component should exist'
  )

  const source = readFileSync(componentUrl, 'utf8')

  assert.match(source, /export function ProfileCollectionShareButton/)
  assert.match(source, /usePathname/)
  assert.match(source, /useSearchParams/)
  assert.match(source, /searchParams\.toString\(\)/)
  assert.match(source, /<ShareButton/)
  assert.match(source, /url=/)

  assert.doesNotMatch(source, /navigator\.share/)
  assert.doesNotMatch(source, /navigator\.clipboard/)
})
