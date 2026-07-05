'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type KinoLanguage = 'en' | 'pt' | 'fr' | 'it' | 'no'

interface SettingsState {
  language: KinoLanguage
  setLanguage: (language: KinoLanguage) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      language: 'en',
      setLanguage: (language) => set({ language }),
    }),
    { name: 'kino-web-settings' }
  )
)
