import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { validateWorkspaceScripts } from './validate-test-scripts.mjs'

const fixtureRoot = async ({ name, patterns = ['apps/*', 'packages/*'], scripts = {} }) => {
  const root = await mkdtemp(join(tmpdir(), `kino-${name}-`))

  await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'kino', private: true }))
  await writeFile(
    join(root, 'pnpm-workspace.yaml'),
    `packages:\n${patterns.map((pattern) => `  - ${pattern}`).join('\n')}\n`
  )

  await Promise.all([
    writeManifest(root, 'apps/mobile', scripts.mobile ?? { test: 'node --test' }),
    writeManifest(root, 'apps/web', scripts.web ?? { test: 'node --test' }),
    writeManifest(root, 'packages/config', scripts.config ?? {}),
    writeManifest(root, 'packages/core', scripts.core ?? { test: 'node --test' }),
  ])

  return root
}

const writeManifest = async (root, relativePath, scripts) => {
  const directory = join(root, relativePath)
  await mkdir(directory, { recursive: true })
  await writeFile(
    join(directory, 'package.json'),
    JSON.stringify({ name: `@kino/${relativePath.split('/').at(-1)}`, scripts })
  )
}

test('rejects a workspace package missing a test script', async (t) => {
  const root = await fixtureRoot({ name: 'missing-test', scripts: { web: {} } })
  t.after(() => rm(root, { recursive: true, force: true }))

  const result = await validateWorkspaceScripts(root)

  assert.deepEqual(result.missing, ['apps/web', 'packages/config'])
})

test('reports no missing packages when every workspace package has a test script', async (t) => {
  const root = await fixtureRoot({
    name: 'complete',
    scripts: { config: { test: 'node --test' } },
  })
  t.after(() => rm(root, { recursive: true, force: true }))

  const result = await validateWorkspaceScripts(root)

  assert.deepEqual(result.missing, [])
})

test('matches a globstar with zero directory segments', async (t) => {
  const root = await fixtureRoot({
    name: 'globstar',
    patterns: ['apps/**/mobile', 'packages/*'],
    scripts: { mobile: {}, config: { test: 'node --test' } },
  })
  t.after(() => rm(root, { recursive: true, force: true }))

  const result = await validateWorkspaceScripts(root)

  assert.deepEqual(result.missing, ['apps/mobile'])
})
