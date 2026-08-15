import type { AuthResolution } from '@kino/core/auth'
import type { ReactNode } from 'react'
import {
  type ProtectedPageStatus,
  resolveProtectedContentState,
} from '@/lib/protected-content-state'

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
    <div className="grid min-h-48 gap-4" aria-busy="true">
      <div className="h-8 w-48 animate-pulse rounded bg-muted" />
      <div className="h-32 animate-pulse rounded bg-muted" />
    </div>
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
