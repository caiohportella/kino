import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('own profile hero actions stay in one responsive row', async () => {
  const source = await readFile(
    new URL('../../../components/profile/profile-hero-identity.tsx', import.meta.url),
    'utf8'
  )

  assert.match(
    source,
    /const actionGroupClassName = isOwnProfile\s*\n\s*\? '[^']*grid grid-cols-3 gap-2 lg:flex lg:flex-wrap lg:items-center lg:gap-3/,
    'own-profile actions should use three equal mobile columns and the existing desktop flex layout'
  )
  assert.match(
    source,
    /const actionButtonClassName = isOwnProfile\s*\n\s*\? '[^']*w-full[^']*'\s*:\s*undefined/,
    'mobile action buttons should fill their grid columns'
  )

  const settingsAction = source.match(/\{isOwnProfile \? \([\s\S]*?\) : null\}/)?.[0]

  assert.ok(settingsAction, 'the settings action should be gated by the own-profile condition')
  assert.match(settingsAction, /href="\/settings"/)
  assert.match(settingsAction, /t\('common\.settings'\)/)
  assert.match(settingsAction, /<Settings/)
})
