import { type AuthResolution, reduceAuthResolution } from '../../../packages/core/src/auth/index.ts'

type MobileAuthUser = {
  id: string
}

type MobileAuthSession<AuthUser extends MobileAuthUser> = {
  user: AuthUser
}

type MobileAuthError = {
  code?: string
  message: string
  status?: number
}

type MobileAuthSubscription = {
  unsubscribe(): void
}

export type MobileAuthSource<
  AuthUser extends MobileAuthUser,
  AuthSession extends MobileAuthSession<AuthUser>,
> = {
  getSession(): Promise<{
    data: { session: AuthSession | null }
    error: MobileAuthError | null
  }>
  onAuthStateChange(listener: (event: string, session: AuthSession | null) => void): {
    data: { subscription: MobileAuthSubscription }
  }
  refreshSession(): Promise<{
    data: { session: AuthSession | null }
    error: MobileAuthError | null
  }>
}

export type MobileAuthSnapshot<
  AuthUser extends MobileAuthUser,
  AuthSession extends MobileAuthSession<AuthUser>,
> = {
  resolution: AuthResolution<AuthUser>
  session: AuthSession | null
}

const INVALID_REFRESH_CODES = new Set([
  'bad_jwt',
  'refresh_token_already_used',
  'refresh_token_not_found',
])

function isAuthoritativeRefreshError(error: MobileAuthError) {
  return (
    error.status === 400 ||
    error.status === 401 ||
    (error.code ? INVALID_REFRESH_CODES.has(error.code) : false)
  )
}

export function createMobileAuthResolver<
  AuthUser extends MobileAuthUser,
  AuthSession extends MobileAuthSession<AuthUser>,
>(
  source: MobileAuthSource<AuthUser, AuthSession>,
  onResolution: (snapshot: MobileAuthSnapshot<AuthUser, AuthSession>) => void
) {
  let initialized = false
  let disposed = false
  let sourceRevision = 0
  let subscription: MobileAuthSubscription | null = null
  let snapshot: MobileAuthSnapshot<AuthUser, AuthSession> = {
    resolution: { status: 'resolving' },
    session: null,
  }

  const publish = (resolution: AuthResolution<AuthUser>, session: AuthSession | null) => {
    snapshot = { resolution, session }
    if (!disposed) onResolution(snapshot)
  }

  const cleanup = () => {
    if (disposed) return
    disposed = true
    subscription?.unsubscribe()
  }

  const resolveSession = (nextSession: AuthSession | null) => {
    publish(
      reduceAuthResolution(
        snapshot.resolution,
        nextSession ? { type: 'SESSION_FOUND', user: nextSession.user } : { type: 'SESSION_ABSENT' }
      ),
      nextSession
    )
  }

  return {
    initialize() {
      if (initialized) return cleanup
      initialized = true
      onResolution(snapshot)

      const initialRevision = sourceRevision
      void source.getSession().then(({ data, error }) => {
        if (disposed || sourceRevision !== initialRevision) return
        if (error) {
          publish(
            reduceAuthResolution(snapshot.resolution, {
              type: 'RESOLUTION_FAILED',
              error: {
                code: 'resolution_failure',
                message: error.message,
                recoverable: false,
              },
            }),
            null
          )
          return
        }
        resolveSession(data.session)
      })

      const result = source.onAuthStateChange((event, nextSession) => {
        if (disposed) return
        sourceRevision += 1
        if (nextSession) {
          resolveSession(nextSession)
          return
        }
        if (event === 'SIGNED_OUT') {
          publish(reduceAuthResolution(snapshot.resolution, { type: 'SIGNED_OUT' }), null)
          return
        }
        if (event === 'INITIAL_SESSION') resolveSession(null)
      })
      subscription = result.data.subscription
      return cleanup
    },

    async refresh() {
      const previousSession = snapshot.session
      if (!previousSession) return
      publish(
        reduceAuthResolution(snapshot.resolution, { type: 'REFRESH_STARTED' }),
        previousSession
      )

      const refreshRevision = sourceRevision
      const { data, error } = await source.refreshSession()
      if (disposed || sourceRevision !== refreshRevision) return
      if (data.session) {
        resolveSession(data.session)
        return
      }

      if (error && !isAuthoritativeRefreshError(error)) {
        publish(
          reduceAuthResolution(snapshot.resolution, {
            type: 'REFRESH_FAILED',
            error: {
              code: 'temporary_refresh_failure',
              message: error.message,
              recoverable: true,
            },
          }),
          previousSession
        )
        return
      }

      publish(
        reduceAuthResolution(snapshot.resolution, {
          type: 'SESSION_INVALIDATED',
          error: {
            code: 'invalid_session',
            message: error?.message ?? 'The session is no longer valid.',
            recoverable: false,
          },
        }),
        null
      )
    },
  }
}
