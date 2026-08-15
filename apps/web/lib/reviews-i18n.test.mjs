import assert from 'node:assert/strict'
import test from 'node:test'
import { readLocale, webLocales } from './test-locale-utils.mjs'

const required = [
  'title',
  'reviewedBy',
  'writeReview',
  'publish',
  'edit',
  'delete',
  'like',
  'unlike',
  'likeCount_one',
  'likeCount_other',
  'reviewCount_one',
  'reviewCount_other',
  'latest',
  'readFull',
  'noReviews',
  'openForTitle',
  'showMore',
  'showAll',
  'publishSuccess',
  'publishFailure',
  'editSuccess',
  'editFailure',
  'deleteSuccess',
  'deleteFailure',
  'likeFailure',
  'fromPeopleYouFollow',
]

for (const locale of webLocales) {
  test(`${locale} has the complete reviews vocabulary`, async () => {
    const resource = await readLocale(locale)

    for (const key of required) {
      assert.equal(typeof resource.reviews?.[key], 'string', `missing reviews.${key}`)

      assert.notEqual(resource.reviews[key], '')
    }

    assert.equal(typeof resource.reviews?.composer?.placeholder, 'string')

    assert.equal(typeof resource.reviews?.empty?.authenticated, 'string')

    assert.equal(typeof resource.reviews?.empty?.anonymous, 'string')
  })
}
