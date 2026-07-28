import assert from 'node:assert/strict'
import test from 'node:test'
import { createMobileLocaleReadiness } from './localeReadiness.ts'

const options = (overrides = {}) => ({
  applyLocale: async () => {},
  fallbackLocale: 'en',
  readPersistedLocale: async () => null,
  supportedLocales: ['en', 'pt', 'fr', 'it', 'no'],
  ...overrides,
})

test('keeps mobile locale resolving until delayed AsyncStorage hydration completes', async () => {
  let resolveRead
  const applied = []
  const readiness = createMobileLocaleReadiness(
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

test('falls back to the explicit mobile locale for unsupported stored values', async () => {
  const readiness = createMobileLocaleReadiness(
    options({ readPersistedLocale: async () => 'unsupported-locale' })
  )

  assert.deepEqual(await readiness.hydrate(), {
    error: null,
    locale: 'en',
    status: 'ready',
  })
})

test('resolves AsyncStorage errors to fallback locale with serializable metadata', async () => {
  const applied = []
  const readiness = createMobileLocaleReadiness(
    options({
      applyLocale: async (locale) => applied.push(locale),
      readPersistedLocale: async () => {
        throw new Error('AsyncStorage unavailable')
      },
    })
  )

  assert.deepEqual(await readiness.hydrate(), {
    error: {
      code: 'storage-read-failed',
      message: 'AsyncStorage unavailable',
    },
    locale: 'en',
    status: 'error',
  })
  assert.deepEqual(applied, ['en'])
})

test('hydrates AsyncStorage only once across concurrent and repeated calls', async () => {
  let reads = 0
  const readiness = createMobileLocaleReadiness(
    options({
      readPersistedLocale: async () => {
        reads += 1
        return 'it'
      },
    })
  )

  const [first, second] = await Promise.all([readiness.hydrate(), readiness.hydrate()])
  const third = await readiness.hydrate()

  assert.equal(reads, 1)
  assert.strictEqual(first, second)
  assert.strictEqual(second, third)
})
