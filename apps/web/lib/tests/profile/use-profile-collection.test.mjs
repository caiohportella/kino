import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(
  new URL('../../../hooks/profile/use-profile-sections.ts', import.meta.url),
  'utf8'
)

test('exposes a dedicated profile collection hook through the canonical query options', () => {
  assert.match(source, /profileCollectionQueryOptions/)

  assert.match(source, /export function useProfileCollection/)

  assert.match(source, /useQuery\(\{\s*\.\.\.options,\s*enabled:/s)
})
