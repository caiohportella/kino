import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const cardUrl = new URL(
  '../../../components/discover/discover-collection-card.tsx',
  import.meta.url
)

const exploreUrl = new URL('../../../components/discover/explore-collections.tsx', import.meta.url)

test('collection cards use an emphasized landscape presentation', async () => {
  const source = await readFile(cardUrl, 'utf8')
  const exploreSource = await readFile(exploreUrl, 'utf8')

  assert.match(source, /aspect-video/, 'collection artwork should use a landscape aspect ratio')

  assert.match(
    exploreSource,
    /media-row--collections/,
    'collections should use their own larger MediaRow sizing'
  )
})

test('collection cards keep only the collection name', async () => {
  const source = await readFile(cardUrl, 'utf8')

  assert.doesNotMatch(source, /ChevronRight/, 'collection cards should not display an arrow')

  assert.doesNotMatch(
    source,
    /getDiscoverCollectionDescription/,
    'collection cards should not display their description'
  )
})

test('collection cards use the Kino poster hover language', async () => {
  const source = await readFile(cardUrl, 'utf8')

  assert.match(
    source,
    /bg-kino-accent[\s\S]*group-hover:scale-x-100/,
    'the collection name should gain the Kino green eyebrow on hover'
  )

  assert.match(
    source,
    /group-hover:scale-\[1\.05\]/,
    'collection artwork should gently scale on hover'
  )
})
