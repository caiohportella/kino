import assert from 'node:assert/strict'
import test from 'node:test'
import { getPluralTranslationKey } from './i18n-plural.ts'

for (const language of ['en', 'fr', 'it', 'no', 'pt']) {
  test(`${language} watchlist counts resolve singular and plural keys`, () => {
    assert.equal(
      getPluralTranslationKey(language, 'watchlists.watchlistCount', 1),
      'watchlists.watchlistCount_one'
    )
    assert.equal(
      getPluralTranslationKey(language, 'watchlists.watchlistCount', 12),
      'watchlists.watchlistCount_other'
    )
  })
}

test('zero uses the locale plural rules instead of returning the base key', () => {
  assert.equal(
    getPluralTranslationKey('en', 'watchlists.watchlistCount', 0),
    'watchlists.watchlistCount_other'
  )
})
