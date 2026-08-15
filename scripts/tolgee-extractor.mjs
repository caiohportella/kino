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

export default function extractKinoTranslations(code) {
  const keys = []
  const seen = new Set()

  const pattern = /\bt\s*\(\s*(["'`])/g

  for (const match of code.matchAll(pattern)) {
    if (match.index === undefined) continue

    const quoteIndex = match.index + match[0].length - 1

    const keyLiteral = readStringLiteral(code, quoteIndex)

    if (!keyLiteral) continue

    const keyName = keyLiteral.value

    if (keyName.includes('${')) continue
    if (!TRANSLATION_KEY.test(keyName)) continue
    if (seen.has(keyName)) continue

    const callEnd = findCallEnd(code, keyLiteral.end)
    const callSource = code.slice(match.index, callEnd + 1)

    const inlineDefaultValue = readInlineDefaultValue(callSource)

    const catalogDefaultValue = readCatalogValue(keyName)

    const defaultValue = inlineDefaultValue ?? catalogDefaultValue

    const line = code.slice(0, match.index).split('\n').length

    seen.add(keyName)

    keys.push({
      keyName,
      line,
      ...(defaultValue !== undefined ? { defaultValue } : {}),
    })
  }

  return {
    keys,
  }
}
