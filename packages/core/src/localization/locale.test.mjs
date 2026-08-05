import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeLocale, normalizeRegion } from './locale.ts'

test('normalizes BCP 47 locale casing without inventing a region', () => {
  assert.equal(normalizeLocale('PT_br'), 'pt-BR')
  assert.equal(normalizeLocale('zh-hant-tw'), 'zh-Hant-TW')
  assert.equal(normalizeLocale('NO'), 'no')
})

test('rejects empty and malformed locales', () => {
  assert.throws(() => normalizeLocale('  '), /locale/i)
  assert.throws(() => normalizeLocale('english'), /locale/i)
  assert.throws(() => normalizeLocale('en-@'), /locale/i)
})

test('normalizes regions independently from locales', () => {
  assert.equal(normalizeRegion('br'), 'BR')
  assert.equal(normalizeRegion('419'), '419')
  assert.throws(() => normalizeRegion(''), /region/i)
  assert.throws(() => normalizeRegion('brazil'), /region/i)
})
