import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const TRANSLATION_KEY = /^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)+$/

const englishCatalogPath = fileURLToPath(
  new URL('../packages/i18n/generated/en-GB.json', import.meta.url)
)

let englishCatalog = {}

try {
  englishCatalog = JSON.parse(readFileSync(englishCatalogPath, 'utf8'))
} catch {
  // Extraction can still work before the first Tolgee pull.
}

function readCatalogValue(key) {
  let current = englishCatalog

  for (const segment of key.split('.')) {
    if (typeof current !== 'object' || current === null || !(segment in current)) {
      return undefined
    }

    current = current[segment]
  }

  return typeof current === 'string' ? current : undefined
}

function readStringLiteral(code, quoteIndex) {
  const quote = code[quoteIndex]

  if (!['"', "'", '`'].includes(quote)) {
    return null
  }

  let value = ''

  for (let index = quoteIndex + 1; index < code.length; index += 1) {
    const char = code[index]

    if (char === '\\') {
      const next = code[index + 1]

      if (next !== undefined) {
        value += next
        index += 1
      }

      continue
    }

    if (char === quote) {
      return {
        value,
        end: index + 1,
      }
    }

    value += char
  }

  return null
}

function findCallEnd(code, start) {
  let depth = 1
  let quote = null

  for (let index = start; index < code.length; index += 1) {
    const char = code[index]

    if (quote) {
      if (char === '\\') {
        index += 1
        continue
      }

      if (char === quote) {
        quote = null
      }

      continue
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char
      continue
    }

    if (char === '(') {
      depth += 1
      continue
    }

    if (char === ')') {
      depth -= 1

      if (depth === 0) {
        return index
      }
    }
  }

  return code.length
}

function readInlineDefaultValue(callSource) {
  const match = /\bdefaultValue\s*:\s*(["'`])/.exec(callSource)

  if (!match || match.index === undefined) {
    return undefined
  }

  const quoteIndex = match.index + match[0].length - 1
  const literal = readStringLiteral(callSource, quoteIndex)

  if (!literal || literal.value.includes('${')) {
    return undefined
  }

  return literal.value
}

function isIdentifierCharacter(char) {
  return char !== undefined && /[A-Za-z0-9_$]/.test(char)
}

/**
 * Starting immediately after a property value, find another
 * string property on the same object literal.
 *
 * This lets declarations such as:
 *
 * titleKey: "discover.collections.starWars.title",
 * titleDefault: "Star Wars",
 *
 * participate in extraction without requiring a duplicate t()
 * call solely for Tolgee.
 */
function readSameObjectStringProperty(code, start, propertyName) {
  let objectDepth = 0
  let quote = null
  let lineComment = false
  let blockComment = false

  for (let index = start; index < code.length; index += 1) {
    const char = code[index]
    const next = code[index + 1]

    if (lineComment) {
      if (char === '\n') {
        lineComment = false
      }

      continue
    }

    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false
        index += 1
      }

      continue
    }

    if (quote) {
      if (char === '\\') {
        index += 1
        continue
      }

      if (char === quote) {
        quote = null
      }

      continue
    }

    if (char === '/' && next === '/') {
      lineComment = true
      index += 1
      continue
    }

    if (char === '/' && next === '*') {
      blockComment = true
      index += 1
      continue
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char
      continue
    }

    if (char === '{') {
      objectDepth += 1
      continue
    }

    if (char === '}') {
      if (objectDepth === 0) {
        return undefined
      }

      objectDepth -= 1
      continue
    }

    if (objectDepth !== 0) {
      continue
    }

    if (!code.startsWith(propertyName, index)) {
      continue
    }

    const previousChar = code[index - 1]
    const afterName = code[index + propertyName.length]

    if (isIdentifierCharacter(previousChar) || isIdentifierCharacter(afterName)) {
      continue
    }

    let cursor = index + propertyName.length

    while (/\s/.test(code[cursor] ?? '')) {
      cursor += 1
    }

    if (code[cursor] !== ':') {
      continue
    }

    cursor += 1

    while (/\s/.test(code[cursor] ?? '')) {
      cursor += 1
    }

    const literal = readStringLiteral(code, cursor)

    if (!literal || literal.value.includes('${')) {
      return undefined
    }

    return literal.value
  }

  return undefined
}

function pushTranslation(keys, seen, { keyName, line, defaultValue }) {
  if (!TRANSLATION_KEY.test(keyName)) {
    return
  }

  if (seen.has(keyName)) {
    return
  }

  seen.add(keyName)

  keys.push({
    keyName,
    line,
    ...(defaultValue !== undefined ? { defaultValue } : {}),
  })
}

function extractLiteralTranslationCalls(code, keys, seen) {
  const pattern = /\bt\s*\(\s*(["'`])/g

  for (const match of code.matchAll(pattern)) {
    if (match.index === undefined) continue

    const quoteIndex = match.index + match[0].length - 1
    const keyLiteral = readStringLiteral(code, quoteIndex)

    if (!keyLiteral) continue

    const keyName = keyLiteral.value

    if (keyName.includes('${')) continue

    const callEnd = findCallEnd(code, keyLiteral.end)
    const callSource = code.slice(match.index, callEnd + 1)

    const inlineDefaultValue = readInlineDefaultValue(callSource)
    const catalogDefaultValue = readCatalogValue(keyName)

    pushTranslation(keys, seen, {
      keyName,
      line: code.slice(0, match.index).split('\n').length,
      defaultValue: inlineDefaultValue ?? catalogDefaultValue,
    })
  }
}

/**
 * Extract declarative translation metadata.
 *
 * Supported shape:
 *
 * titleKey: "discover.foo.title",
 * titleDefault: "Foo",
 *
 * descriptionKey: "discover.foo.description",
 * descriptionDefault: "Description",
 *
 * The property prefix is generic, so view labels using
 * titleKey/titleDefault are handled as well.
 */
function extractTranslationMetadata(code, keys, seen) {
  const pattern = /\b([A-Za-z][A-Za-z0-9]*)Key\s*:\s*(["'`])/g

  for (const match of code.matchAll(pattern)) {
    if (match.index === undefined) continue

    const propertyPrefix = match[1]
    const quoteIndex = match.index + match[0].length - 1
    const keyLiteral = readStringLiteral(code, quoteIndex)

    if (!keyLiteral) continue

    const keyName = keyLiteral.value

    if (keyName.includes('${')) continue
    if (!TRANSLATION_KEY.test(keyName)) continue

    const metadataDefaultValue = readSameObjectStringProperty(
      code,
      keyLiteral.end,
      `${propertyPrefix}Default`
    )

    const catalogDefaultValue = readCatalogValue(keyName)

    pushTranslation(keys, seen, {
      keyName,
      line: code.slice(0, match.index).split('\n').length,
      defaultValue: metadataDefaultValue ?? catalogDefaultValue,
    })
  }
}

export default function extractKinoTranslations(code) {
  const keys = []
  const seen = new Set()

  extractLiteralTranslationCalls(code, keys, seen)
  extractTranslationMetadata(code, keys, seen)

  return {
    keys,
  }
}
