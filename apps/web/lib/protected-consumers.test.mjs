import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const protectedConsumers = [
  '../app/diary/page.tsx',
  '../app/import/page.tsx',
  '../app/settings/page.tsx',
  '../app/watchlists/page.tsx',
]

test('web protected consumers delegate auth and page-state ordering to ProtectedContentGate', async () => {
  for (const relativePath of protectedConsumers) {
    const source = await readFile(new URL(relativePath, import.meta.url), 'utf8')

    assert.match(source, /ProtectedContentGate/, `${relativePath} must use the shared gate`)
    assert.match(source, /state\.resolution/, `${relativePath} must select typed auth resolution`)
    assert.doesNotMatch(
      source,
      /if\s*\(\s*!user\s*\)\s*\{\s*return\s+<ProtectedEmpty/s,
      `${relativePath} must not infer unauthenticated state from user`
    )
  }
})

for (const relativePath of ['../app/auth/login/page.tsx', '../app/auth/register/page.tsx']) {
  test(`${relativePath} redirects only after definitive authentication`, async () => {
    const source = await readFile(new URL(relativePath, import.meta.url), 'utf8')

    assert.match(source, /resolution\.status\s*===\s*['"]authenticated['"]/)
  })
}

test('the shared web shell gates initial restoration from typed auth resolution', async () => {
  const source = await readFile(new URL('../components/app-shell.tsx', import.meta.url), 'utf8')

  assert.match(source, /state\.resolution/)
  assert.match(source, /resolution\.status\s*===\s*['"]resolving['"]/)
  assert.doesNotMatch(source, /state\.loading/)
})
