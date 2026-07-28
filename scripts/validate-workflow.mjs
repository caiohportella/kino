import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const requiredCommands = [
  'pnpm install --frozen-lockfile',
  'pnpm biome check .',
  'pnpm lint',
  'pnpm typecheck',
  'pnpm test',
  'pnpm build:web',
]

const runCommands = (workflow) =>
  workflow.split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^\s*-\s+run:\s*(.+)\s*$/)
    return match ? [match[1]] : []
  })

const usesAction = (workflow, action) =>
  new RegExp(`^\\s*-\\s+uses:\\s+${action}@`, 'm').test(workflow)

const hasNodePnpmCache = (workflow) =>
  /^\s*-\s+uses:\s+actions\/setup-node@[^\n]+\n(?:^\s+.*\n)*?^\s+cache:\s*pnpm\s*$/m.test(workflow)

const hasReadOnlyContents = (workflow) =>
  /^permissions:\s*\n\s+contents:\s*read\s*$/m.test(workflow)

/**
 * Validates that a GitHub Actions workflow has the repository quality-gate
 * behavior required for pull requests.
 *
 * @param {string} path
 * @returns {Promise<{ commands: string[], errors: { rule: string }[] }>}
 */
export const validateWorkflow = async (path) => {
  const workflow = await readFile(path, 'utf8')
  const commands = runCommands(workflow)
  const errors = []

  if (JSON.stringify(commands) !== JSON.stringify(requiredCommands)) {
    errors.push({ rule: 'run-commands' })
  }
  if (!/^on:\s*\n\s+pull_request:\s*$/m.test(workflow)) {
    errors.push({ rule: 'pull-request-trigger' })
  }
  if (!/^\s*group:\s*\$\{\{ github\.workflow \}\}-\$\{\{ github\.ref \}\}\s*$/m.test(workflow)) {
    errors.push({ rule: 'concurrency-key' })
  }
  if (!/^\s*cancel-in-progress:\s*true\s*$/m.test(workflow)) {
    errors.push({ rule: 'concurrency-cancellation' })
  }
  if (!hasReadOnlyContents(workflow)) errors.push({ rule: 'read-only-permissions' })
  if (!usesAction(workflow, 'actions/checkout')) errors.push({ rule: 'checkout' })
  if (!usesAction(workflow, 'pnpm/action-setup')) errors.push({ rule: 'pnpm-setup' })
  if (!hasNodePnpmCache(workflow)) errors.push({ rule: 'node-pnpm-cache' })
  if (/\$\{\{\s*secrets\./i.test(workflow)) {
    errors.push({ rule: 'no-production-credentials' })
  }

  return { commands, errors }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [path] = process.argv.slice(2)
  if (!path) throw new Error('Usage: node scripts/validate-workflow.mjs <workflow-path>')

  const result = await validateWorkflow(path)
  if (result.errors.length) {
    throw new Error(result.errors.map(({ rule }) => rule).join(', '))
  }
}
