import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const cardUrl = new URL(
  '../../../components/discover/discover-friend-activity-card.tsx',
  import.meta.url
)

const rowUrl = new URL(
  '../../../components/discover/discover-friends-activity.tsx',
  import.meta.url
)

test('friends activity uses the standard Discover poster presentation', async () => {
  const source = await readFile(cardUrl, 'utf8')

  assert.match(
    source,
    /import\s+\{\s*Poster\s*\}\s+from\s+['"]@\/components\/kino['"]/,
    'friends activity should use the shared Poster component'
  )

  assert.doesNotMatch(
    source,
    /<ActivitySummary item=\{item\}/,
    'activity metadata should no longer render underneath the poster'
  )

  assert.match(
    source,
    /<Poster[\s\S]*artworkOverlay=\{<FriendActivityOverlay item=\{item\}/,
    'friends activity should render its social presentation inside the shared Poster'
  )

  assert.match(
    source,
    /showHoverPresentation=\{false\}/,
    'friends activity should replace the default Poster hover content without disabling Poster interaction'
  )

  assert.doesNotMatch(
    source,
    /hoverMeta=/,
    'friends activity should not use the default hover metadata area'
  )

  assert.doesNotMatch(
    source,
    /group-hover:scale-\[1\.025\]/,
    'friends activity should not maintain a separate poster hover animation'
  )
})

test('friends activity hover shows friend-specific ratings', async () => {
  const source = await readFile(cardUrl, 'utf8')

  assert.match(
    source,
    /item\.activities/,
    'hover metadata should derive from the individual grouped activities'
  )

  assert.match(
    source,
    /activity\.rating\s*!=\s*null/,
    'hover metadata should identify activities that contain ratings'
  )

  assert.match(
    source,
    /activity\.actor/,
    'each hover rating should remain associated with its friend'
  )
})

test('friends activity keeps the primary friend visible inside the poster', async () => {
  const source = await readFile(cardUrl, 'utf8')

  assert.match(
    source,
    /artworkOverlay=\{<FriendActivityOverlay item=\{item\}/,
    'the persistent friend activity should render inside the poster'
  )

  assert.match(
    source,
    /item\.latestActivity/,
    'the latest friend activity should remain the primary visible activity'
  )

  assert.match(
    source,
    /formatLocalizedRelativeTime/,
    'the primary friend activity should retain its relative date'
  )

  assert.match(source, /activity\.actor/, 'the visible activity should include the friend identity')
})

test('friends activity expands inside the poster to reveal additional friends', async () => {
  const source = await readFile(cardUrl, 'utf8')

  assert.match(
    source,
    /item\.activities/,
    'the overlay should derive additional friends from grouped title activity'
  )

  assert.match(source, /group-hover:/, 'additional friend activity should expand on poster hover')

  assert.match(
    source,
    /activity\.rating\s*!=\s*null/,
    'rated friend activity should display its rating'
  )

  assert.match(source, /formatStars/, 'friend ratings should use the existing star presentation')
})

test('friends section matches comfortable Discover section typography and spacing', async () => {
  const source = await readFile(rowUrl, 'utf8')

  assert.match(
    source,
    /mb-12[\s\S]*lg:mb-14/,
    'friends activity should use comfortable Discover section spacing'
  )

  assert.match(
    source,
    /text-xl[\s\S]*lg:text-2xl/,
    'friends activity heading should match comfortable MediaSection headings'
  )

  assert.match(
    source,
    /mb-5/,
    'friends activity header should use the same spacing as comfortable MediaSection headers'
  )

  assert.match(
    source,
    /media-row--comfortable/,
    'friends activity should use the comfortable Discover media-row density'
  )
})

test('friends activity uses a compact additional-friends cue before hover', async () => {
  const source = await readFile(cardUrl, 'utf8')

  assert.match(
    source,
    /additionalCount=\{additionalFriendCount\}/,
    'the primary activity should indicate how many other friends interacted with the title'
  )

  assert.doesNotMatch(
    source,
    /stackedActors=/,
    'the resting state should not crowd the card with stacked avatars'
  )
})

test('friends activity prefers a rated activity over a plain watch for the same friend', async () => {
  const source = await readFile(cardUrl, 'utf8')

  assert.match(
    source,
    /getRepresentativeFriendActivities/,
    'friend rows should choose one representative activity per actor'
  )

  assert.match(
    source,
    /rating\s*!=\s*null/,
    'a rated activity should be preferred when the same friend also has a watch activity'
  )
})

test('additional friend cue changes when hover reveals everyone', async () => {
  const source = await readFile(cardUrl, 'utf8')

  assert.match(
    source,
    /remainingFriends/,
    'the expanded state should know how many friends remain hidden'
  )

  assert.match(source, /group-hover:opacity-0/, 'the resting +N cue should disappear on hover')
})

test('friends activity applies the Kino hover eyebrow to its persistent title', async () => {
  const source = await readFile(cardUrl, 'utf8')

  assert.match(
    source,
    /bg-kino-accent[\s\S]*group-hover:scale-x-100/,
    'the existing title should gain the Kino accent eyebrow on hover'
  )

  assert.doesNotMatch(
    source,
    /hoverMeta=/,
    'friends activity should not restore the default Poster hover presentation'
  )
})
