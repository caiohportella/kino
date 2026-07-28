import { hasAuthenticatedUser } from './resolution.ts'
import type { AuthResolution } from './types.ts'

export type ProtectedPageStatus = 'loading' | 'error' | 'empty' | 'content'

export type ProtectedContentState =
  | 'auth-loading'
  | 'unauthenticated'
  | 'page-loading'
  | 'error'
  | 'empty'
  | 'content'

export function resolveProtectedContentState<AuthUser>({
  resolution,
  pageStatus,
}: {
  resolution: AuthResolution<AuthUser>
  pageStatus: ProtectedPageStatus
}): ProtectedContentState {
  if (resolution.status === 'resolving' && !hasAuthenticatedUser(resolution)) {
    return 'auth-loading'
  }
  if (resolution.status === 'unauthenticated') return 'unauthenticated'
  if (resolution.status === 'error' && !hasAuthenticatedUser(resolution)) return 'error'

  switch (pageStatus) {
    case 'loading':
      return 'page-loading'
    case 'error':
      return 'error'
    case 'empty':
      return 'empty'
    case 'content':
      return 'content'
  }
}
