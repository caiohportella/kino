import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const englishUrl = new URL('../../../../../packages/i18n/generated/en-GB.json', import.meta.url)

test('provides English copy for public profile collections', () => {
  const english = JSON.parse(readFileSync(englishUrl, 'utf8'))

  assert.deepEqual(english.profileCollections, {
    backToProfile: 'Back to profile',
    loadErrorBody: 'Try again in a moment.',
    loadErrorTitle: 'Could not load collection',
    moviesDescription: 'Movies watched by {{name}}.',
    moviesEmptyBody: 'Watched movies will appear here.',
    moviesEmptyTitle: 'No movies yet',
    moviesShareText: "See {{name}}'s movies on Kino.",
    moviesTitle: "{{name}}'s movies",
    noMatchesBody: 'Try adjusting or clearing your filters.',
    noMatchesTitle: 'No matches',
    search: 'Search collection',
    searchPlaceholder: 'Search by title...',
    seriesDescription: 'Series watched by {{name}}.',
    seriesEmptyBody: 'Watched series will appear here.',
    seriesEmptyTitle: 'No series yet',
    seriesShareText: "See {{name}}'s series on Kino.",
    seriesTitle: "{{name}}'s series",
  })

  assert.equal(english.metadata.profileMoviesTitle, "{{name}}'s movies")
  assert.equal(
    english.metadata.profileMoviesDescription,
    'Browse movies watched by @{{username}} on Kino.'
  )
  assert.equal(english.metadata.profileSeriesTitle, "{{name}}'s series")
  assert.equal(
    english.metadata.profileSeriesDescription,
    'Browse series watched by @{{username}} on Kino.'
  )
})
