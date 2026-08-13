import assert from 'node:assert/strict'
import test from 'node:test'

import { normalizeUserDocument } from './user-document.ts'

test('user sync documents contain only public profile fields', () => {
  const document = normalizeUserDocument({
    id: 'u1',
    username: '@alice',
    displayName: 'Alice',
    bio: 'Film',
  })
  assert.equal(document?.username, 'alice')
  assert.equal('email' in document, false)
})
