import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

async function readComponent(path) {
  return readFile(new URL(path, import.meta.url), 'utf8').catch(() => '')
}

test('profile rows reuse draggable controls without stealing nested keyboard interactions', async () => {
  const source = await readComponent('../components/profile-horizontal-row.tsx')

  assert.match(source, /import \{ MediaRow \}/)
  assert.match(source, /isInteractiveMediaRowTarget\(event\.target\)/)
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
  const card = await readComponent('../components/reviews/profile-review-card.tsx')
  const skeleton = await readComponent('../components/reviews/profile-review-skeleton.tsx')
  const cardPosterColumn = card.match(/grid-cols-\[(\d+)px_minmax\(0,1fr\)\]/)?.[1]
  const skeletonPosterColumn = skeleton.match(/grid-cols-\[(\d+)px_minmax\(0,1fr\)\]/)?.[1]

  assert.match(section, /Array\.from\(\{ length: 2 \}/)
  assert.match(section, /<ProfileReviewSkeleton/)
  assert.match(skeleton, /min-h-56/)
  assert.equal(cardPosterColumn, '76')
  assert.equal(skeletonPosterColumn, cardPosterColumn)
  assert.match(skeleton, /aspect-2\/3 w-full/)
  assert.doesNotMatch(skeleton, /\bw-18\b/)
})

test('media row drag initiation bypasses interactive descendants but preserves shelf dragging', async () => {
  const interactions = await import('./media-row-interactions.ts').catch(() => null)
  assert.ok(interactions, 'shared media-row interaction predicate must exist')

  const pointer = (closestMatch) => ({
    button: 0,
    pointerType: 'mouse',
    target: {
      closest(selector) {
        const selectors = selector.split(',').map((item) => item.trim())
        return selectors.includes(closestMatch) ? {} : null
      },
    },
  })

  assert.equal(interactions.shouldStartMediaRowDrag(pointer('textarea')), false)
  assert.equal(
    interactions.shouldStartMediaRowDrag(
      pointer('[contenteditable]:not([contenteditable="false"])')
    ),
    false
  )
  assert.equal(interactions.shouldStartMediaRowDrag(pointer('button')), false)
  assert.equal(interactions.shouldStartMediaRowDrag(pointer('a')), true)
  assert.equal(
    interactions.shouldStartMediaRowDrag({
      button: 0,
      pointerType: 'mouse',
      target: { closest: () => null },
    }),
    true
  )
})

test('media row applies the interactive-target guard before recording a drag pointer', async () => {
  const source = await readComponent('../components/media-row.tsx')
  const pointerDown = source.indexOf('onPointerDown(event')
  const guard = source.indexOf('if (!shouldStartMediaRowDrag(event)) return', pointerDown)
  const pointerAssignment = source.indexOf(
    'dragState.current.pointerId = event.pointerId',
    pointerDown
  )

  assert.ok(pointerDown >= 0)
  assert.ok(guard > pointerDown)
  assert.ok(pointerAssignment > guard)
})
