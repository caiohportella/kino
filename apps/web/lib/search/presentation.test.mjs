import assert from 'node:assert/strict'
import test from 'node:test'

import { toWebSearchGroups } from './presentation.ts'

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
  semanticScore: 0.93,
  voteConfidenceScore: 0,
}

test('adapts V2 titles without converting relevance into rating and preserves gateway order', () => {
  const response = {
    schemaVersion: 2,
    query: { original: 'crime', folded: 'crime', tokens: ['crime'] },
    results: [],
    groups: [
      {
        type: 'movies',
        results: [
          {
            entity: {
              id: 'movie:2',
              entityType: 'movie',
              tmdbId: 2,
              title: 'Second',
              tmdbVoteAverage: null,
            },
            score,
            sources: ['fixture'],
          },
          {
            entity: {
              id: 'movie:1',
              entityType: 'movie',
              tmdbId: 1,
              title: 'First',
              tmdbVoteAverage: 8.7,
            },
            score: { ...score, semanticScore: 0.1 },
            sources: ['fixture'],
          },
        ],
      },
    ],
    total: 2,
    page: 1,
    limit: 20,
  }

  const groups = toWebSearchGroups(response, { departmentLabels: labels })
  assert.deepEqual(
    groups.groups.movies.map((item) => item.id),
    [2, 1]
  )
  assert.equal(groups.groups.movies[0].media.vote_average, null)
  assert.equal(groups.groups.movies[1].media.vote_average, 8.7)
  assert.notEqual(groups.groups.movies[0].media.vote_average, score.semanticScore)
})

test('keeps V1 missing ratings absent and localizes person departments', () => {
  const response = {
    schemaVersion: 1,
    query: { original: 'person', folded: 'person', tokens: ['person'] },
    results: [],
    groups: [
      {
        type: 'movies',
        results: [
          {
            entity: { id: 'movie:1', entityType: 'movie', tmdbId: 1, title: 'Movie' },
            score: 0.99,
            sources: ['fixture'],
          },
        ],
      },
      {
        type: 'people',
        results: [
          {
            entity: {
              id: 'person:2',
              entityType: 'person',
              tmdbId: 2,
              title: 'Person',
              department: 'Directing',
            },
            score: 0.8,
            sources: ['fixture'],
          },
          {
            entity: {
              id: 'person:3',
              entityType: 'person',
              tmdbId: 3,
              title: 'Unknown',
              department: 'Other',
            },
            score: 0.7,
            sources: ['fixture'],
          },
        ],
      },
    ],
    total: 3,
    page: 1,
    limit: 20,
  }
  const groups = toWebSearchGroups(response, { departmentLabels: labels })
  assert.equal('vote_average' in groups.groups.movies[0].media, false)
  assert.deepEqual(
    groups.groups.people.map((person) => person.summary),
    ['Direção', 'Pessoa']
  )
})
