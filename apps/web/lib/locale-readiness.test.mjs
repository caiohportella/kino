import assert from 'node:assert/strict'
import test from 'node:test'
import { createWebLocaleReadiness } from './locale-readiness.ts'

const options = (overrides = {}) => ({
  applyLocale: async () => {},
  fallbackLocale: 'en',
  readPersistedLocale: async () => null,
  supportedLocales: ['en', 'pt', 'fr', 'it', 'no'],
  ...overrides,
})

test('keeps web locale resolving until delayed persistence hydration completes', async () => {
  let resolveRead
  const applied = []
  const readiness = createWebLocaleReadiness(
    options({
      applyLocale: async (locale) => applied.push(locale),
      readPersistedLocale: () =>
        new Promise((resolve) => {
          resolveRead = resolve
        }),
    })
  )

  const hydration = readiness.hydrate()
  assert.deepEqual(readiness.getState(), {
    error: null,
    locale: null,
    status: 'resolving',
  })

  resolveRead('pt')
  assert.deepEqual(await hydration, {
    error: null,
    locale: 'pt',
    status: 'ready',
  })
  assert.deepEqual(applied, ['pt'])
})

test('falls back to the explicit web locale for unsupported persisted values', async () => {
  const readiness = createWebLocaleReadiness(
    options({ readPersistedLocale: async () => 'unsupported-locale' })
  )

  assert.deepEqual(await readiness.hydrate(), {
    error: null,
    locale: 'en',
    status: 'ready',
  })
})

test('resolves web storage errors to fallback locale with serializable metadata', async () => {
  const applied = []
  const readiness = createWebLocaleReadiness(
    options({
      applyLocale: async (locale) => applied.push(locale),
      readPersistedLocale: async () => {
        throw new Error('storage offline')
      },
    })
  )

  assert.deepEqual(await readiness.hydrate(), {
    error: {
      code: 'storage-read-failed',
      message: 'storage offline',
    },
    locale: 'en',
    status: 'error',
  })
  assert.deepEqual(applied, ['en'])
})

test('hydrates web locale persistence only once across concurrent and repeated calls', async () => {
  let reads = 0
  const readiness = createWebLocaleReadiness(
    options({
      readPersistedLocale: async () => {
        reads += 1
        return 'fr'
      },
    })
  )

  const [first, second] = await Promise.all([readiness.hydrate(), readiness.hydrate()])
  const third = await readiness.hydrate()

  assert.equal(reads, 1)
  assert.strictEqual(first, second)
  assert.strictEqual(second, third)
})
