import type { AuthenticatedResolution, AuthResolution, AuthResolutionEvent } from './types'

function previousUserFrom<AuthUser>(resolution: AuthResolution<AuthUser>) {
  if (resolution.status === 'authenticated') return resolution.user
  if ('previousUser' in resolution) return resolution.previousUser
  return undefined
}

function assertNever(value: never): never {
  throw new Error(`Unhandled auth resolution event: ${JSON.stringify(value)}`)
}

export function reduceAuthResolution<AuthUser>(
  resolution: AuthResolution<AuthUser>,
  event: AuthResolutionEvent<AuthUser>
): AuthResolution<AuthUser> {
  switch (event.type) {
    case 'SESSION_FOUND':
      return { status: 'authenticated', user: event.user }
    case 'SESSION_ABSENT':
    case 'SIGNED_OUT':
      return { status: 'unauthenticated' }
    case 'REFRESH_STARTED': {
      const previousUser = previousUserFrom(resolution)
      return previousUser ? { status: 'resolving', previousUser } : { status: 'resolving' }
    }
    case 'REFRESH_FAILED': {
      const previousUser = previousUserFrom(resolution)
      return previousUser
        ? { status: 'error', error: event.error, previousUser }
        : { status: 'error', error: event.error }
    }
    case 'SESSION_INVALIDATED':
    case 'RESOLUTION_FAILED':
      return { status: 'error', error: event.error }
    default:
      return assertNever(event)
  }
}

export function hasAuthenticatedUser<AuthUser>(
  resolution: AuthResolution<AuthUser>
): resolution is AuthenticatedResolution<AuthUser> {
  return (
    resolution.status === 'authenticated' ||
    ((resolution.status === 'resolving' || resolution.status === 'error') &&
      resolution.previousUser !== undefined)
  )
}
