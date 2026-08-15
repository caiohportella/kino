import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('lifetime recap route renders a downloadable story image', async () => {
  const route = await readFile(
    new URL('../app/api/[username]/stats/recap/lifetime/route.ts', import.meta.url),
    'utf8'
  )

  assert.match(route, /new ImageResponse/)
  assert.match(route, /width:\s*1080/)
  assert.match(route, /height:\s*1920/)

  assert.match(route, /content-disposition/i)
  assert.match(route, /attachment/)
})

test('lifetime recap uses the canonical rating highlights', async () => {
  const route = await readFile(
    new URL('../app/api/[username]/stats/recap/lifetime/route.ts', import.meta.url),
    'utf8'
  )

  assert.match(route, /recap\.mostRatedGenre/)
  assert.match(route, /recap\.highestRatedGenre/)
  assert.match(route, /recap\.highestRatedStudio/)
  assert.match(route, /recap\.highestRatedActor/)
  assert.match(route, /recap\.highestRatedActress/)

  assert.doesNotMatch(route, /const topStudio = viewing\.studioStats\[0\]/)
})

test('lifetime recap does not append the host twice', async () => {
  const route = await readFile(
    new URL('../app/api/[username]/stats/recap/lifetime/route.ts', import.meta.url),
    'utf8'
  )

  assert.doesNotMatch(route, /labels\.trackYoursAt,\s*" ",\s*host/)
})

test('lifetime recap route uses the shared story composition contract', async () => {
  const route = await readFile(
    new URL('../app/api/[username]/stats/recap/lifetime/route.ts', import.meta.url),
    'utf8'
  )
  const helper = await readFile(
    new URL('./profile-lifetime-recap-story.ts', import.meta.url),
    'utf8'
  )
  const storySource = `${route}\n${helper}`

  assert.match(route, /getProfileLifetimeRecapByProfileId/)
  assert.match(route, /created_at/)
  assert.match(storySource, /sinceBeginning/)
  assert.match(storySource, /lifetimeHeadline/)
  assert.match(storySource, /kinoTimeYears|kinoTimeMonths|kinoTimeDays/)
  assert.match(storySource, /movieRunnersUp[\s\S]*index \+ 2/)
  assert.match(storySource, /seriesRunnersUp[\s\S]*index \+ 2/)
  assert.doesNotMatch(route, /StatsPills/)
  assert.doesNotMatch(route, /toFixed\(1\).*\/ 5/)
})

test('monthly story assigns series runner-up ranks starting at two', async () => {
  const route = await readFile(
    new URL('../app/api/[username]/stats/recap/[year]/[month]/route.ts', import.meta.url),
    'utf8'
  )

  assert.match(route, /seriesRunnersUp[\s\S]*index \+ 2/)
  assert.doesNotMatch(route, /seriesRunnersUp[\s\S]*index \+ 1/)
})

test('monthly recap resolves its identity server-side instead of trusting caller parameters', async () => {
  const route = await readFile(
    new URL('../app/api/[username]/stats/recap/[year]/[month]/route.ts', import.meta.url),
    'utf8'
  )

  assert.match(route, /const profile = await getProfile\(username\)/)
  assert.doesNotMatch(route, /searchParams\.get\('profileId'\)/)
  assert.doesNotMatch(route, /searchParams\.get\('displayName'\)/)
})
