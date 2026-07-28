import { readdir, readFile } from 'node:fs/promises'
import { dirname, join, relative, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'))

const workspacePatterns = async (root) => {
  const workspaceFile = await readFile(join(root, 'pnpm-workspace.yaml'), 'utf8')
  const lines = workspaceFile.split(/\r?\n/)
  const packagesStart = lines.findIndex((line) => /^packages:\s*$/.test(line))

  if (packagesStart === -1) return []

  const patterns = []
  for (const line of lines.slice(packagesStart + 1)) {
    if (/^\S/.test(line)) break

    const match = line.match(/^\s+-\s+(?:'([^']+)'|"([^"]+)"|([^\s#]+))/)
    if (match) patterns.push(match[1] ?? match[2] ?? match[3])
  }

  return patterns
}

const patternMatches = (pattern, path) => {
  let expression = ''

  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index]

    if (character === '*' && pattern[index + 1] === '*') {
      if (pattern[index + 2] === '/') {
        expression += '(?:.*/)?'
        index += 2
      } else {
        expression += '.*'
        index += 1
      }
      continue
    }

    if (character === '*') {
      expression += '[^/]*'
      continue
    }

    if (character === '?') {
      expression += '[^/]'
      continue
    }

    expression += /[|\\{}()[\]^$+.]/.test(character) ? `\\${character}` : character
  }

  return new RegExp(`^${expression}$`).test(path)
}

const manifestPaths = async (root) => {
  const paths = []

  const visit = async (directory) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue

      const path = join(directory, entry.name)
      if (entry.isDirectory()) await visit(path)
      if (entry.isFile() && entry.name === 'package.json') paths.push(path)
    }
  }

  await visit(root)
  return paths
}

/**
 * Returns workspace package paths whose manifests do not define a test script.
 *
 * @param {string} root
 * @returns {Promise<{ missing: string[] }>}
 */
export const validateWorkspaceScripts = async (root) => {
  const patterns = await workspacePatterns(root)
  const manifests = await manifestPaths(root)
  const missing = []

  for (const manifestPath of manifests) {
    const packageDirectory = relative(root, dirname(manifestPath))
      .split(sep)
      .filter(Boolean)
      .join('/')

    if (!patterns.some((pattern) => patternMatches(pattern, packageDirectory))) continue

    const manifest = await readJson(manifestPath)
    if (!manifest.scripts?.test) missing.push(packageDirectory)
  }

  return { missing: missing.sort() }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const result = await validateWorkspaceScripts(process.argv[2])

  if (result.missing.length > 0) {
    process.stderr.write(`Missing test scripts:\n${result.missing.join('\n')}\n`)
    process.exitCode = 1
  }
}
