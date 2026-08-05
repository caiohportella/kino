import type { ProfileReviewOptions, ProfileReviewsPage, UserProfile } from '@kino/core'
import type { ProfileQueryService, PublicProfileStats } from './profile-query-options'

interface LegacyProfileDatabase {
  getProfileReviews(username: string, options?: ProfileReviewOptions): Promise<ProfileReviewsPage>
  getPublicProfileStatsByUsername(username: string): Promise<PublicProfileStats | null>
  getUserProfile(profileId: string): Promise<UserProfile | null>
}

type CanonicalProfileMethods = Pick<
  ProfileQueryService,
  'getProfileReviewsByProfileId' | 'getPublicProfileStatsByProfileId'
>

export function createProfileQueryService<T extends LegacyProfileDatabase>(
  database: T
): T & CanonicalProfileMethods {
  return Object.assign(database, {
    async getProfileReviewsByProfileId(profileId: string, options?: ProfileReviewOptions) {
      const profile = await database.getUserProfile(profileId)
      if (!profile?.username) return { items: [], nextCursor: null, totalCount: 0 }
      return database.getProfileReviews(profile.username, options)
    },
    async getPublicProfileStatsByProfileId(profileId: string) {
      const profile = await database.getUserProfile(profileId)
      if (!profile?.username) return null
      return database.getPublicProfileStatsByUsername(profile.username)
    },
  })
}
