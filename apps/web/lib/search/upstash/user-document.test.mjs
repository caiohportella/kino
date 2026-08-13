import assert from 'node:assert/strict'
import test from 'node:test'

import { normalizeUserDocument, normalizeUserDocumentFromProfile } from './user-document.ts'

test('normalizes a public user profile and strips the username marker', () => {
  assert.deepEqual(
    normalizeUserDocument({
      id: 'user-1',
      username: '@Dex',
      displayName: 'Dex Kino',
      bio: 'Movies and series',
      avatarUrl: 'https://kino.test/avatar.png',
    }),
    {
      id: 'user:user-1',
      entityType: 'user',
      userId: 'user-1',
      username: 'Dex',
      displayName: 'Dex Kino',
      firstName: 'Dex',
      lastName: 'Kino',
      bio: 'Movies and series',
      avatarUrl: 'https://kino.test/avatar.png',
      popularity: 0,
    }
  )
})

test('normalizes a profile row without indexing private fields', () => {
  const document = normalizeUserDocumentFromProfile({
    id: 'user-2',
    username: 'brando',
    display_name: null,
    avatar_url: null,
    bio: null,
  })

  assert.deepEqual(document, {
    id: 'user:user-2',
    entityType: 'user',
    userId: 'user-2',
    username: 'brando',
    displayName: '',
    firstName: '',
    lastName: '',
    bio: '',
    avatarUrl: null,
    popularity: 0,
  })
  assert.equal('email' in document, false)
})
