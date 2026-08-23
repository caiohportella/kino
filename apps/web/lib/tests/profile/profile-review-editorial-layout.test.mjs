import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const reviewCardUrl = new URL('../../../components/reviews/review-card.tsx', import.meta.url)

const carouselUrl = new URL('../../../components/reviews/reviews-carousel.tsx', import.meta.url)

test('profile reviews use editorial presentation instead of card chrome', async () => {
  const source = await readFile(reviewCardUrl, 'utf8')

  const start = source.indexOf('function ProfileReviewLayout')
  const end = source.indexOf('function ExpandableReviewContent')

  assert.notEqual(start, -1)
  assert.notEqual(end, -1)

  const profileLayout = source.slice(start, end)

  assert.doesNotMatch(
    profileLayout,
    /h-63/,
    'profile reviews should not have the old fixed card height'
  )

  assert.doesNotMatch(
    profileLayout,
    /bg-kino-surface/,
    'profile reviews should not render their own card surface'
  )

  assert.doesNotMatch(
    profileLayout,
    /rounded-md border border-white\/10/,
    'profile reviews should not use the old bordered card shell'
  )

  assert.match(
    profileLayout,
    /formatLocalizedRecentDate/,
    'profile reviews should share the title-page recent-date behavior'
  )
})

test('profile review carousel exposes wider editorial slides', async () => {
  const source = await readFile(carouselUrl, 'utf8')

  assert.match(
    source,
    /basis-\[92%\]/,
    'mobile should show nearly one review plus a hint of the next'
  )

  assert.match(
    source,
    /md:basis-\[68%\]/,
    'medium layouts should expose roughly one and a half reviews'
  )

  assert.match(source, /xl:basis-\[54%\]/, 'desktop should expose almost two reviews')

  assert.doesNotMatch(
    source,
    /md:basis-1\/2/,
    'profile reviews should no longer use the old two-card grid sizing'
  )

  assert.doesNotMatch(
    source,
    /min-\[1900px\]:basis-1\/3/,
    'large screens should no longer shrink reviews into three cards'
  )
})

const profileReviewSkeletonUrl = new URL(
  '../../../components/reviews/profile-review-skeleton.tsx',
  import.meta.url
)

test('profile review skeleton matches the editorial layout', async () => {
  const source = await readFile(profileReviewSkeletonUrl, 'utf8')

  assert.doesNotMatch(source, /bg-kino-surface/)
  assert.doesNotMatch(
    source,
    /rounded-md border border-white\/10/,
    'the loading state should not restore the old card chrome'
  )

  assert.match(
    source,
    /grid-cols-\[68px_minmax\(0,1fr\)\]/,
    'the skeleton should preserve the poster-left editorial layout'
  )

  assert.match(
    source,
    /border-r border-white\/10/,
    'the skeleton should use the same slide separator as loaded reviews'
  )
})
