import { readdir, readFile } from 'node:fs/promises'
import { builtinModules, createRequire } from 'node:module'
import { join, relative, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

const requireFromCore = createRequire(new URL('../packages/core/package.json', import.meta.url))
const ts = requireFromCore('typescript')

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

const staticModuleText = (node) =>
  node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    ? node.text
    : undefined

export const parseModuleSpecifiers = (source, fileName = 'module.ts') => {
  const scriptKind = fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, scriptKind)
  const specifiers = []

  const visit = (node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      const specifier = staticModuleText(node.moduleSpecifier)
      if (specifier) specifiers.push(specifier)
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      const specifier = staticModuleText(node.moduleReference.expression)
      if (specifier) specifiers.push(specifier)
    } else if (ts.isCallExpression(node)) {
      const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword
      const isDirectRequire = ts.isIdentifier(node.expression) && node.expression.text === 'require'
      if (isDynamicImport || isDirectRequire) {
        const specifier = staticModuleText(node.arguments[0])
        if (specifier) specifiers.push(specifier)
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
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
      const specifiers = parseModuleSpecifiers(await readFile(path, 'utf8'), path)
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
