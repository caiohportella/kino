import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const workflowPath = fileURLToPath(new URL('../.github/workflows/quality.yml', import.meta.url))
const validatorPath = fileURLToPath(new URL('./validate-workflow.mjs', import.meta.url))

const readRunCommands = async (path) => {
  const workflow = await readFile(path, 'utf8')
  const commands = []
  let inRunBlock = false

  for (const line of workflow.split(/\r?\n/)) {
    const run = line.match(/^\s*-\s+run:\s*(.+)\s*$/)
    if (run) {
      commands.push(run[1])
      inRunBlock = false
      continue
    }

    if (/^\s*run:\s*\|\s*$/.test(line)) {
      inRunBlock = true
      continue
    }

    if (inRunBlock && /^\s{8,}\S/.test(line)) {
      commands.push(line.trim())
      continue
    }

    if (line.trim() && !/^\s/.test(line)) inRunBlock = false
  }

  return commands
}

test('quality workflow exposes every required command in order', async () => {
  assert.deepEqual(await readRunCommands(workflowPath), [
    'pnpm install --frozen-lockfile',
    'pnpm biome check .',
    'pnpm lint',
    'pnpm typecheck',
    'pnpm test',
    'pnpm build:web',
  ])
})

test('quality workflow satisfies its operational safety contract', async () => {
  const { validateWorkflow } = await import('./validate-workflow.mjs')

  const result = await validateWorkflow(workflowPath)

  assert.deepEqual(result.errors, [])
})

test('validator rejects a workflow that keeps obsolete runs or exposes secrets', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'kino-workflow-'))
  const fixturePath = join(root, 'quality.yml')
  t.after(() => rm(root, { recursive: true, force: true }))

  await writeFile(
    fixturePath,
    `name: Quality\non:\n  pull_request:\nconcurrency:\n  group: \${{ github.workflow }}-\${{ github.ref }}\n  cancel-in-progress: false\npermissions:\n  contents: read\njobs:\n  quality:\n    runs-on: ubuntu-latest\n    env:\n      TOKEN: \${{ secrets.DEPLOY_TOKEN }}\n    steps:\n      - uses: actions/checkout@v4\n      - uses: pnpm/action-setup@v4\n      - uses: actions/setup-node@v4\n        with:\n          node-version: 22\n          cache: pnpm\n      - run: pnpm install --frozen-lockfile\n      - run: pnpm biome check .\n      - run: pnpm lint\n      - run: pnpm typecheck\n      - run: pnpm test\n      - run: pnpm build:web\n`
  )

  const { validateWorkflow } = await import('./validate-workflow.mjs')
  const result = await validateWorkflow(fixturePath)

  assert.deepEqual(result.errors.map(({ rule }) => rule).sort(), [
    'concurrency-cancellation',
    'no-production-credentials',
  ])

  await assert.rejects(
    execFileAsync(process.execPath, [validatorPath, fixturePath]),
    /concurrency-cancellation, no-production-credentials/
  )
})

test('validator rejects required values nested outside their required mappings', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'kino-workflow-'))
  const fixturePath = join(root, 'quality.yml')
  t.after(() => rm(root, { recursive: true, force: true }))

  await writeFile(
    fixturePath,
    `name: Quality\non:\n  pull_request:\njobs:\n  quality:\n    runs-on: ubuntu-latest\n    concurrency:\n      group: \${{ github.workflow }}-\${{ github.ref }}\n      cancel-in-progress: true\n    permissions:\n      contents: read\n  other:\n    steps:\n      - uses: actions/checkout@v4\n      - uses: pnpm/action-setup@v4\n      - uses: actions/setup-node@v4\n        with:\n          node-version: 22\n          cache: pnpm\n      - run: pnpm install --frozen-lockfile\n      - run: pnpm biome check .\n      - run: pnpm lint\n      - run: pnpm typecheck\n      - run: pnpm test\n      - run: pnpm build:web\n`
  )

  const { validateWorkflow } = await import('./validate-workflow.mjs')
  const result = await validateWorkflow(fixturePath)

  assert.deepEqual(result.errors.map(({ rule }) => rule).sort(), [
    'checkout',
    'concurrency-cancellation',
    'concurrency-key',
    'node-pnpm-cache',
    'pnpm-setup',
    'read-only-permissions',
    'run-commands',
  ])
})
