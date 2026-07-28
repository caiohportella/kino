'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  createWebLocaleReadiness,
  type WebLocaleReadinessError,
  type WebLocaleReadinessStatus,
} from '@/lib/locale-readiness'

export type KinoLanguage = 'en' | 'pt' | 'fr' | 'it' | 'no'

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

const settingsLocaleReadiness = createWebLocaleReadiness({
  applyLocale: () => {},
  fallbackLocale: 'en',
  readPersistedLocale: async () => {
    await useSettingsStore.persist.rehydrate()
    return useSettingsStore.getState().language
  },
  supportedLocales: ['en', 'pt', 'fr', 'it', 'no'],
})
