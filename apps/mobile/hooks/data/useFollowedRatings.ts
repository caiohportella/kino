import { KinoDatabaseService, ratingKeys } from '@kino/core'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/utils/api/supabase'

const ratingsDb = new KinoDatabaseService(supabase)

export function useFollowedTitleRatings(titleId: string, enabled = true) {
  return useQuery({
    queryKey: ratingKeys.followedTitle(titleId),
    queryFn: () => ratingsDb.getFollowedTitleRatings(titleId),
    enabled: enabled && Boolean(titleId),
    staleTime: 60_000,
  })
}

export function useFollowedEpisodeRatings(
  titleId: string,
  seasonNumber: number,
  enabled = true
) {
  return useQuery({
    queryKey: ratingKeys.followedEpisodes(titleId, seasonNumber),
    queryFn: () => ratingsDb.getFollowedEpisodeRatings(titleId, seasonNumber),
    enabled: enabled && Boolean(titleId) && seasonNumber > 0,
    staleTime: 60_000,
  })
}
