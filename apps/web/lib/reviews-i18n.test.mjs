import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

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

for (const locale of ['en', 'pt', 'fr', 'it', 'no']) {
  test(`${locale} has the complete reviews vocabulary`, async () => {
    const url = new URL(`../../../locales/${locale}/translation.json`, import.meta.url)
    const resource = JSON.parse(await readFile(url, 'utf8'))
    for (const key of required) {
      assert.equal(typeof resource.reviews?.[key], 'string', `missing reviews.${key}`)
      assert.notEqual(resource.reviews[key], '')
    }
    assert.equal(typeof resource.reviews?.composer?.placeholder, 'string')
    assert.equal(typeof resource.reviews?.empty?.authenticated, 'string')
    assert.equal(typeof resource.reviews?.empty?.anonymous, 'string')
  })
}
