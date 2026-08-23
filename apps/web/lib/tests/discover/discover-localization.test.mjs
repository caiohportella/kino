import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import extractKinoTranslations from '../../../../../scripts/tolgee-extractor.mjs'
import { DISCOVER_COLLECTIONS } from '../../discover/collections.ts'

const englishUrl = new URL('../../../../../packages/i18n/generated/en-GB.json', import.meta.url)

const discoverLocalizationUrl = new URL('../../discover/discover-localization.ts', import.meta.url)

function readJson(url) {
  return JSON.parse(readFileSync(url, 'utf8'))
}

function readSource(url) {
  return readFileSync(url, 'utf8')
}

function readNestedValue(object, key) {
  return key.split('.').reduce((current, segment) => current?.[segment], object)
}

function collectionTranslationEntries() {
  return DISCOVER_COLLECTIONS.flatMap((collection) => [
    [collection.titleKey, collection.titleDefault],
    [collection.descriptionKey, collection.descriptionDefault],
    ...collection.views.map((view) => [view.titleKey, view.titleDefault]),
  ])
}

test('discover collections own complete localization metadata', () => {
  const keys = []

  for (const collection of DISCOVER_COLLECTIONS) {
    assert.match(collection.titleKey, /^discover\.collections\./)
    assert.match(collection.descriptionKey, /^discover\.collections\./)

    assert.ok(collection.titleDefault.length > 0)
    assert.ok(collection.descriptionDefault.length > 0)

    keys.push(collection.titleKey, collection.descriptionKey)

    for (const view of collection.views) {
      assert.match(view.titleKey, /^discover\.collections\./)
      assert.ok(view.titleDefault.length > 0)

      keys.push(view.titleKey)
    }
  }

  assert.equal(
    new Set(keys).size,
    keys.length,
    'Discover collection translation keys must be unique'
  )
})

test('removed semantic collection localization keys are no longer registered', () => {
  const keys = new Set(
    DISCOVER_COLLECTIONS.flatMap((collection) => [
      collection.titleKey,
      collection.descriptionKey,
      ...collection.views.map((view) => view.titleKey),
    ])
  )

  const removedKeys = [
    'discover.collections.hiddenGems.title',
    'discover.collections.hiddenGems.description',
    'discover.collections.quickWatch.title',
    'discover.collections.quickWatch.description',
    'discover.collections.ninetiesEssentials.title',
    'discover.collections.ninetiesEssentials.description',
    'discover.collections.modernClassics.title',
    'discover.collections.modernClassics.description',
    'discover.collections.criticallyAcclaimed.title',
    'discover.collections.criticallyAcclaimed.description',
    'discover.collections.somethingWeird.title',
    'discover.collections.somethingWeird.description',
    'discover.collections.newThisMonth.title',
    'discover.collections.newThisMonth.description',
  ]

  for (const key of removedKeys) {
    assert.equal(keys.has(key), false, `Expected ${key} to be removed`)
  }
})

test('discover shared localization defaults remain extractable by Tolgee', () => {
  const extracted = extractKinoTranslations(readSource(discoverLocalizationUrl)).keys

  const defaults = Object.fromEntries(
    extracted.map(({ keyName, defaultValue }) => [keyName, defaultValue])
  )

  assert.equal(defaults['discover.collections.heading'], 'Explore collections')

  assert.equal(
    defaults['discover.collections.subtitle'],
    'Explore iconic franchises, sagas and cinematic universes.'
  )

  assert.equal(defaults['discover.collections.active'], 'Collection')

  assert.equal(defaults['discover.collections.open'], 'Open collection')

  assert.equal(defaults['discover.collections.clear'], 'Clear collection')
})

test('generated English catalog contains every collection title description and view label', () => {
  const english = readJson(englishUrl)

  for (const [key, expected] of collectionTranslationEntries()) {
    assert.equal(readNestedValue(english, key), expected, `Expected ${key} to equal ${expected}`)
  }
})

test('generated English catalog contains current shared collection copy', () => {
  const english = readJson(englishUrl)

  const expectedDefaults = {
    'discover.collections.heading': 'Explore collections',
    'discover.collections.subtitle': 'Explore iconic franchises, sagas and cinematic universes.',
    'discover.collections.active': 'Collection',
    'discover.collections.open': 'Open collection',
    'discover.collections.clear': 'Clear collection',
  }

  for (const [key, value] of Object.entries(expectedDefaults)) {
    assert.equal(readNestedValue(english, key), value, `Expected ${key} to equal ${value}`)
  }
})
