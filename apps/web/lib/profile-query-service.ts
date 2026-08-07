import type {
  ProfileReviewOptions,
  ProfileReviewsPage,
  UserProfile,
  WatchedSeries,
} from '@kino/core'
import { applyReleasedSeriesProgress, type EpisodeAvailability } from '@kino/core'
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
  database: T,
  options?: {
    getEpisodeAvailability?: (series: WatchedSeries) => Promise<EpisodeAvailability[]>
  }
): T & CanonicalProfileMethods {
  const service = Object.assign(database, {
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

  if (options?.getEpisodeAvailability && 'getWatchedSeries' in database) {
    const getWatchedSeries = (
      database as T & { getWatchedSeries: (profileId: string) => Promise<WatchedSeries[]> }
    ).getWatchedSeries.bind(database)
    Object.assign(service, {
      async getWatchedSeries(profileId: string) {
        const series: WatchedSeries[] = await getWatchedSeries(profileId)
        return Promise.all(
          series.map(async (item) => {
            try {
              const episodes = await options.getEpisodeAvailability?.(item)
              return episodes ? applyReleasedSeriesProgress(item, episodes) : item
            } catch {
              return item
            }
          })
        )
      },
    })
  }

  return service
}
