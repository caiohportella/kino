import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('profile movie and series rows use larger posters on desktop', async () => {
  const source = await readFile(new URL('../../../app/globals.css', import.meta.url), 'utf8')

  assert.match(source, /\.profile-media-row--large \.media-row-track/)

  assert.match(source, /grid-auto-columns:\s*176px/)

  assert.match(source, /\.profile-media-row--large \.media-row-track > \*/)

  assert.match(source, /width:\s*176px/)
})
