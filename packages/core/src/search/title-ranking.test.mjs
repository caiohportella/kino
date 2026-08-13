import assert from 'node:assert/strict'
import test from 'node:test'
import {
  classifyTitleMatch,
  compareTitleRankingSignals,
  titleAudienceScore,
  titleRankingSignals,
} from './title-ranking.ts'

test('puts exact and prefix evidence in the strong title band', () => {
  assert.equal(classifyTitleMatch({ exactMatch: true }), 'strong')
  assert.equal(classifyTitleMatch({ prefixMatch: true }), 'strong')
  assert.equal(classifyTitleMatch({ lexicalScore: 0.85 }), 'strong')
})

test('keeps ordinary, fuzzy, and absent evidence below strong', () => {
  assert.equal(classifyTitleMatch({ lexicalScore: 0.65 }), 'medium')
  assert.equal(classifyTitleMatch({ semanticScore: 0.4 }), 'fuzzy')
  assert.equal(classifyTitleMatch({}), 'weak')
})

test('weights vote count more than popularity and ignores rating as primary audience evidence', () => {
  const broad = titleAudienceScore({ voteCount: 30_000, popularity: 30, voteAverage: 8.2 })
  const highlyRated = titleAudienceScore({ voteCount: 12, popularity: 30, voteAverage: 9.1 })
  assert.ok(broad > highlyRated)
})

test('handles missing and invalid audience metrics neutrally', () => {
  assert.equal(titleAudienceScore({}), 0)
  assert.equal(titleAudienceScore({ voteCount: Number.NaN, popularity: -4 }), 0)
})

test('audience prominence reorders comparable strong matches', () => {
  const obscure = titleRankingSignals(
    { exactMatch: true, lexicalScore: 1 },
    { voteCount: 100, popularity: 2 }
  )
  const recognized = titleRankingSignals(
    { prefixMatch: true, lexicalScore: 0.92 },
    { voteCount: 20_000, popularity: 300 }
  )
  assert.ok(compareTitleRankingSignals(recognized, obscure) < 0)
})

test('a weak fuzzy match cannot beat a strong match through popularity', () => {
  const strong = titleRankingSignals(
    { prefixMatch: true, lexicalScore: 0.9 },
    { voteCount: 20, popularity: 1 }
  )
  const fuzzy = titleRankingSignals(
    { semanticScore: 0.4 },
    { voteCount: 500_000, popularity: 1_000_000 }
  )
  assert.ok(compareTitleRankingSignals(strong, fuzzy) < 0)
})
