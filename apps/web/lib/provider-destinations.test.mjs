import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveProviderDestination } from './provider-destinations.ts'

const context = (overrides = {}) => ({
  mediaType: 'movie',
  providerId: 1,
  providerName: 'Netflix',
  region: 'BR',
  releaseYear: 2001,
  title: "Amélie & l'amour",
  tmdbId: 194,
  ...overrides,
})

test('encodes provider title searches without using TMDB', () => {
  const destination = resolveProviderDestination(context())
  assert.equal(destination?.kind, 'search')
  assert.equal(
    destination?.webUrl,
    "https://www.netflix.com/search?q=Am%C3%A9lie%20%26%20l'amour%202001"
  )
  assert.equal(destination?.webUrl.includes('themoviedb.org'), false)
})

test('keeps movie and series searches distinct where required', () => {
  const movie = resolveProviderDestination(context({ providerName: 'YouTube' }))
  const series = resolveProviderDestination(
    context({ mediaType: 'tv', providerName: 'YouTube', releaseYear: 2020 })
  )
  assert.equal(movie?.webUrl.endsWith('%20movie'), true)
  assert.equal(series?.webUrl.endsWith('%20series'), true)
})

test('applies provider region restrictions', () => {
  assert.ok(resolveProviderDestination(context({ providerName: 'Globoplay', region: 'BR' })))
  assert.equal(
    resolveProviderDestination(context({ providerName: 'Globoplay', region: 'US' }))?.kind,
    'homepage'
  )
})

test('keeps every provider clickable with a homepage fallback', () => {
  assert.equal(
    resolveProviderDestination(context({ providerName: 'Unknown Streamer' }))?.kind,
    'homepage'
  )
  assert.equal(
    resolveProviderDestination(context({ providerName: 'Disney Plus' }))?.webUrl,
    'https://www.disneyplus.com/'
  )
  assert.equal(
    resolveProviderDestination(context({ providerName: 'FlixFling' }))?.webUrl,
    'https://www.flixfling.com/'
  )
})
