import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { validateWorkspaceScripts } from './validate-test-scripts.mjs'

const fixtureRoot = async (name) => {
  const root = await mkdtemp(join(tmpdir(), `kino-${name}-`))

  await writeFile(
    join(root, 'package.json'),
    JSON.stringify({ workspaces: ['apps/*', 'packages/*'] }),
  )

  await Promise.all([
    writeManifest(root, 'apps/mobile', { test: 'node --test' }),
    writeManifest(
      root,
      'apps/web',
      name === 'missing-test' ? {} : { test: 'node --test' },
    ),
    writeManifest(root, 'packages/core', { test: 'node --test' }),
  ])

  return root
}

const writeManifest = async (root, relativePath, scripts) => {
  const directory = join(root, relativePath)
  await mkdir(directory, { recursive: true })
  await writeFile(
    join(directory, 'package.json'),
    JSON.stringify({ name: `@kino/${relativePath.split('/').at(-1)}`, scripts }),
  )
}

test('rejects a workspace package missing a test script', async (t) => {
  const root = await fixtureRoot('missing-test')
  t.after(() => rm(root, { recursive: true, force: true }))

  const result = await validateWorkspaceScripts(root)

  assert.deepEqual(result.missing, ['apps/web'])
})

test('reports no missing packages when every workspace package has a test script', async (t) => {
  const root = await fixtureRoot('complete')
  t.after(() => rm(root, { recursive: true, force: true }))

  const result = await validateWorkspaceScripts(root)

  assert.deepEqual(result.missing, [])
})
