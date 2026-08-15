import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const requiredCommands = [
  'pnpm install --frozen-lockfile',
  'pnpm biome',
  'pnpm lint',
  'pnpm typecheck',
  'pnpm test',
  'pnpm build:web',
]

const parseLines = (workflow) =>
  workflow.split(/\r?\n/).map((source) => {
    const content = source.trim()
    return { content, indent: source.length - source.trimStart().length }
  })

const childIndent = (lines, start, parentIndent) => {
  for (let index = start; index < lines.length; index += 1) {
    const line = lines[index]
    if (!line.content || line.content.startsWith('#')) continue
    if (line.indent <= parentIndent) return undefined
    return line.indent
  }
}

const mappingEntries = (lines, start, parentIndent) => {
  const indent = childIndent(lines, start, parentIndent)
  const entries = new Map()
  if (indent === undefined) return entries

  for (let index = start; index < lines.length; index += 1) {
    const line = lines[index]
    if (!line.content || line.content.startsWith('#')) continue
    if (line.indent <= parentIndent) break
    if (line.indent !== indent) continue

    const match = line.content.match(/^([^:#][^:]*):(?:\s*(.*))?$/)
    if (match) entries.set(match[1], { index, indent, value: match[2] ?? '' })
  }

  return entries
}

const mappingEntryCount = (lines, start, parentIndent) => {
  const indent = childIndent(lines, start, parentIndent)
  if (indent === undefined) return 0

  let count = 0
  for (let index = start; index < lines.length; index += 1) {
    const line = lines[index]
    if (!line.content || line.content.startsWith('#')) continue
    if (line.indent <= parentIndent) break
    if (line.indent === indent && /^([^:#][^:]*):(?:\s*(.*))?$/.test(line.content)) count += 1
  }

  return count
}

const sequenceItems = (lines, start, parentIndent) => {
  const indent = childIndent(lines, start, parentIndent)
  const items = []
  if (indent === undefined) return items

  for (let index = start; index < lines.length; index += 1) {
    const line = lines[index]
    if (!line.content || line.content.startsWith('#')) continue
    if (line.indent <= parentIndent) break
    if (line.indent !== indent) continue

    const match = line.content.match(/^-\s+([^:]+):(?:\s*(.*))?$/)
    if (match) items.push({ index, indent, key: match[1], value: match[2] ?? '' })
  }

  return items
}

const childMappings = (lines, entry) => mappingEntries(lines, entry.index + 1, entry.indent)

const matchesRequiredCommands = (commands) =>
  commands.length === requiredCommands.length &&
  commands.every((command, index) => command === requiredCommands[index])

/**
 * Validates that a GitHub Actions workflow has the repository quality-gate
 * behavior required for pull requests and branch pushes.
 *
 * @param {string} path
 * @returns {Promise<{ commands: string[], errors: { rule: string }[] }>}
 */
export const validateWorkflow = async (path) => {
  const workflow = await readFile(path, 'utf8')
  const lines = parseLines(workflow)
  const root = mappingEntries(lines, 0, -1)
  const on = childMappings(lines, root.get('on') ?? { index: lines.length, indent: -1 })
  const concurrency = childMappings(
    lines,
    root.get('concurrency') ?? { index: lines.length, indent: -1 }
  )
  const permissions = childMappings(
    lines,
    root.get('permissions') ?? { index: lines.length, indent: -1 }
  )
  const permissionsEntry = root.get('permissions')
  const permissionCount = permissionsEntry
    ? mappingEntryCount(lines, permissionsEntry.index + 1, permissionsEntry.indent)
    : 0
  const jobs = childMappings(lines, root.get('jobs') ?? { index: lines.length, indent: -1 })
  const quality = childMappings(lines, jobs.get('quality') ?? { index: lines.length, indent: -1 })
  const steps = sequenceItems(
    lines,
    (quality.get('steps') ?? { index: lines.length, indent: -1 }).index + 1,
    (quality.get('steps') ?? { index: lines.length, indent: -1 }).indent
  )
  const commands = steps.filter(({ key }) => key === 'run').map(({ value }) => value)
  const setupNode = steps.find(
    ({ key, value }) => key === 'uses' && value.startsWith('actions/setup-node@')
  )
  const setupNodeWith = setupNode ? childMappings(lines, setupNode).get('with') : undefined
  const setupNodeOptions = setupNodeWith ? childMappings(lines, setupNodeWith) : new Map()
  const errors = []

  if (!matchesRequiredCommands(commands)) {
    errors.push({ rule: 'run-commands' })
  }
  if (!on.has('pull_request')) {
    errors.push({ rule: 'pull-request-trigger' })
  }
  if (!on.has('push')) {
    errors.push({ rule: 'push-trigger' })
  }
  if (concurrency.get('group')?.value !== '${{ github.workflow }}-${{ github.ref }}') {
    errors.push({ rule: 'concurrency-key' })
  }
  if (concurrency.get('cancel-in-progress')?.value !== 'true') {
    errors.push({ rule: 'concurrency-cancellation' })
  }
  if (permissionCount !== 1 || permissions.get('contents')?.value !== 'read') {
    errors.push({ rule: 'read-only-permissions' })
  }
  if (!steps.some(({ key, value }) => key === 'uses' && value.startsWith('actions/checkout@'))) {
    errors.push({ rule: 'checkout' })
  }
  if (!steps.some(({ key, value }) => key === 'uses' && value.startsWith('pnpm/action-setup@'))) {
    errors.push({ rule: 'pnpm-setup' })
  }
  if (setupNodeOptions.get('cache')?.value !== 'pnpm') errors.push({ rule: 'node-pnpm-cache' })
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
