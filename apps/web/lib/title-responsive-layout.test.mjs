import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(new URL('../app/title/[id]/page.tsx', import.meta.url), 'utf8')
const titleHeader = source.slice(
  source.indexOf('function TitleHeader('),
  source.indexOf('function WatchlistPicker(')
)

function classTokens(input, pattern) {
  const className = input.match(pattern)?.[1]
  assert.ok(className, `missing class contract for ${pattern}`)
  return new Set(className.split(/\s+/))
}

test('title hero centers only its mobile identity and restores desktop alignment', () => {
  const poster = classTokens(titleHeader, /<Poster\s+className="([^"]+)"/)
  const metadata = classTokens(titleHeader, /className="(mb-2 [^"]*text-kino-muted[^"]*)"/)
  const heading = classTokens(titleHeader, /<h1 className="([^"]+)"/)
  const genres = classTokens(
    titleHeader,
    /title\.genres\.length > 0[\s\S]{0,120}className="([^"]+)"/
  )

  assert.ok(poster.has('mx-auto'))
  assert.ok(poster.has('md:mx-0'))
  assert.ok(poster.has('md:w-full'))
  assert.ok(metadata.has('justify-center'))
  assert.ok(metadata.has('md:justify-start'))
  assert.ok(heading.has('text-center'))
  assert.ok(heading.has('md:text-left'))
  assert.ok(heading.has('md:text-4xl'))
  assert.ok(genres.has('flex-wrap'))
  assert.ok(genres.has('justify-center'))
  assert.ok(genres.has('md:justify-start'))
})

test('title hero keeps long and optional content readable without duplicating the hero', () => {
  assert.match(source, /<span>\{title\.year \|\| 'TBA'\}<\/span>/)
  assert.match(source, /title\.runtime \? <span>\{formatRuntime\(title\.runtime\)\}<\/span> : null/)
  assert.match(source, /title\.genres\.length > 0 \?/)
  const upcomingSeason = classTokens(
    titleHeader,
    /upcomingSeason \?[\s\S]{0,240}className="([^"]+)"/
  )
  assert.ok(upcomingSeason.has('max-w-full'))
  assert.ok(upcomingSeason.has('text-left'))
  assert.match(
    source,
    /<p className="[^"]*\bmax-w-4xl\b[^"]*\btext-left\b[^"]*\bleading-7\b[^"]*">[\s\S]*?\{title\.synopsis \|\|/
  )
  assert.equal(source.match(/function TitleHeader\(/g)?.length, 1)
  assert.equal(source.match(/<TitleHeader /g)?.length, 1)
})

test('cinema ticket link owns mobile width while retaining intrinsic desktop sizing', () => {
  assert.match(
    source,
    /<Link className="[^"]*\bw-full\b[^"]*\bsm:w-auto\b" href=\{ticketsUrl\} target="_blank">/
  )
  assert.match(
    source,
    /const ticketsUrl = `https:\/\/www\.ingresso\.com\.br\/busca\/resultado\?q=\$\{encodeURIComponent\(title\.title\)\}`/
  )
})
