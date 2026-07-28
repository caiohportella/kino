import { readdir, readFile } from 'node:fs/promises'
import { builtinModules } from 'node:module'
import { join, relative, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts'])
const NODE_MODULES = new Set(
  builtinModules.flatMap((specifier) => [specifier, specifier.replace(/^node:/u, '')])
)
const PROVIDER_OR_PLATFORM_PREFIXES = [
  '@azure/search-documents',
  '@elastic/',
  '@pinecone-database/',
  '@qdrant/',
  '@supabase/',
  '@upstash/',
  'algoliasearch',
  'expo',
  'ioredis',
  'next',
  'react',
  'react-native',
]
const WORKER_OR_STORAGE_PREFIXES = [
  '@react-native-async-storage/',
  '@temporalio/',
  'agenda',
  'bullmq',
  'inngest',
  'localforage',
  'node-cron',
]

const isIdentifierStart = (character) => /[A-Za-z_$]/u.test(character)
const isIdentifierPart = (character) => /[A-Za-z0-9_$]/u.test(character)

const readStringToken = (source, start) => {
  const quote = source[start]
  let value = ''
  let index = start + 1

  while (index < source.length) {
    const character = source[index]
    if (character === quote) return { end: index + 1, token: { type: 'string', value } }
    if (character === '\\') {
      const escaped = source[index + 1]
      if (escaped === undefined) break
      const escapes = { n: '\n', r: '\r', t: '\t' }
      value += escapes[escaped] ?? escaped
      index += 2
      continue
    }
    value += character
    index += 1
  }

  return { end: source.length, token: null }
}

const skipTemplate = (source, start) => {
  let index = start + 1
  while (index < source.length) {
    if (source[index] === '\\') {
      index += 2
      continue
    }
    if (source[index] === '`') return index + 1
    index += 1
  }
  return source.length
}

const tokenizeModule = (source) => {
  const tokens = []
  let index = 0

  while (index < source.length) {
    const character = source[index]
    const next = source[index + 1]

    if (/\s/u.test(character)) {
      index += 1
      continue
    }
    if (character === '/' && next === '/') {
      index = source.indexOf('\n', index + 2)
      if (index === -1) break
      continue
    }
    if (character === '/' && next === '*') {
      const end = source.indexOf('*/', index + 2)
      index = end === -1 ? source.length : end + 2
      continue
    }
    if (character === "'" || character === '"') {
      const result = readStringToken(source, index)
      if (result.token) tokens.push(result.token)
      index = result.end
      continue
    }
    if (character === '`') {
      index = skipTemplate(source, index)
      continue
    }
    if (isIdentifierStart(character)) {
      let end = index + 1
      while (end < source.length && isIdentifierPart(source[end])) end += 1
      tokens.push({ type: 'identifier', value: source.slice(index, end) })
      index = end
      continue
    }

    tokens.push({ type: 'punctuation', value: character })
    index += 1
  }

  return tokens
}

const findFromSpecifier = (tokens, start) => {
  for (let index = start; index < tokens.length; index += 1) {
    const token = tokens[index]
    if (token.value === ';') return undefined
    if (token.type === 'identifier' && token.value === 'from') {
      return tokens[index + 1]?.type === 'string' ? tokens[index + 1].value : undefined
    }
  }
  return undefined
}

export const parseModuleSpecifiers = (source) => {
  const tokens = tokenizeModule(source)
  const specifiers = []

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]
    const next = tokens[index + 1]
    if (token.type !== 'identifier') continue

    if (token.value === 'import') {
      if (next?.value === '.') continue
      if (next?.value === '(') {
        if (tokens[index + 2]?.type === 'string') specifiers.push(tokens[index + 2].value)
        continue
      }
      if (next?.type === 'string') {
        specifiers.push(next.value)
        continue
      }
      const specifier = findFromSpecifier(tokens, index + 1)
      if (specifier) specifiers.push(specifier)
      continue
    }

    if (token.value === 'export' && ['*', '{', 'type'].includes(next?.value)) {
      const specifier = findFromSpecifier(tokens, index + 1)
      if (specifier) specifiers.push(specifier)
    }
  }

  return specifiers
}

const hasDomainSegment = (specifier, domain) =>
  new RegExp(`(?:^|/)${domain}(?:$|/)`, 'u').test(specifier.replaceAll('\\', '/'))

const startsWithPackage = (specifier, prefix) =>
  specifier === prefix || specifier.startsWith(`${prefix}/`) || specifier.startsWith(prefix)

const indexingViolation = (specifier) => {
  const normalized = specifier.replaceAll('\\', '/')
  if (hasDomainSegment(normalized, 'search')) return 'indexing cannot import the search domain'
  if (normalized.startsWith('node:') || NODE_MODULES.has(normalized)) {
    return 'indexing cannot import Node platform APIs'
  }
  if (PROVIDER_OR_PLATFORM_PREFIXES.some((prefix) => startsWithPackage(normalized, prefix))) {
    return 'indexing cannot import provider or platform packages'
  }
  if (WORKER_OR_STORAGE_PREFIXES.some((prefix) => startsWithPackage(normalized, prefix))) {
    return 'indexing cannot import worker or storage packages'
  }
  if (normalized === 'dotenv' || /(?:^|\/)(?:env|environment)(?:$|[./-])/u.test(normalized)) {
    return 'indexing cannot import environment helpers'
  }
  return undefined
}

const extensionOf = (name) => {
  const dot = name.lastIndexOf('.')
  return dot === -1 ? '' : name.slice(dot)
}

const sourceFiles = async (directory) => {
  const paths = []
  try {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) paths.push(...(await sourceFiles(path)))
      if (entry.isFile() && SOURCE_EXTENSIONS.has(extensionOf(entry.name))) paths.push(path)
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
  return paths
}

export const checkDomainBoundaries = async (root) => {
  const domains = [
    { name: 'indexing', path: join(root, 'packages/core/src/indexing') },
    { name: 'search', path: join(root, 'packages/core/src/search') },
  ]
  const violations = []

  for (const domain of domains) {
    for (const path of await sourceFiles(domain.path)) {
      const specifiers = parseModuleSpecifiers(await readFile(path, 'utf8'))
      for (const specifier of specifiers) {
        const reason =
          domain.name === 'indexing'
            ? indexingViolation(specifier)
            : hasDomainSegment(specifier, 'indexing')
              ? 'search cannot import the indexing domain'
              : undefined
        if (!reason) continue
        const sourcePath = relative(root, path).split(sep).join('/')
        violations.push(`${sourcePath} imports "${specifier}": ${reason}`)
      }
    }
  }

  return violations.sort()
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const violations = await checkDomainBoundaries(process.argv[2] ?? process.cwd())
  if (violations.length > 0) {
    process.stderr.write(`Domain boundary violations:\n${violations.join('\n')}\n`)
    process.exitCode = 1
  } else {
    process.stdout.write('Domain boundaries passed.\n')
  }
}
