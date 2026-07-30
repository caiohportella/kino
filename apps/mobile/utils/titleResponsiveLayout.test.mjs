import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const titleResponsiveLayout = await import('./titleResponsiveLayout.ts').catch(() => null)
const source = await readFile(new URL('../app/title/[id].tsx', import.meta.url), 'utf8')
const hero = source.slice(
  source.indexOf('{/* Hero Section */}'),
  source.indexOf('{/* Action Buttons */}')
)

function openingTextTagForExpression(input, expression) {
  const expressionIndex = input.indexOf(expression)
  assert.ok(expressionIndex >= 0, `missing title expression ${expression}`)
  const tagStart = input.lastIndexOf('<Text', expressionIndex)
  const tagEnd = input.indexOf('>', tagStart)
  assert.ok(tagStart >= 0 && tagEnd > tagStart, `missing Text node for ${expression}`)
  return input.slice(tagStart, tagEnd + 1)
}

function assertCompleteTitleIsVisible(input) {
  const titleTag = openingTextTagForExpression(input, '{title.title}')
  assert.doesNotMatch(
    titleTag,
    /\b(?:numberOfLines|ellipsizeMode|lineBreakMode)\s*=/,
    'the title Text node must not use a truncation prop'
  )
  assert.doesNotMatch(
    titleTag.match(/className="([^"]*)"/)?.[1] ?? '',
    /(?:^|\s)(?:truncate|line-clamp-\S+|overflow-hidden)(?:\s|$)/,
    'the title Text node must not use a truncation class'
  )
}

function classTokens(input, pattern) {
  const className = input.match(pattern)?.[1]
  assert.ok(className, `missing class contract for ${pattern}`)
  return new Set(className.split(/\s+/))
}

test('mobile title identity is centered and the complete title remains visible', () => {
  assert.match(source, /<View className="-mt-12 mb-6 items-center px-4">/)
  const poster = classTokens(
    hero,
    /source=\{\{ uri: title\.coverImage \}\}[\s\S]{0,200}?className="([^"]+)"/
  )
  assert.ok(poster.has('mb-4'))
  assert.ok(poster.has('h-36'))
  assert.ok(poster.has('w-24'))
  assert.match(source, /<View className="w-full items-center pb-2">/)
  assert.match(
    source,
    /<Text className="[^"]*\btext-center\b[^"]*\btext-2xl\b[^"]*">\s*\{title\.title\}\s*<\/Text>/
  )
  assertCompleteTitleIsVisible(source)
  assert.match(source, /className="mt-2 self-center[^"]*"/)
})

for (const [name, input, expected] of [
  ['year only', { genres: [], year: 2026 }, [{ key: 'year', label: '2026' }]],
  [
    'genres only',
    {
      genres: [
        { id: 18, name: 'Drama' },
        { id: 53, name: 'Thriller' },
      ],
      year: 0,
    },
    [
      { key: 'genre-18', label: 'Drama' },
      { key: 'genre-53', label: 'Thriller' },
    ],
  ],
  [
    'year and genres',
    {
      genres: [
        { id: 12, name: 'Adventure' },
        { id: 14, name: 'Fantasy' },
        { id: 878, name: 'Science Fiction' },
      ],
      year: 2001,
    },
    [
      { key: 'year', label: '2001' },
      { key: 'genre-12', label: 'Adventure' },
      { key: 'genre-14', label: 'Fantasy' },
    ],
  ],
  ['neither', { genres: [], year: 0 }, []],
]) {
  test(`mobile title metadata renders ${name}`, () => {
    const buildTitleIdentityMetadata = titleResponsiveLayout?.buildTitleIdentityMetadata
    assert.equal(
      typeof buildTitleIdentityMetadata,
      'function',
      'the title identity metadata presenter must exist'
    )
    assert.deepEqual(buildTitleIdentityMetadata(input), expected)
  })
}

test('mobile metadata uses the tested presentation and lets values wrap', () => {
  assert.match(source, /const identityMetadata = buildTitleIdentityMetadata\(/)
  assert.match(source, /\{identityMetadata\.length > 0 \? \(/)
  assert.match(
    source,
    /className="[^"]*\bflex-row\b[^"]*\bflex-wrap\b[^"]*\bjustify-center\b[^"]*"/
  )
  assert.match(source, /identityMetadata\.map\(\(item\) => \(/)
})

for (const [name, prop] of [
  ['numeric numberOfLines', 'numberOfLines={1}'],
  ['dynamic numberOfLines', 'numberOfLines={titleLineLimit}'],
  ['ellipsizeMode', 'ellipsizeMode="tail"'],
  ['lineBreakMode', 'lineBreakMode="tail"'],
]) {
  test(`title truncation contract rejects ${name} on the title node`, () => {
    const titleTag = openingTextTagForExpression(source, '{title.title}')
    const mutatedTitleTag = titleTag.replace('>', ` ${prop}>`)
    const mutatedSource = source.replace(titleTag, mutatedTitleTag)
    assert.throws(
      () => assertCompleteTitleIsVisible(mutatedSource),
      /title Text node must not use a truncation prop/
    )
  })
}

test('mobile long content stays left aligned and ticket action owns the available width', () => {
  assert.match(
    source,
    /Get Tickets Button[\s\S]{0,160}<TouchableOpacity[\s\S]{0,100}className="[^"]*\bw-full\b[^"]*"/
  )
  assert.match(
    source,
    /const searchUrl = `https:\/\/www\.ingresso\.com\.br\/busca\/resultado\?q=\$\{encodeURIComponent\(title\.title \?\? ''\)\}`/
  )
  assert.match(
    source,
    /Synopsis[\s\S]{0,100}<View className="[^"]*\bitems-start\b[^"]*">[\s\S]{0,100}<Text className="[^"]*\btext-left\b[^"]*\bleading-6\b/
  )
})
