import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeSearchQuery } from './normalize.ts'
import { qualifyPersonExpansion } from './person-qualification.ts'

const person = (name, confidence) => ({
  source: 'person',
  entity: { id: `person:${name}`, entityType: 'person', title: name, tmdbId: 1 },
  confidence,
})

test('qualifies an exact Ryan Gosling search only with strong person evidence', () => {
  const query = normalizeSearchQuery('Ryan Gosling')
  assert.equal(
    qualifyPersonExpansion(query, {
      intent: { kind: 'person', personName: 'Ryan Gosling' },
      person: person('Ryan Gosling', 0.8),
    }),
    true
  )
  assert.equal(
    qualifyPersonExpansion(query, {
      intent: { kind: 'person', personName: 'Ryan Gosling' },
      person: person('Ryan Gosling', 0.79),
    }),
    false
  )
})

test('uses lexical or alias evidence to qualify Michael C. Hall without lowering the threshold', () => {
  const query = normalizeSearchQuery('Michael C. Hall')
  assert.equal(
    qualifyPersonExpansion(query, {
      intent: { kind: 'person', personName: 'Michael C. Hall' },
      person: person('Michael C. Hall', 0.42),
      aliasScore: 0.8,
    }),
    true
  )
  assert.equal(
    qualifyPersonExpansion(query, {
      intent: { kind: 'person', personName: 'Michael C. Hall' },
      person: person('Michael C. Hall', 0.42),
      lexicalNameScore: 0.79,
    }),
    false
  )
})

test('relationship wording qualifies Pedro Pascal, Sofia Coppola, and Christopher Nolan at its explicit boundary', () => {
  for (const [queryText, name, role] of [
    ['shows with Pedro Pascal', 'Pedro Pascal', 'acting'],
    ['movies directed by Sofia Coppola', 'Sofia Coppola', 'directing'],
    ['films directed by Christopher Nolan', 'Christopher Nolan', 'directing'],
  ]) {
    assert.equal(
      qualifyPersonExpansion(normalizeSearchQuery(queryText), {
        intent: { kind: 'relationship', personName: name, role, mediaTypes: ['movie'] },
        person: person(name, 0.5),
      }),
      true
    )
  }
})

test('does not qualify relationship expansion below the relationship evidence boundary', () => {
  assert.equal(
    qualifyPersonExpansion(normalizeSearchQuery('movies directed by Sofia Coppola'), {
      intent: { kind: 'relationship', personName: 'Sofia Coppola', role: 'directing' },
      person: person('Sofia Coppola', 0.49),
    }),
    false
  )
})
