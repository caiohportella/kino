import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

async function readLocale(locale) {
  const url = new URL(`../../../locales/${locale}/translation.json`, import.meta.url)
  return JSON.parse(await readFile(url, 'utf8'))
}

function interpolationTokens(value) {
  return [...value.matchAll(/{{\s*([^}\s]+)\s*}}/g)].map((match) => match[1]).sort()
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

  assert.equal(portuguese.reviews.likeCount_one, '{{count}} curtidas')
  for (const key of ['likeCount_one', 'likeCount_other']) {
    assert.deepEqual(
      interpolationTokens(portuguese.reviews[key]),
      interpolationTokens(english.reviews[key]),
      `reviews.${key} interpolation tokens differ`
    )
  }
})
