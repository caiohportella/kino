import type { ProtectedPageStatus } from '@kino/core/auth'

type ErrorState = Error | null

export function selectProfilePageStatus(input: {
  loading: boolean
  error: ErrorState
  hasProfile: boolean
}): ProtectedPageStatus {
  if (input.loading) return 'loading'
  if (input.error) return 'error'
  return input.hasProfile ? 'content' : 'empty'
}

export function selectSettingsPageStatus(input: {
  loading: boolean
  error: ErrorState
}): ProtectedPageStatus {
  if (input.loading) return 'loading'
  return input.error ? 'error' : 'content'
}
