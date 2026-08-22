import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('discover uses comfortable media rows', async () => {
  const source = await readFile(
    new URL('../../../components/discover/discover-client.tsx', import.meta.url),
    'utf8'
  )

  assert.match(source, /density="comfortable"/)
})

test('comfortable media rows have wide-desktop geometry', async () => {
  const css = await readFile(
    new URL('../../../app/globals.css', import.meta.url),
    'utf8'
  )

  assert.match(css, /\.media-row--comfortable/)
  assert.match(css, /grid-auto-columns:\s*clamp\(180px,\s*10vw,\s*196px\)/)
})

test('trending carousel uses viewport-aware desktop height', async () => {
  const source = await readFile(
    new URL('../../../components/carousel/trending-carousel.tsx', import.meta.url),
    'utf8'
  )

  assert.match(source, /lg:h-\[clamp\(450px,55vh,660px\)\]/)
})
