import { type AuthResolution, reduceAuthResolution } from '../../../packages/core/src/auth/index.ts'

type WebAuthUser = {
  id: string
}

type WebAuthSession<AuthUser extends WebAuthUser> = {
  user: AuthUser
}

type WebAuthError = {
  code?: string
  message: string
  status?: number
}

type WebAuthSubscription = {
  unsubscribe(): void
}

export type WebAuthSource<
  AuthUser extends WebAuthUser,
  AuthSession extends WebAuthSession<AuthUser>,
> = {
  getSession(): Promise<{
    data: { session: AuthSession | null }
    error: WebAuthError | null
  }>
  onAuthStateChange(listener: (event: string, session: AuthSession | null) => void): {
    data: { subscription: WebAuthSubscription }
  }
  refreshSession(): Promise<{
    data: { session: AuthSession | null }
    error: WebAuthError | null
  }>
}

export type WebAuthSnapshot<
  AuthUser extends WebAuthUser,
  AuthSession extends WebAuthSession<AuthUser>,
> = {
  resolution: AuthResolution<AuthUser>
  session: AuthSession | null
}

const INVALID_REFRESH_CODES = new Set([
  'bad_jwt',
  'refresh_token_already_used',
  'refresh_token_not_found',
])

function isAuthoritativeRefreshError(error: WebAuthError) {
  return (
    error.status === 400 ||
    error.status === 401 ||
    (error.code ? INVALID_REFRESH_CODES.has(error.code) : false)
  )
}

export function createWebAuthResolver<
  AuthUser extends WebAuthUser,
  AuthSession extends WebAuthSession<AuthUser>,
>(
  source: WebAuthSource<AuthUser, AuthSession>,
  onResolution: (snapshot: WebAuthSnapshot<AuthUser, AuthSession>) => void
) {
  let initialized = false
  let disposed = false
  let lifecycleRevision = 0
  let sourceRevision = 0
  let subscription: WebAuthSubscription | null = null
  let cleanup = () => undefined
  let snapshot: WebAuthSnapshot<AuthUser, AuthSession> = {
    resolution: { status: 'resolving' },
    session: null,
  }

  const publish = (resolution: AuthResolution<AuthUser>, session: AuthSession | null) => {
    snapshot = { resolution, session }
    if (!disposed) onResolution(snapshot)
  }

  return {
    initialize() {
      if (initialized) return cleanup
      initialized = true
      disposed = false
      lifecycleRevision += 1
      sourceRevision = 0
      subscription = null
      snapshot = {
        resolution: { status: 'resolving' },
        session: null,
      }
      const activeLifecycle = lifecycleRevision
      cleanup = () => {
        if (disposed || lifecycleRevision !== activeLifecycle) return
        disposed = true
        initialized = false
        lifecycleRevision += 1
        subscription?.unsubscribe()
        subscription = null
      }
      onResolution(snapshot)

      const initialRevision = sourceRevision
      void source.getSession().then(({ data, error }) => {
        if (disposed || lifecycleRevision !== activeLifecycle || sourceRevision !== initialRevision)
          return
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

        publish(
          reduceAuthResolution(
            snapshot.resolution,
            data.session
              ? { type: 'SESSION_FOUND', user: data.session.user }
              : { type: 'SESSION_ABSENT' }
          ),
          data.session
        )
      })

      const result = source.onAuthStateChange((event, nextSession) => {
        if (disposed || lifecycleRevision !== activeLifecycle) return
        sourceRevision += 1

        if (nextSession) {
          publish(
            reduceAuthResolution(snapshot.resolution, {
              type: 'SESSION_FOUND',
              user: nextSession.user,
            }),
            nextSession
          )
          return
        }

        if (event === 'SIGNED_OUT') {
          publish(reduceAuthResolution(snapshot.resolution, { type: 'SIGNED_OUT' }), null)
          return
        }

        if (event === 'INITIAL_SESSION') {
          publish(
            reduceAuthResolution(snapshot.resolution, {
              type: 'SESSION_ABSENT',
            }),
            null
          )
        }
      })
      subscription = result.data.subscription

      return cleanup
    },

    async refresh() {
      const previousSession = snapshot.session
      if (!previousSession || disposed) return
      publish(
        reduceAuthResolution(snapshot.resolution, { type: 'REFRESH_STARTED' }),
        previousSession
      )

      const activeLifecycle = lifecycleRevision
      const refreshRevision = sourceRevision
      const { data, error } = await source.refreshSession()
      if (disposed || lifecycleRevision !== activeLifecycle || sourceRevision !== refreshRevision)
        return

      if (data.session) {
        publish(
          reduceAuthResolution(snapshot.resolution, {
            type: 'SESSION_FOUND',
            user: data.session.user,
          }),
          data.session
        )
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
