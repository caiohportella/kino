'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  createWebLocaleReadiness,
  type WebLocaleReadinessError,
  type WebLocaleReadinessStatus,
} from '@/lib/localization/locale-readiness'

import { type KinoLanguage, SUPPORTED_LANGUAGES } from '../../../packages/core/src/locale-config'

interface SettingsState {
  hydrateLanguage: () => Promise<void>
  language: KinoLanguage
  localeError: WebLocaleReadinessError | null
  localeStatus: WebLocaleReadinessStatus
  setLanguage: (language: KinoLanguage) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      hydrateLanguage: async () => {
        const resolution = await settingsLocaleReadiness.hydrate()
        persistLanguageCookie(resolution.locale as KinoLanguage)
        useSettingsStore.setState({
          language: resolution.locale as KinoLanguage,
          localeError: resolution.error,
          localeStatus: resolution.status,
        })
      },
      language: 'en',
      localeError: null,
      localeStatus: 'resolving',
      setLanguage: (language) => {
        settingsLocaleReadiness.setLocale(language)
        persistLanguageCookie(language)
        set({ language, localeError: null, localeStatus: 'ready' })
      },
    }),
    {
      name: 'kino-web-settings',
      partialize: (state) => ({ language: state.language }),
      skipHydration: true,
    }
  )
)

function persistLanguageCookie(language: KinoLanguage) {
  if (typeof document === 'undefined') return
  document.cookie = `kino-language=${encodeURIComponent(language)}; Path=/; Max-Age=31536000; SameSite=Lax`
}

const settingsLocaleReadiness = createWebLocaleReadiness({
  applyLocale: () => {},
  fallbackLocale: 'en',
  readPersistedLocale: async () => {
    await useSettingsStore.persist.rehydrate()
    return useSettingsStore.getState().language
  },
  supportedLocales: SUPPORTED_LANGUAGES,
})
