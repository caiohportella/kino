import { useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { getLocaleReadinessState, subscribeLocaleReadiness } from '../i18n'

/**
 * Hook to get the current app language reactively
 */
export function useLanguage() {
  const { i18n } = useTranslation()
  return i18n.language
}

export function useLocaleReadiness() {
  return useSyncExternalStore(
    subscribeLocaleReadiness,
    getLocaleReadinessState,
    getLocaleReadinessState
  )
}

export function useReadyLanguage() {
  const readiness = useLocaleReadiness()
  return readiness.status === 'resolving' ? null : readiness.locale
}
