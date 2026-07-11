import { Suspense } from 'react'
import { AuthSkeleton } from '@/components/skeletons/page-skeletons'
import { AuthCallbackClient } from './auth-callback-client'

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<AuthSkeleton label="Completing sign-in..." />}>
      <AuthCallbackClient />
    </Suspense>
  )
}
