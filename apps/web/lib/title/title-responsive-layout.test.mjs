import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const titlePageSource = await readFile(
  new URL('../../components/title/title-page.tsx', import.meta.url),
  'utf8'
)

const titleHeaderSource = await readFile(
  new URL('../../components/title/title-header.tsx', import.meta.url),
  'utf8'
)

const titleActionsSource = await readFile(
  new URL('../../components/title/title-actions.tsx', import.meta.url),
  'utf8'
)

function classTokens(input, pattern) {
  const className = input.match(pattern)?.[1]
  assert.ok(className, `missing class contract for ${pattern}`)
  return new Set(className.split(/\s+/))
}

test('title hero centers its mobile identity and restores desktop alignment', () => {
  const poster = classTokens(titleHeaderSource, /<Poster[\s\S]*?className="([^"]+)"/)

  const metadata = classTokens(
    titleHeaderSource,
    /className="([^"]*justify-center[^"]*lg:justify-start[^"]*)"/
  )

  assert.ok(poster.has('w-full'))
  assert.ok(poster.has('border'))

  assert.ok(metadata.has('justify-center'))
  assert.ok(metadata.has('lg:justify-start'))

  assert.ok(metadata.has('justify-center'))
  assert.ok(metadata.has('lg:justify-start'))
})

test('title hero keeps long and optional metadata readable without duplicating the hero', () => {
  assert.match(titleHeaderSource, /\{title\.year \|\| ["']TBA["']\}/)

  assert.match(titleHeaderSource, /title\.runtime/)

  assert.match(titleHeaderSource, /title\.genres/)

  assert.match(titleHeaderSource, /upcomingSeason/)

  assert.match(titleHeaderSource, /max-w-full/)

  assert.equal(titleHeaderSource.match(/export function TitleHeader\(/g)?.length, 1)

  assert.match(titlePageSource, /<TitleHeader/)
})

test('cinema ticket link owns mobile width while retaining intrinsic desktop sizing', () => {
  const tickets = classTokens(
    titleActionsSource,
    /\{showTickets \? \([\s\S]*?<Button[\s\S]*?className="([^"]+)"[\s\S]*?render=\{[\s\S]*?<Link href=\{ticketsUrl\}/
  )

  assert.ok(tickets.has('w-full'))
  assert.ok(tickets.has('sm:w-auto'))

  assert.match(titleActionsSource, /<Link href=\{ticketsUrl\} rel="noreferrer" target="_blank">/)
})

test('title recommendations use comfortable full-width media density', async () => {
  const source = await readFile(
    new URL('../../components/title/title-context.tsx', import.meta.url),
    'utf8'
  )

  assert.match(source, /className="media-row--comfortable"/)
  assert.match(source, /overflowAware/)
})
