export type RecoverableAuthResolutionError = {
  code: 'temporary_refresh_failure'
  message: string
  recoverable: true
}

export type DefinitiveAuthResolutionError = {
  code: 'invalid_session' | 'resolution_failure'
  message: string
  recoverable: false
}

export type AuthResolutionError = RecoverableAuthResolutionError | DefinitiveAuthResolutionError

export type AuthResolution<AuthUser> =
  | { status: 'resolving'; previousUser?: AuthUser }
  | { status: 'authenticated'; user: AuthUser }
  | { status: 'unauthenticated' }
  | {
      status: 'error'
      error: AuthResolutionError
      previousUser?: AuthUser
    }

export type AuthenticatedResolution<AuthUser> =
  | { status: 'authenticated'; user: AuthUser }
  | { status: 'resolving'; previousUser: AuthUser }
  | {
      status: 'error'
      error: AuthResolutionError
      previousUser: AuthUser
    }

export type AuthResolutionEvent<AuthUser> =
  | { type: 'SESSION_FOUND'; user: AuthUser }
  | { type: 'SESSION_ABSENT' }
  | { type: 'REFRESH_STARTED' }
  | { type: 'REFRESH_FAILED'; error: RecoverableAuthResolutionError }
  | { type: 'SESSION_INVALIDATED'; error: DefinitiveAuthResolutionError }
  | { type: 'RESOLUTION_FAILED'; error: AuthResolutionError }
  | { type: 'SIGNED_OUT' }
