import { Suspense } from 'react'
import { LoadingPanel } from '@/components/loading-panel'
import { AuthCallbackClient } from './auth-callback-client'

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<LoadingPanel label="Completing sign-in..." />}>
      <AuthCallbackClient />
    </Suspense>
  )
}
