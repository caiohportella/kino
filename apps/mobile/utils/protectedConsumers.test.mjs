import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { hasAuthenticatedUser, resolveProtectedContentState } from '@kino/core/auth'
import { selectProfilePageStatus, selectSettingsPageStatus } from './protectedConsumerState.ts'

const protectedConsumers = [
  'app/(tabs)/profile.tsx',
  'app/profile/[id].tsx',
  'app/profile/import.tsx',
  'app/profile/settings.tsx',
]

test('mobile protected consumers delegate auth ordering to ProtectedContentGate', async () => {
  for (const relativePath of protectedConsumers) {
    const source = await readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8')

    assert.match(source, /ProtectedContentGate/, `${relativePath} must use the shared gate`)
    assert.match(source, /\bresolution\b/, `${relativePath} must consume typed auth resolution`)
    assert.doesNotMatch(
      source,
      /if\s*\(\s*!isAuthenticated[^)]*\)\s*\{\s*return\s+<UnauthenticatedView/s,
      `${relativePath} must not infer unauthenticated state from isAuthenticated`
    )
  }
})

for (const relativePath of ['app/(auth)/login.tsx', 'components/auth/MultiStepForm.tsx']) {
  test(`${relativePath} redirects only after definitive authentication`, async () => {
    const source = await readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8')

    assert.match(source, /resolution\.status\s*===\s*['"]authenticated['"]/)
  })
}

test('mobile public profile routes preserve unauthenticated viewing by gating only the own-profile case', async () => {
  for (const relativePath of ['app/(tabs)/profile.tsx', 'app/profile/[id].tsx']) {
    const source = await readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8')
    assert.match(source, /publicProfileResolution/)
  }
})

test('mobile settings starts profile data in a loading state', async () => {
  const source = await readFile(new URL('../app/profile/settings.tsx', import.meta.url), 'utf8')
  assert.match(source, /const \[loading, setLoading\] = useState\(true\)/)
})

test('profile page status distinguishes loading, rejection, empty, and content', () => {
  assert.equal(
    selectProfilePageStatus({ error: null, hasProfile: false, loading: true }),
    'loading'
  )
  assert.equal(
    selectProfilePageStatus({
      error: new Error('profile rejected'),
      hasProfile: false,
      loading: false,
    }),
    'error'
  )
  assert.equal(selectProfilePageStatus({ error: null, hasProfile: false, loading: false }), 'empty')
  assert.equal(
    selectProfilePageStatus({ error: null, hasProfile: true, loading: false }),
    'content'
  )
})

test('settings page status distinguishes loading, rejection, and content', () => {
  assert.equal(selectSettingsPageStatus({ error: null, loading: true }), 'loading')
  assert.equal(
    selectSettingsPageStatus({ error: new Error('settings rejected'), loading: false }),
    'error'
  )
  assert.equal(selectSettingsPageStatus({ error: null, loading: false }), 'content')
})

test('profile status composes with auth restoration, refresh retention, and invalidation', () => {
  const content = selectProfilePageStatus({ error: null, hasProfile: true, loading: false })
  assert.equal(
    resolveProtectedContentState({ resolution: { status: 'resolving' }, pageStatus: content }),
    'auth-loading'
  )
  assert.equal(
    resolveProtectedContentState({
      resolution: {
        status: 'error',
        error: { code: 'temporary_refresh_failure', message: 'offline', recoverable: true },
        previousUser: { id: 'user-1' },
      },
      pageStatus: content,
    }),
    'content'
  )
  assert.equal(
    resolveProtectedContentState({
      resolution: { status: 'unauthenticated' },
      pageStatus: content,
    }),
    'unauthenticated'
  )
})

test('the shared mobile tab boundary renders a skeleton during initial auth restoration', async () => {
  const source = await readFile(new URL('../app/(tabs)/_layout.tsx', import.meta.url), 'utf8')

  assert.match(source, /useAuth\(\)/)
  assert.match(source, /resolution\.status\s*===\s*['"]resolving['"]/)
  assert.match(source, /!hasAuthenticatedUser\(resolution\)/)
  assert.match(source, /<Skeleton/)
  assert.equal(hasAuthenticatedUser({ status: 'resolving' }), false)
  assert.equal(hasAuthenticatedUser({ status: 'resolving', previousUser: { id: 'user-1' } }), true)
})
