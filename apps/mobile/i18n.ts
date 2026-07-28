import AsyncStorage from '@react-native-async-storage/async-storage'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

// Import shared translation files
import en from '../../locales/en/translation.json'
import fr from '../../locales/fr/translation.json'
import it from '../../locales/it/translation.json'
import no from '../../locales/no/translation.json'
import pt from '../../locales/pt/translation.json'
import { createMobileLocaleReadiness } from './utils/localeReadiness'

const LANGUAGE_KEY = 'user-language'

export const resources = {
  en: {
    translation: en,
  },
  pt: {
    translation: pt,
  },
  it: {
    translation: it,
  },
  no: {
    translation: no,
  },
  fr: {
    translation: fr,
  },
} as const

// Initialize i18n
i18n.use(initReactI18next).init({
  resources,
  lng: 'en', // Default language
  fallbackLng: 'en',
  compatibilityJSON: 'v4', // For react-native
  interpolation: {
    escapeValue: false, // React already protects from XSS
  },
})

const mobileLocaleReadiness = createMobileLocaleReadiness({
  applyLocale: async (language) => {
    await i18n.changeLanguage(language)
    const { getTMDbService } = await import('./services/tmdb')
    getTMDbService().setLanguage(language)
  },
  fallbackLocale: 'en',
  readPersistedLocale: () => AsyncStorage.getItem(LANGUAGE_KEY),
  supportedLocales: Object.keys(resources),
})

export function loadSavedLanguage() {
  return mobileLocaleReadiness.hydrate()
}

export const getLocaleReadinessState = mobileLocaleReadiness.getState
export const subscribeLocaleReadiness = mobileLocaleReadiness.subscribe

// Save language preference to AsyncStorage
export async function saveLanguage(language: string) {
  try {
    await AsyncStorage.setItem(LANGUAGE_KEY, language)
  } catch (error) {
    console.error('Failed to save language:', error)
  }
}

// Change language and persist
export async function changeLanguage(language: string) {
  if (!resources[language as keyof typeof resources]) {
    throw new TypeError(`Unsupported language: "${language}"`)
  }
  await i18n.changeLanguage(language)
  await saveLanguage(language)
  // Sync TMDb service language
  const { getTMDbService } = await import('./services/tmdb')
  getTMDbService().setLanguage(language)
  mobileLocaleReadiness.setLocale(language)
}

export default i18n
