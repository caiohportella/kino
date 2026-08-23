'use client'

import { useEffect, useState } from 'react'
import {
  STANDALONE_MODE_MEDIA_QUERY,
  setStandaloneModeAttribute,
} from '../lib/standalone-mode-bridge.ts'

type DisplayModeMediaQuery = Pick<MediaQueryList, 'matches'> | null | undefined
type WindowLike = Pick<Window, 'matchMedia'> | undefined
type DocumentLike = Pick<Document, 'documentElement'> | undefined

type NavigatorWithStandalone = Navigator & { standalone?: boolean }

function hasStandaloneFlag(
  navigatorLike: Navigator | undefined
): navigatorLike is NavigatorWithStandalone {
  return typeof navigatorLike !== 'undefined' && 'standalone' in navigatorLike
}

function isIOSStandalone(navigatorLike: Navigator | undefined): boolean {
  return hasStandaloneFlag(navigatorLike) && navigatorLike.standalone === true
}

export function resolveStandaloneMode(
  displayModeQuery: DisplayModeMediaQuery,
  iosStandalone = false
): boolean {
  return Boolean(displayModeQuery?.matches || iosStandalone)
}

export function readStandaloneMode(
  windowLike: WindowLike = typeof window !== 'undefined' ? window : undefined,
  navigatorLike: Navigator | undefined = typeof navigator !== 'undefined' ? navigator : undefined
): boolean {
  const displayModeQuery = windowLike?.matchMedia?.(STANDALONE_MODE_MEDIA_QUERY)

  return resolveStandaloneMode(displayModeQuery, isIOSStandalone(navigatorLike))
}

export function useStandaloneMode(): boolean {
  const [standalone, setStandalone] = useState(false)

  useEffect(() => {
    const windowLike = typeof window !== 'undefined' ? window : undefined
    const navigatorLike = typeof navigator !== 'undefined' ? navigator : undefined
    const documentLike = typeof document !== 'undefined' ? document : undefined
    const displayModeQuery = windowLike?.matchMedia?.(STANDALONE_MODE_MEDIA_QUERY)

    const updateStandalone = () => {
      const nextStandalone = resolveStandaloneMode(displayModeQuery, isIOSStandalone(navigatorLike))

      setStandalone(nextStandalone)
      syncStandaloneModeAttribute(documentLike, nextStandalone)
    }

    updateStandalone()

    if (!displayModeQuery) {
      return undefined
    }

    if (typeof displayModeQuery.addEventListener === 'function') {
      displayModeQuery.addEventListener('change', updateStandalone)

      return () => {
        displayModeQuery.removeEventListener('change', updateStandalone)
      }
    }

    displayModeQuery.addListener(updateStandalone)

    return () => {
      displayModeQuery.removeListener(updateStandalone)
    }
  }, [])

  return standalone
}

function syncStandaloneModeAttribute(documentLike: DocumentLike, standalone: boolean) {
  setStandaloneModeAttribute(documentLike, standalone)
}
