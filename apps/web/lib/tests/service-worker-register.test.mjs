import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const componentUrl = new URL('../../components/service-worker-register.tsx', import.meta.url)

test('removes stale service workers during development', () => {
  const source = readFileSync(componentUrl, 'utf8')

  assert.match(
    source,
    /process\.env\.NODE_ENV !== ["']production["']/,
    'development should explicitly clean up previously installed service workers'
  )

  assert.match(
    source,
    /navigator\.serviceWorker\s*\.getRegistrations\(\)/,
    'development cleanup should inspect existing registrations'
  )

  assert.match(
    source,
    /registration\.unregister\(\)/,
    'development cleanup should unregister stale workers'
  )
})

test('production registration bypasses the browser cache for sw.js', () => {
  const source = readFileSync(componentUrl, 'utf8')

  assert.match(
    source,
    /register\(["']\/sw\.js["'],\s*\{[\s\S]*?updateViaCache:\s*["']none["']/,
    'the service worker script itself should always be checked from the network'
  )
})
