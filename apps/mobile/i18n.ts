import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import AsyncStorage from '@react-native-async-storage/async-storage'

// Import shared translation files
import en from '../../locales/en/translation.json'
import pt from '../../locales/pt/translation.json'
import it from '../../locales/it/translation.json'
import no from '../../locales/no/translation.json'
import fr from '../../locales/fr/translation.json'

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

// Load saved language from AsyncStorage
export async function loadSavedLanguage() {
  try {
    const savedLanguage = await AsyncStorage.getItem(LANGUAGE_KEY)
    if (savedLanguage && resources[savedLanguage as keyof typeof resources]) {
      await i18n.changeLanguage(savedLanguage)
      // Sync TMDb service language
      const { getTMDbService } = await import('./services/tmdb')
      getTMDbService().setLanguage(savedLanguage)
    }
  } catch (error) {
    console.error('Failed to load saved language:', error)
  }
}

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
  await i18n.changeLanguage(language)
  await saveLanguage(language)
  // Sync TMDb service language
  const { getTMDbService } = await import('./services/tmdb')
  getTMDbService().setLanguage(language)
}

export default i18n
