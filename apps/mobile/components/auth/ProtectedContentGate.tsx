import type { AuthResolution } from '@kino/core/auth'
import type { ReactNode } from 'react'
import { ActivityIndicator, View } from 'react-native'
import {
  type ProtectedPageStatus,
  resolveProtectedContentState,
} from '@/utils/protectedContentState'

type ProtectedContentGateProps<AuthUser> = {
  resolution: AuthResolution<AuthUser>
  pageStatus: ProtectedPageStatus
  children: ReactNode
  authLoadingFallback?: ReactNode
  unauthenticatedFallback: ReactNode
  pageLoadingFallback?: ReactNode
  errorFallback: ReactNode
  emptyFallback: ReactNode
}

function LoadingFallback() {
  return (
    <View className="min-h-48 items-center justify-center">
      <ActivityIndicator color="#1DB954" />
    </View>
  )
}

export function ProtectedContentGate<AuthUser>({
  resolution,
  pageStatus,
  children,
  authLoadingFallback,
  unauthenticatedFallback,
  pageLoadingFallback,
  errorFallback,
  emptyFallback,
}: ProtectedContentGateProps<AuthUser>) {
  const state = resolveProtectedContentState({ resolution, pageStatus })

  switch (state) {
    case 'auth-loading':
      return authLoadingFallback ?? <LoadingFallback />
    case 'unauthenticated':
      return unauthenticatedFallback
    case 'page-loading':
      return pageLoadingFallback ?? <LoadingFallback />
    case 'error':
      return errorFallback
    case 'empty':
      return emptyFallback
    case 'content':
      return children
  }
}
