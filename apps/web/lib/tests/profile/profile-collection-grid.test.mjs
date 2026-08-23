import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const componentUrl = new URL(
  '../../../components/profile/collections/profile-collection-grid.tsx',
  import.meta.url
)

test('renders a shared responsive poster grid for profile collections', () => {
  assert.equal(existsSync(componentUrl), true, 'ProfileCollectionGrid component should exist')

  const source = readFileSync(componentUrl, 'utf8')

  assert.match(source, /export function ProfileCollectionGrid/)
  assert.match(source, /<Poster/)
  assert.match(source, /<Link/)
  assert.match(source, /titlePath\(/)

  assert.match(source, /grid-cols-2/)
  assert.match(source, /sm:grid-cols-3/)
  assert.match(source, /md:grid-cols-4/)
  assert.match(source, /lg:grid-cols-6/)
  assert.match(source, /xl:grid-cols-8/)
  assert.match(source, /min-\[1500px\]:grid-cols-9/)
  assert.match(source, /min-\[1900px\]:grid-cols-12/)

  assert.match(source, /item\.tmdbId/)
  assert.match(source, /item\.mediaType/)
  assert.match(source, /item\.title/)
  assert.match(source, /item\.posterUrl/)
  assert.match(source, /item\.year/)
})
