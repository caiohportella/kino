import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('profile OG data and layout include the authoritative Reviews metric', async () => {
  const [server, og, publicRoute, settingsRoute] = await Promise.all([
    readFile(new URL('../../server-supabase.ts', import.meta.url), 'utf8'),
    readFile(new URL('../../og/og.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../../../app/api/og/profile/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../../../app/api/og/settings/route.ts', import.meta.url), 'utf8'),
  ])

  assert.match(server, /reviews:\s*toSafeCount\(data\.review_count/)
  assert.match(og, /\['Reviews', data\.reviews\]/)
  assert.match(publicRoute, /reviews:\s*0/)
  assert.match(settingsRoute, /reviews:\s*0/)
})
