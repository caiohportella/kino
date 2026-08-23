import assert from 'node:assert/strict'
import test from 'node:test'
import { readLocale } from '../../test-locale-utils.mjs'

function interpolationTokens(value) {
  return [...value.matchAll(/{{\s*(\w+)(?:\s*,\s*number)?\s*}}/g)].map((match) => match[1]).sort()
}

test('English and Portuguese provide the profile slice status vocabulary', async () => {
  const [english, portuguese] = await Promise.all([readLocale('en'), readLocale('pt')])
  const keys = ['failed', 'loading', 'retry', 'tryAgain']

  for (const key of keys) {
    assert.equal(typeof english.common?.[key], 'string', `missing English common.${key}`)
    assert.notEqual(english.common[key], '')
    assert.equal(typeof portuguese.common?.[key], 'string', `missing Portuguese common.${key}`)
    assert.notEqual(portuguese.common[key], '')
  }
})

test('Portuguese like-count regression keeps locale parity and interpolation tokens', async () => {
  const [english, portuguese] = await Promise.all([readLocale('en'), readLocale('pt')])

  assert.match(portuguese.reviews.likeCount_one, /^{{\s*count(?:\s*,\s*number)?\s*}} curtida$/)

  assert.match(portuguese.reviews.likeCount_other, /^{{\s*count(?:\s*,\s*number)?\s*}} curtidas$/)
  for (const key of ['likeCount_one', 'likeCount_other']) {
    assert.deepEqual(
      interpolationTokens(portuguese.reviews[key]),
      interpolationTokens(english.reviews[key]),
      `reviews.${key} interpolation tokens differ`
    )
  }
})
