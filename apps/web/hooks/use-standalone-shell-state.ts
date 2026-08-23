'use client'

import { useLayoutEffect, useState } from 'react'
import { readStandaloneModeAttribute } from '../lib/standalone-mode-bridge.ts'
import { useStandaloneMode } from './use-standalone-mode'

export function useStandaloneShellState() {
  const runtimeStandalone = useStandaloneMode()
  const [bootstrappedStandalone, setBootstrappedStandalone] = useState(false)
  const [standaloneResolved, setStandaloneResolved] = useState(false)

  useLayoutEffect(() => {
    const documentLike = typeof document !== 'undefined' ? document : undefined

    setBootstrappedStandalone(readStandaloneModeAttribute(documentLike))
    setStandaloneResolved(true)
  }, [])

  return {
    standalone: standaloneResolved ? runtimeStandalone : bootstrappedStandalone,
    standaloneResolved,
  }
}
