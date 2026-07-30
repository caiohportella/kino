import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

async function readComponent(path) {
  return readFile(new URL(path, import.meta.url), 'utf8').catch(() => '')
}

test('profile rows reuse draggable controls without stealing nested keyboard interactions', async () => {
  const source = await readComponent('../components/profile-horizontal-row.tsx')

  assert.match(source, /import \{ MediaRow \}/)
  assert.match(source, /isInteractiveProfileRowTarget\(event\.target\)/)
  assert.match(source, /event\.key !== 'ArrowLeft'/)
  assert.match(source, /event\.key !== 'ArrowRight'/)
  assert.match(source, /event\.currentTarget\.scrollBy/)
  assert.match(source, /tabIndex=\{0\}/)
  assert.match(source, /role="region"/)
})

test('profile review row previews mobile overflow and fits exactly two desktop cards from one gap', async () => {
  const source = await readComponent('../components/reviews/profile-reviews-section.tsx')

  assert.match(source, /\[--profile-row-gap:1rem\]/)
  assert.match(source, /gap-\[var\(--profile-row-gap\)\]/)
  assert.match(source, /auto-cols-\[calc\(100%-2rem\)\]/)
  assert.match(source, /auto-cols-\[calc\(\(100%-var\(--profile-row-gap\)\)\/2\)\]/)
  assert.match(source, /<ProfileHorizontalRow/)
})

test('profile row retains a bounded scroll position when its stable children refresh', async () => {
  const source = await readComponent('../components/profile-horizontal-row.tsx')

  assert.match(source, /scrollPositionRef/)
  assert.match(source, /useLayoutEffect/)
  assert.match(source, /Math\.min\(scrollPositionRef\.current, maxScrollLeft\)/)
  assert.match(source, /onScroll=/)
})

test('profile review loading uses two geometry-matched skeleton cards', async () => {
  const section = await readComponent('../components/reviews/profile-reviews-section.tsx')
  const skeleton = await readComponent('../components/reviews/profile-review-skeleton.tsx')

  assert.match(section, /Array\.from\(\{ length: 2 \}/)
  assert.match(section, /<ProfileReviewSkeleton/)
  assert.match(skeleton, /min-h-56/)
  assert.match(skeleton, /grid-cols-\[76px_minmax\(0,1fr\)\]/)
})
