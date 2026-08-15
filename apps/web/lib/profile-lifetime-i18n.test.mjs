import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const sourceFiles = [
  '../components/profile/profile-stats-page.tsx',
  '../components/profile/profile-stat-summary-card.tsx',
  '../components/profile/profile-activity-heatmap.tsx',
  '../components/profile/profile-rating-stats-card.tsx',
  '../components/profile/profile-watching-habits-card.tsx',
]
const lifetimeLocales = ['en', 'pt', 'fr', 'it', 'no']
const localeFiles = {
  en: '../../../locales/en/translation.json',
  pt: '../../../locales/pt/translation.json',
  fr: '../../../locales/fr/translation.json',
  it: '../../../locales/it/translation.json',
  no: '../../../locales/no/translation.json',
}

function readPath(resource, key) {
  if (typeof key !== 'string') return undefined

  return key.split('.').reduce((value, part) => value?.[part], resource)
}

async function readLocale(locale) {
  const file = localeFiles[locale]

  if (!file) {
    throw new Error(`Unsupported lifetime locale: ${locale}`)
  }

  return JSON.parse(await readFile(new URL(file, import.meta.url), 'utf8'))
}

function hasTranslation(resource, key) {
  if (typeof readPath(resource, key) === 'string') {
    return true
  }

  const one = readPath(resource, `${key}_one`)
  const other = readPath(resource, `${key}_other`)

  return typeof one === 'string' && typeof other === 'string'
}

test('every Lifetime Statistics translation call resolves in every supported locale', async () => {
  const sources = await Promise.all(
    sourceFiles.map((file) => readFile(new URL(file, import.meta.url), 'utf8'))
  )

  const keys = new Set()

  for (const source of sources) {
    for (const match of source.matchAll(/\bt\(\s*["']((?:stats|common)\.[^"']+)["']/g)) {
      keys.add(match[1])
    }
  }

  for (const locale of lifetimeLocales) {
    const resource = await readLocale(locale)

    for (const key of keys) {
      assert.equal(
        hasTranslation(resource, key),
        true,
        `${locale} is missing a translation for ${key}`
      )
    }
  }
})

test('new Lifetime Statistics count labels use plural keys in every locale', async () => {
  for (const locale of lifetimeLocales) {
    const stats = (await readLocale(locale)).stats

    for (const key of [
      'ratingsCount_one',
      'ratingsCount_other',
      'rewatchCount_one',
      'rewatchCount_other',
    ]) {
      assert.equal(typeof stats[key], 'string', `${locale} is missing stats.${key}`)
    }
  }
})

test('Lifetime Statistics adds localized concepts required by the updated mockup', async () => {
  const required = [
    'averageRatingForSeries',
    'averageRatingForMovies',
    'vsRatingForMovies',
    'mostRatedGenre',
    'weekdays',
    'weekends',
    'count',
    'percentage',
    'highestRatedDecade',
    'highestRatedStudio',
    'highestRatedActor',
    'highestRatedActress',
  ]
  const requiredStoryKeys = [
    'sinceBeginning',
    'lifetimeHeadline',
    'kinoTime',
    'memberSince',
    'kinoTimeDays_one',
    'kinoTimeDays_other',
    'kinoTimeMonths_one',
    'kinoTimeMonths_other',
    'kinoTimeYears_one',
    'kinoTimeYears_other',
  ]

  for (const locale of lifetimeLocales) {
    const resource = await readLocale(locale)

    for (const key of required) {
      assert.equal(typeof resource.stats[key], 'string', `${locale} is missing stats.${key}`)
    }

    for (const key of requiredStoryKeys) {
      assert.equal(
        typeof resource.stats.story[key],
        'string',
        `${locale} is missing stats.story.${key}`
      )
    }

    assert.equal(typeof resource.common.series, 'string', `${locale} is missing common.series`)
  }
})
