import type { UserProfile } from '@kino/core'

export interface UserSearchDocument {
  readonly id: string
  readonly entityType: 'user'
  readonly userId: string
  readonly username: string
  readonly displayName: string
  readonly firstName: string
  readonly lastName: string
  readonly bio: string
  readonly avatarUrl?: string | null
  readonly popularity: number
}

export interface UserDocumentInput {
  readonly id: string
  readonly username?: string | null
  readonly displayName?: string | null
  readonly bio?: string | null
  readonly avatarUrl?: string | null
  readonly popularity?: number | null
}

function normalizeText(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/gu, ' ') : ''
}

function splitDisplayName(displayName: string): { firstName: string; lastName: string } {
  const [firstName = '', ...rest] = displayName.split(' ')
  return { firstName, lastName: rest.join(' ') }
}

export function normalizeUserDocument(input: UserDocumentInput): UserSearchDocument | null {
  const userId = normalizeText(input.id)
  if (!userId) return null
  const username = normalizeText(input.username).replace(/^@+/u, '')
  const displayName = normalizeText(input.displayName)
  const { firstName, lastName } = splitDisplayName(displayName)
  return {
    id: `user:${userId}`,
    entityType: 'user',
    userId,
    username,
    displayName,
    firstName,
    lastName,
    bio: normalizeText(input.bio),
    ...(input.avatarUrl === undefined ? {} : { avatarUrl: input.avatarUrl }),
    popularity:
      input.popularity == null || !Number.isFinite(input.popularity) ? 0 : input.popularity,
  }
}

export function normalizeUserDocumentFromProfile(profile: UserProfile): UserSearchDocument | null {
  return normalizeUserDocument({
    id: profile.id,
    username: profile.username,
    displayName: profile.display_name,
    bio: profile.bio,
    avatarUrl: profile.avatar_url,
  })
}
