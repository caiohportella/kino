import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

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
