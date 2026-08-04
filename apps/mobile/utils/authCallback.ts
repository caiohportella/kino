export type AuthCallbackPayload = {
  code?: string
  accessToken?: string
  refreshToken?: string
  error?: string
}

type AuthCallbackError = {
  message?: string
}

type AuthCallbackDependencies = {
  exchangeCodeForSession(code: string): Promise<{ error: AuthCallbackError | null }>
  setSession(tokens: {
    access_token: string
    refresh_token: string
  }): Promise<{ error: AuthCallbackError | null }>
  consumeReturnTo(): Promise<string>
}

function combinedParams(url: string) {
  const parsed = new URL(url)
  const hash = new URLSearchParams(parsed.hash.replace(/^#/, ''))
  return { query: parsed.searchParams, hash }
}

function first(query: URLSearchParams, hash: URLSearchParams, name: string) {
  return query.get(name) || hash.get(name) || undefined
}

export function getAuthCallbackPayload(url: string): AuthCallbackPayload {
  const { query, hash } = combinedParams(url)
  return {
    code: first(query, hash, 'code'),
    accessToken: first(query, hash, 'access_token'),
    refreshToken: first(query, hash, 'refresh_token'),
    error:
      first(query, hash, 'error_description') ||
      first(query, hash, 'error_code') ||
      first(query, hash, 'error'),
  }
}

export function sanitizeAuthError(error: string) {
  const normalized = error.toLowerCase()
  if (normalized.includes('expired'))
    return 'The authentication request has expired. Please try again.'
  if (normalized.includes('access_denied')) return 'Google authentication was canceled.'
  return 'Google authentication could not be completed. Please try again.'
}

export function createAuthCallbackCompleter(dependencies: AuthCallbackDependencies) {
  const activeCompletions = new Map<string, Promise<string>>()
  const completedResults = new Map<string, string>()
  const maximumCompletedResults = 32

  const completeOnce = (identity: string, operation: () => Promise<string>) => {
    const completed = completedResults.get(identity)
    if (completed) return Promise.resolve(completed)

    const active = activeCompletions.get(identity)
    if (active) return active

    const completion = operation()
      .then((destination) => {
        completedResults.set(identity, destination)
        if (completedResults.size > maximumCompletedResults) {
          completedResults.delete(completedResults.keys().next().value as string)
        }
        return destination
      })
      .finally(() => activeCompletions.delete(identity))
    activeCompletions.set(identity, completion)
    return completion
  }

  const fingerprint = (value: string) => {
    let hash = 2166136261
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index)
      hash = Math.imul(hash, 16777619)
    }
    return (hash >>> 0).toString(36)
  }

  return {
    async complete(url: string) {
      const payload = getAuthCallbackPayload(url)

      if (payload.error) {
        throw new Error(sanitizeAuthError(payload.error))
      }

      if (payload.code) {
        return completeOnce(`code:${payload.code}`, async () => {
          const { error } = await dependencies.exchangeCodeForSession(payload.code as string)
          if (error) {
            throw new Error('The authentication request expired or could not be completed.')
          }
          return dependencies.consumeReturnTo()
        })
      }

      if (payload.accessToken && payload.refreshToken) {
        const accessToken = payload.accessToken
        const refreshToken = payload.refreshToken
        const identity = `tokens:${fingerprint(`${accessToken}\u0000${refreshToken}`)}`
        return completeOnce(identity, async () => {
          const { error } = await dependencies.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          if (error) throw new Error('The authentication session could not be saved.')
          return dependencies.consumeReturnTo()
        })
      }

      throw new Error(
        'The authentication callback is invalid or is missing its authorization code.'
      )
    },
  }
}
