import type { User } from '@supabase/supabase-js'

export type AuthProfileStatus = 'idle' | 'loading' | 'ready' | 'error'

type Profile = {
  id: string
  display_name: string | null
  username: string | null
}

type PostgrestError = { message: string }
type Result<T = unknown> = { data?: T | null; error: PostgrestError | null }

type AuthProfileDependencies = {
  read(userId: string): Promise<Result<Profile | null>>
  update(
    userId: string,
    updates: { display_name?: string | null; username?: string | null }
  ): Promise<Result>
  insert(profile: Profile): Promise<Result>
}

type UserMetadata = {
  display_name?: unknown
  username?: unknown
}

function getStringMetadata(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function throwPostgrestError(error: PostgrestError | null) {
  if (error) throw new Error(error.message)
}

export function createAuthProfileEnsurer(dependencies: AuthProfileDependencies) {
  const requestVersions = new Map<string, number>()

  return async function ensureUserProfile(
    user: User,
    onStatus?: (status: AuthProfileStatus) => void
  ) {
    const version = (requestVersions.get(user.id) ?? 0) + 1
    requestVersions.set(user.id, version)
    const isCurrent = () => requestVersions.get(user.id) === version
    onStatus?.('loading')

    try {
      const metadata = user.user_metadata as UserMetadata
      const username = getStringMetadata(metadata.username)
      const displayName =
        getStringMetadata(metadata.display_name) || username || user.email?.split('@')[0] || null
      const readResult = await dependencies.read(user.id)
      if (!isCurrent()) return
      throwPostgrestError(readResult.error)

      if (readResult.data) {
        const updates: { display_name?: string | null; username?: string | null } = {}
        if (!readResult.data.display_name && displayName) updates.display_name = displayName
        if (!readResult.data.username && username) updates.username = username
        if (Object.keys(updates).length > 0) {
          const updateResult = await dependencies.update(user.id, updates)
          throwPostgrestError(updateResult.error)
        }
      } else {
        const insertResult = await dependencies.insert({
          id: user.id,
          display_name: displayName,
          username,
        })
        throwPostgrestError(insertResult.error)
      }

      if (isCurrent()) onStatus?.('ready')
    } catch (error) {
      if (!isCurrent()) return
      onStatus?.('error')
      throw error
    }
  }
}
