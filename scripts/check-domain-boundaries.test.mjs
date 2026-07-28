import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const checkerPath = fileURLToPath(new URL('./check-domain-boundaries.mjs', import.meta.url))

const writeSource = async (root, relativePath, source) => {
  const path = join(root, relativePath)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, source)
}

const runChecker = (root) =>
  new Promise((resolve) => {
    const child = spawn(process.execPath, [checkerPath, root], {
      cwd: tmpdir(),
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''

    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk) => {
      stdout += chunk
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })
    child.on('close', (code) => resolve({ code, stderr, stdout }))
  })

test('ignores prose while accepting internal platform-neutral indexing imports', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'kino-boundaries-safe-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  await writeSource(
    root,
    'packages/core/src/indexing/documents.ts',
    `
      // import '@upstash/vector'
      const example = "import React from 'react'"
      import type { SearchIndexDocumentV1 } from './types.ts'
      export { SEARCH_INDEX_SCHEMA_VERSION } from './version.ts'
    `
  )
  await writeSource(
    root,
    'packages/core/src/search/pipeline.ts',
    `import type { SearchRequestV1 } from './types.ts'`
  )

  assert.deepEqual(await runChecker(root), {
    code: 0,
    stderr: '',
    stdout: 'Domain boundaries passed.\n',
  })
})

test('CLI exits nonzero for parsed provider and search/indexing cross-imports', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'kino-boundaries-forbidden-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  await writeSource(
    root,
    'packages/core/src/indexing/provider.ts',
    `import { Index } from '@upstash/vector'`
  )
  await writeSource(
    root,
    'packages/core/src/indexing/search-coupling.ts',
    `export { rankSearchCandidates } from '../search/rank.ts'`
  )
  await writeSource(
    root,
    'packages/core/src/search/indexing-coupling.ts',
    `import { buildSearchIndexDocumentV1 } from '../indexing/documents.ts'`
  )

  const result = await runChecker(root)

  assert.equal(result.code, 1)
  assert.equal(result.stdout, '')
  assert.match(result.stderr, /indexing\/provider\.ts.*@upstash\/vector/)
  assert.match(result.stderr, /indexing\/search-coupling\.ts.*\.\.\/search\/rank\.ts/)
  assert.match(result.stderr, /search\/indexing-coupling\.ts.*\.\.\/indexing\/documents\.ts/)
})
