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

  assert.match(route, /ratings\.mostRatedGenre/)
  assert.match(route, /ratings\.highestRatedGenre/)
  assert.match(route, /ratings\.highestRatedStudio/)
  assert.match(route, /ratings\.highestRatedActor/)
  assert.match(route, /ratings\.highestRatedActress/)

  assert.doesNotMatch(route, /const topStudio = viewing\.studioStats\[0\]/)
})

test('lifetime recap does not append the host twice', async () => {
  const route = await readFile(
    new URL('../app/api/[username]/stats/recap/lifetime/route.ts', import.meta.url),
    'utf8'
  )

  assert.doesNotMatch(route, /labels\.trackYoursAt,\s*" ",\s*host/)
})

test('monthly story assigns series runner-up ranks starting at two', async () => {
  const route = await readFile(
    new URL('../app/api/[username]/stats/recap/[year]/[month]/route.ts', import.meta.url),
    'utf8'
  )

  assert.match(route, /seriesRunnersUp[\s\S]*index \+ 2/)
  assert.doesNotMatch(route, /seriesRunnersUp[\s\S]*index \+ 1/)
})
