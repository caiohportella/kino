import { useTranslation } from 'react-i18next'

/**
 * Hook to get the current app language reactively
 */
export function useLanguage() {
  const { i18n } = useTranslation()
  return i18n.language
}
