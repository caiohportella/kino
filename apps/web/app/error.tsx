'use client'

import { useEffect } from 'react'
import { HttpErrorState } from '@/components/error-state'

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return <HttpErrorState onRetry={reset} status={500} />
}
