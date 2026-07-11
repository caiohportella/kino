'use client'

import { useEffect } from 'react'
import { HttpErrorState } from '@/components/error-state'
import { Providers } from './providers'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html lang="en">
      <body className="bg-kino-bg text-kino-text">
        <Providers>
          <HttpErrorState onRetry={reset} status={500} />
        </Providers>
      </body>
    </html>
  )
}
