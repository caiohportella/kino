import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(new URL('../app/title/[id].tsx', import.meta.url), 'utf8')
const hero = source.slice(
  source.indexOf('{/* Hero Section */}'),
  source.indexOf('{/* Action Buttons */}')
)

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
  assert.doesNotMatch(source, /<Text[^>]*numberOfLines=\{2\}[^>]*>\s*\{title\.title\}/)
  assert.match(source, /className="mt-2 self-center[^"]*"/)
})

test('mobile metadata omits missing values and lets genres wrap as centered identity', () => {
  assert.match(source, /\{title\.year \|\| title\.genres\.length > 0 \? \(/)
  assert.match(
    source,
    /className="[^"]*\bflex-row\b[^"]*\bflex-wrap\b[^"]*\bjustify-center\b[^"]*"/
  )
  assert.match(source, /\{title\.year \? \([\s\S]{0,120}\{title\.year\}[\s\S]{0,40}: null\}/)
  assert.match(source, /title\.genres\.slice\(0, 2\)\.map\(\(genre\) => \(/)
})

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
