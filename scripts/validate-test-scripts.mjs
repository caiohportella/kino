import { readFile, readdir } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'))

const workspacePatterns = (manifest) => {
  if (Array.isArray(manifest.workspaces)) return manifest.workspaces
  return manifest.workspaces?.packages ?? []
}

const patternMatches = (pattern, path) => {
  const expression = pattern
    .replace(/[|\\{}()[\]^$+?.]/g, '\\$&')
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*')

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
  const rootManifest = await readJson(join(root, 'package.json'))
  const patterns = workspacePatterns(rootManifest)
  const manifests = await manifestPaths(root)
  const missing = []

  for (const manifestPath of manifests) {
    const packageDirectory = relative(root, manifestPath.slice(0, -'package.json'.length))
      .split(sep)
      .filter(Boolean)
      .join('/')

    if (!patterns.some((pattern) => patternMatches(pattern, packageDirectory))) continue

    const manifest = await readJson(manifestPath)
    if (!manifest.scripts?.test) missing.push(packageDirectory)
  }

  return { missing: missing.sort() }
}
