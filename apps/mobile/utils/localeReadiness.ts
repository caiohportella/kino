import { normalizeLocale } from '../../../packages/core/src/localization/locale.ts'

export type MobileLocaleReadinessStatus = 'resolving' | 'ready' | 'error'

export interface MobileLocaleReadinessError {
  readonly code: 'storage-read-failed' | 'locale-apply-failed'
  readonly message: string
}

export type MobileLocaleReadinessState =
  | { readonly error: null; readonly locale: null; readonly status: 'resolving' }
  | { readonly error: null; readonly locale: string; readonly status: 'ready' }
  | {
      readonly error: MobileLocaleReadinessError
      readonly locale: string
      readonly status: 'error'
    }

export interface MobileLocaleReadinessOptions {
  readonly applyLocale: (locale: string) => Promise<void> | void
  readonly fallbackLocale: string
  readonly readPersistedLocale: () => Promise<string | null>
  readonly supportedLocales: readonly string[]
}

export interface MobileLocaleReadiness {
  getState(): MobileLocaleReadinessState
  hydrate(): Promise<MobileLocaleReadinessState>
  setLocale(locale: string): MobileLocaleReadinessState
  subscribe(listener: () => void): () => void
}

const RESOLVING_STATE: MobileLocaleReadinessState = {
  error: null,
  locale: null,
  status: 'resolving',
}

export function createMobileLocaleReadiness(
  options: MobileLocaleReadinessOptions
): MobileLocaleReadiness {
  const supportedLocales = new Set(options.supportedLocales.map(normalizeLocale))
  const fallbackLocale = normalizeLocale(options.fallbackLocale)
  if (!supportedLocales.has(fallbackLocale)) {
    throw new TypeError('Fallback locale must be included in supported locales.')
  }

  let state = RESOLVING_STATE
  let hydration: Promise<MobileLocaleReadinessState> | null = null
  const listeners = new Set<() => void>()

  const settle = (nextState: MobileLocaleReadinessState) => {
    state = nextState
    for (const listener of listeners) listener()
    return state
  }

  return {
    getState: () => state,
    hydrate: () => {
      hydration ??= hydrateLocale({
        ...options,
        fallbackLocale,
        supportedLocales,
      }).then(settle)
      return hydration
    },
    setLocale: (locale) => {
      const normalized = normalizeLocale(locale)
      if (!supportedLocales.has(normalized)) {
        throw new TypeError(`Unsupported locale: "${locale}"`)
      }
      return settle({ error: null, locale: normalized, status: 'ready' })
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

async function hydrateLocale(
  options: Omit<MobileLocaleReadinessOptions, 'fallbackLocale' | 'supportedLocales'> & {
    readonly fallbackLocale: string
    readonly supportedLocales: ReadonlySet<string>
  }
): Promise<MobileLocaleReadinessState> {
  let persistedLocale: string | null
  try {
    persistedLocale = await options.readPersistedLocale()
  } catch (error) {
    await applyFallbackLocale(options)
    return {
      error: {
        code: 'storage-read-failed',
        message: errorMessage(error, 'Could not read persisted locale.'),
      },
      locale: options.fallbackLocale,
      status: 'error',
    }
  }

  const locale = resolveSupportedLocale(
    persistedLocale,
    options.supportedLocales,
    options.fallbackLocale
  )
  try {
    await options.applyLocale(locale)
    return { error: null, locale, status: 'ready' }
  } catch (error) {
    return {
      error: {
        code: 'locale-apply-failed',
        message: errorMessage(error, 'Could not apply resolved locale.'),
      },
      locale,
      status: 'error',
    }
  }
}

async function applyFallbackLocale(
  options: Pick<MobileLocaleReadinessOptions, 'applyLocale'> & {
    readonly fallbackLocale: string
  }
) {
  try {
    await options.applyLocale(options.fallbackLocale)
  } catch {
    // The storage failure remains the primary readiness error.
  }
}

function resolveSupportedLocale(
  persistedLocale: string | null,
  supportedLocales: ReadonlySet<string>,
  fallbackLocale: string
) {
  if (!persistedLocale) return fallbackLocale
  try {
    const normalized = normalizeLocale(persistedLocale)
    return supportedLocales.has(normalized) ? normalized : fallbackLocale
  } catch {
    return fallbackLocale
  }
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}
