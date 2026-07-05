import { useQuery } from '@tanstack/react-query'
import { dbService } from '~/services/database'

export interface FriendRating {
  userId: string
  displayName: string | null
  username: string | null
  avatarUrl: string | null
  rating: number
}

export interface FriendEpisodeRating extends FriendRating {
  seasonNumber: number
  episodeNumber: number
}

export const FRIEND_RATING_KEYS = {
  titleRatings: (titleId: string) => ['friendRatings', 'title', titleId] as const,
  episodeRatings: (titleId: string) => ['friendRatings', 'episodes', titleId] as const,
}

export function useFriendTitleRatings(titleId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: FRIEND_RATING_KEYS.titleRatings(titleId || ''),
    queryFn: async (): Promise<FriendRating[]> => {
      if (!titleId) return []
      return dbService.getFriendsRatingsForTitle(titleId)
    },
    enabled: !!titleId && enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

export function useFriendEpisodeRatings(titleId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: FRIEND_RATING_KEYS.episodeRatings(titleId || ''),
    queryFn: async (): Promise<FriendEpisodeRating[]> => {
      if (!titleId) return []
      return dbService.getFriendsEpisodeRatingsForTitle(titleId)
    },
    enabled: !!titleId && enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}
