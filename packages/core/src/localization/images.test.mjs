import assert from 'node:assert/strict'
import test from 'node:test'
import { selectLocalizedImage } from './images.ts'

const baseInput = {
  candidates: [],
  fallbackLocale: 'en-US',
  kind: 'poster',
  locale: 'pt-BR',
  originalLanguage: 'it',
  placeholderPath: '/kino/poster-placeholder.png',
  tmdbDefaultPath: '/tmdb-default.jpg',
}

const candidate = (filePath, language, overrides = {}) => ({
  aspectRatio: 2 / 3,
  filePath,
  height: 1500,
  language,
  voteAverage: 5,
  voteCount: 10,
  width: 1000,
  ...overrides,
})

const tierCases = [
  {
    candidates: [candidate('/exact.jpg', 'pt-BR'), candidate('/base.jpg', 'pt')],
    expectedPath: '/exact.jpg',
    expectedReason: null,
    expectedTier: 'exact',
    name: 'exact locale',
  },
  {
    candidates: [candidate('/base.jpg', 'pt')],
    expectedPath: '/base.jpg',
    expectedReason: 'base-language',
    expectedTier: 'base',
    name: 'base language',
  },
  {
    candidates: [candidate('/fallback.jpg', 'en')],
    expectedPath: '/fallback.jpg',
    expectedReason: 'configured-fallback',
    expectedTier: 'fallback',
    name: 'configured fallback',
  },
  {
    candidates: [candidate('/original.jpg', 'it')],
    expectedPath: '/original.jpg',
    expectedReason: 'original-language',
    expectedTier: 'original',
    name: 'original language',
  },
  {
    candidates: [candidate('/neutral.jpg', null)],
    expectedPath: '/neutral.jpg',
    expectedReason: 'language-neutral',
    expectedTier: 'neutral',
    name: 'language neutral',
  },
  {
    candidates: [],
    expectedPath: '/tmdb-default.jpg',
    expectedReason: 'tmdb-default',
    expectedTier: 'tmdb-default',
    name: 'TMDB default',
  },
]

for (const fixture of tierCases) {
  test(`selects the ${fixture.name} image tier`, () => {
    const result = selectLocalizedImage({
      ...baseInput,
      candidates: fixture.candidates,
    })

    assert.deepEqual(result, {
      fallbackReason: fixture.expectedReason,
      languageTier: fixture.expectedTier,
      path: fixture.expectedPath,
    })
  })
}

test('ignores missing and malformed provider paths before falling back', () => {
  const result = selectLocalizedImage({
    ...baseInput,
    candidates: [
      candidate('', 'pt-BR'),
      candidate('javascript:alert(1)', 'pt-BR'),
      candidate(null, 'pt-BR'),
      candidate('/valid-neutral.jpg', null),
    ],
  })

  assert.equal(result.path, '/valid-neutral.jpg')
  assert.equal(result.languageTier, 'neutral')
})

test('does not reinterpret a malformed image language as language neutral', () => {
  const result = selectLocalizedImage({
    ...baseInput,
    candidates: [candidate('/bad-language.jpg', 'not a locale'), candidate('/neutral.jpg', null)],
  })

  assert.equal(result.path, '/neutral.jpg')
  assert.equal(result.languageTier, 'neutral')
})

test('uses the Kino placeholder when neither candidates nor a TMDB default are valid', () => {
  const result = selectLocalizedImage({
    ...baseInput,
    placeholderPath: '/kino/logo-placeholder.png',
    tmdbDefaultPath: 'not-a-provider-path',
  })

  assert.deepEqual(result, {
    fallbackReason: 'kino-placeholder',
    languageTier: 'placeholder',
    path: '/kino/logo-placeholder.png',
  })
})

test('returns an explicit empty placeholder selection when no path exists', () => {
  const result = selectLocalizedImage({
    ...baseInput,
    placeholderPath: null,
    tmdbDefaultPath: null,
  })

  assert.deepEqual(result, {
    fallbackReason: 'kino-placeholder',
    languageTier: 'placeholder',
    path: null,
  })
})

test('orders equal-language posters by aspect, quality, votes, then a stable path', () => {
  const result = selectLocalizedImage({
    ...baseInput,
    candidates: [
      candidate('/wrong-aspect.jpg', 'pt-BR', {
        aspectRatio: 1.8,
        quality: 100,
        voteAverage: 10,
        voteCount: 1000,
      }),
      candidate('/low-quality.jpg', 'pt-BR', { quality: 1 }),
      candidate('/few-votes.jpg', 'pt-BR', {
        quality: 2,
        voteAverage: 8,
        voteCount: 1,
      }),
      candidate('/z-stable.jpg', 'pt-BR', {
        quality: 2,
        voteAverage: 8,
        voteCount: 20,
      }),
      candidate('/a-stable.jpg', 'pt-BR', {
        quality: 2,
        voteAverage: 8,
        voteCount: 20,
      }),
    ],
  })

  assert.equal(result.path, '/a-stable.jpg')
})

test('is deterministic across shuffled fixtures and never mutates provider arrays', () => {
  const images = [
    candidate('/c.jpg', 'pt-BR', { voteCount: 20 }),
    candidate('/a.jpg', 'pt-BR', { voteCount: 20 }),
    candidate('/b.jpg', 'pt-BR', { voteCount: 20 }),
  ]
  const originalOrder = images.map((image) => image.filePath)
  const selectedPaths = [images, [images[2], images[0], images[1]], [...images].reverse()].map(
    (candidates) => selectLocalizedImage({ ...baseInput, candidates }).path
  )

  assert.deepEqual(selectedPaths, ['/a.jpg', '/a.jpg', '/a.jpg'])
  assert.deepEqual(
    images.map((image) => image.filePath),
    originalOrder
  )
})

for (const kind of ['poster', 'backdrop', 'logo', 'profile']) {
  test(`supports ${kind} image selection`, () => {
    const result = selectLocalizedImage({
      ...baseInput,
      candidates: [candidate(`/${kind}.jpg`, 'pt-BR')],
      kind,
    })
    assert.equal(result.path, `/${kind}.jpg`)
  })
}
