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
  const activeCodes = new Map<string, Promise<string>>()
  const completedCodes = new Map<string, string>()

  const completeCode = (code: string) => {
    const completed = completedCodes.get(code)
    if (completed) return Promise.resolve(completed)

    const active = activeCodes.get(code)
    if (active) return active

    const completion = dependencies
      .exchangeCodeForSession(code)
      .then(async ({ error }) => {
        if (error) {
          throw new Error('The authentication request expired or could not be completed.')
        }
        const destination = await dependencies.consumeReturnTo()
        completedCodes.set(code, destination)
        return destination
      })
      .finally(() => activeCodes.delete(code))
    activeCodes.set(code, completion)
    return completion
  }

  return {
    async complete(url: string) {
      const payload = getAuthCallbackPayload(url)

      if (payload.error) {
        throw new Error(sanitizeAuthError(payload.error))
      }

      if (payload.code) return completeCode(payload.code)

      if (payload.accessToken && payload.refreshToken) {
        const { error } = await dependencies.setSession({
          access_token: payload.accessToken,
          refresh_token: payload.refreshToken,
        })
        if (error) throw new Error('The authentication session could not be saved.')
        return dependencies.consumeReturnTo()
      }

      throw new Error(
        'The authentication callback is invalid or is missing its authorization code.'
      )
    },
  }
}
