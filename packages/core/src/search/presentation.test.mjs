import assert from 'node:assert/strict'
import test from 'node:test'

import { getLocalizedPersonDepartment, toSearchTitleCardModel } from './presentation.ts'

const score = {
  castOrderScore: 0,
  popularityScore: 0.2,
  relationshipScore: 0,
  semanticScore: 0.91,
  voteConfidenceScore: 0.8,
}

function result(entityType = 'movie', entity = {}) {
  return {
    entity: {
      entityType,
      id: `${entityType}:238`,
      tmdbId: 238,
      title: 'Provider title',
      year: 1972,
      imageUrl: '/provider-poster.jpg',
      ...entity,
    },
    score,
    sources: ['fixture'],
  }
}

test('keeps semantic relevance distinct while transporting one authoritative nullable rating', () => {
  const missing = toSearchTitleCardModel(result(), {
    displayRating: undefined,
    localizedPoster: '/localized.jpg',
    localizedTitle: 'The Godfather',
  })
  assert.equal(missing.displayRating, undefined)
  assert.equal(missing.semanticRelevance, 0.91)

  const explicitNull = toSearchTitleCardModel(
    result('movie', { tmdbVoteAverage: null, kinoAverageRating: null }),
    {
      displayRating: null,
      localizedPoster: null,
      localizedTitle: 'The Godfather',
    }
  )
  assert.equal(explicitNull.displayRating, null)
  assert.equal(explicitNull.tmdbVoteAverage, null)
  assert.equal(explicitNull.kinoAverageRating, null)

  const normalizedOnce = toSearchTitleCardModel(
    result('movie', { tmdbVoteAverage: 8.7, kinoAverageRating: 4.5 }),
    {
      displayRating: 8.7,
      localizedPoster: '/localized.jpg',
      localizedTitle: 'The Godfather',
    }
  )
  assert.equal(normalizedOnce.displayRating, 8.7)
  assert.notEqual(normalizedOnce.displayRating, normalizedOnce.semanticRelevance)
})

test('preserves localized presentation and canonical movie and series routes', () => {
  assert.deepEqual(
    toSearchTitleCardModel(result(), {
      displayRating: 8.7,
      localizedPoster: '/poster-pt.jpg',
      localizedTitle: 'O Poderoso Chefão',
    }),
    {
      displayRating: 8.7,
      id: 238,
      localizedPoster: '/poster-pt.jpg',
      localizedTitle: 'O Poderoso Chefão',
      mediaType: 'movie',
      releaseYear: 1972,
      route: '/title/238?type=movie',
      semanticRelevance: 0.91,
    }
  )

  const series = toSearchTitleCardModel(result('series'), {
    displayRating: null,
    localizedPoster: '/series.jpg',
    localizedTitle: 'A Série',
  })
  assert.equal(series.mediaType, 'series')
  assert.equal(series.route, '/title/238?type=tv')
})

test('maps supported person departments and uses a neutral supplied fallback', () => {
  const labels = {
    acting: 'Atuação',
    art: 'Arte',
    camera: 'Câmera',
    creator: 'Criação',
    crew: 'Equipe',
    directing: 'Direção',
    editing: 'Edição',
    fallback: 'Pessoa',
    lighting: 'Iluminação',
    production: 'Produção',
    sound: 'Som',
    visualEffects: 'Efeitos Visuais',
    costumeAndMakeUp: 'Figurino e Maquiagem',
    writing: 'Roteiro',
  }

  assert.equal(getLocalizedPersonDepartment('Acting', labels), 'Atuação')
  assert.equal(getLocalizedPersonDepartment('Directing', labels), 'Direção')
  assert.equal(getLocalizedPersonDepartment('Writing', labels), 'Roteiro')
  assert.equal(getLocalizedPersonDepartment('Production', labels), 'Produção')
  assert.equal(getLocalizedPersonDepartment('Sound', labels), 'Som')
  assert.equal(getLocalizedPersonDepartment('Creator', labels), 'Criação')
  assert.equal(getLocalizedPersonDepartment('Unknown department', labels), 'Pessoa')
  assert.equal(getLocalizedPersonDepartment(null, labels), 'Pessoa')
})
