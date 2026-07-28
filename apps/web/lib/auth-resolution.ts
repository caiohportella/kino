import { type AuthResolution, reduceAuthResolution } from '../../../packages/core/src/auth/index.ts'

type WebAuthUser = {
  id: string
}

type WebAuthSession<AuthUser extends WebAuthUser> = {
  user: AuthUser
}

type WebAuthError = {
  message: string
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
}

export type WebAuthSnapshot<
  AuthUser extends WebAuthUser,
  AuthSession extends WebAuthSession<AuthUser>,
> = {
  resolution: AuthResolution<AuthUser>
  session: AuthSession | null
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
  let sourceRevision = 0
  let subscription: WebAuthSubscription | null = null
  let snapshot: WebAuthSnapshot<AuthUser, AuthSession> = {
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
        if (disposed) return
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
  }
}
