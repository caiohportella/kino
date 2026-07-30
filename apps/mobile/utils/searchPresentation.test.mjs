import assert from 'node:assert/strict'
import test from 'node:test'

import { mobilePersonDepartment, toMobileSearchTitle } from './searchPresentation.ts'

const labels = {
  acting: 'Atuação',
  art: 'Arte',
  camera: 'Câmera',
  costumeAndMakeUp: 'Figurino e Maquiagem',
  creator: 'Criação',
  crew: 'Equipe',
  directing: 'Direção',
  editing: 'Edição',
  fallback: 'Pessoa',
  lighting: 'Iluminação',
  production: 'Produção',
  sound: 'Som',
  visualEffects: 'Efeitos Visuais',
  writing: 'Roteiro',
}

const score = {
  castOrderScore: 0,
  popularityScore: 0,
  relationshipScore: 0,
  semanticScore: 0.96,
  voteConfidenceScore: 0,
}

function result(entity = {}) {
  return {
    entity: {
      id: 'movie:238',
      entityType: 'movie',
      tmdbId: 238,
      title: 'The Godfather',
      ...entity,
    },
    score,
    sources: ['fixture'],
  }
}

test('keeps relevance out of mobile ratings and preserves nullable V2 ratings', () => {
  const missing = toMobileSearchTitle(result())
  assert.equal('vote_average' in missing, false)
  assert.equal(missing.title, 'The Godfather')

  const explicitNull = toMobileSearchTitle(result({ tmdbVoteAverage: null }))
  assert.equal(explicitNull.vote_average, null)

  const rated = toMobileSearchTitle(result({ tmdbVoteAverage: 8.7 }))
  assert.equal(rated.vote_average, 8.7)
  assert.notEqual(rated.vote_average, score.semanticScore)
})

test('keeps canonical mobile media types and localized person departments', () => {
  const series = toMobileSearchTitle(
    result({ entityType: 'series', id: 'series:238', title: 'Series' })
  )
  assert.equal(series.media_type, 'tv')
  assert.equal(mobilePersonDepartment('Acting', labels), 'Atuação')
  assert.equal(mobilePersonDepartment('Creator', labels), 'Criação')
  assert.equal(mobilePersonDepartment('Unknown', labels), 'Pessoa')
})
