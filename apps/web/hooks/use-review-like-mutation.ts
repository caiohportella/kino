'use client'

import type { InfiniteData } from '@tanstack/react-query'
import {
  activityQueryKeys,
  profileReviewKeys,
  reviewKeys,
  type ProfileReview,
  type ProfileReviewsPage,
  type Review,
  type TitleReviewsPage,
  updateProfileReviewLike,
  updateReviewLike,
} from '@kino/core'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { invalidateProfileMutation } from '@/lib/profile-invalidation'
import { updateActivityFeedReviewLike } from '@/lib/activity-feed'
import { db } from '@/lib/services'
import { useAuthStore } from '@/stores/auth-store'

type Snapshot = [readonly unknown[], unknown][]
type ProfileReviewCache = ProfileReviewsPage | InfiniteData<ProfileReviewsPage>

type ReviewLikeMutationScope = { kind: 'title'; titleId: string } | { kind: 'activity' }

function restoreSnapshot(queryClient: ReturnType<typeof useQueryClient>, snapshot: Snapshot | undefined) {
  for (const [key, value] of snapshot ?? []) {
    queryClient.setQueryData(key, value)
  }
}

function updateProfileReviewCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  reviewId: string,
  liked: boolean
) {
  queryClient.setQueriesData<ProfileReviewCache>({ queryKey: profileReviewKeys.all }, (cache) => {
    if (!cache) return cache
    if ('pages' in cache) {
      return {
        ...cache,
        pages: cache.pages.map((page) => updateProfileReviewLike(page, reviewId, liked) ?? page),
      }
    }
    return updateProfileReviewLike(cache, reviewId, liked) ?? cache
  })
}

function updateTitleReviewCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  titleId: string,
  reviewId: string,
  liked: boolean
) {
  queryClient.setQueriesData<TitleReviewsPage>({ queryKey: reviewKeys.title(titleId) }, (page) =>
    updateReviewLike(page, reviewId, liked)
  )
}

function updateActivityReviewCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  reviewId: string,
  liked: boolean
) {
  queryClient.setQueriesData({ queryKey: activityQueryKeys.all }, (cache) => {
    if (!Array.isArray(cache)) return cache
    return updateActivityFeedReviewLike(cache, reviewId, liked)
  })
}

export function useReviewLikeMutation(scope: ReviewLikeMutationScope) {
  const queryClient = useQueryClient()
  const viewerId = useAuthStore((state) => state.user?.id)

  return useMutation({
    mutationFn: ({
      reviewId,
      liked,
    }: {
      reviewId: string
      liked: boolean
      authorProfileId: string
    }) => (liked ? db.unlikeReview(reviewId) : db.likeReview(reviewId)),
    onMutate: async ({ reviewId, liked }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: profileReviewKeys.all }),
        queryClient.cancelQueries({ queryKey: activityQueryKeys.all }),
        ...(scope.kind === 'title'
          ? [queryClient.cancelQueries({ queryKey: reviewKeys.title(scope.titleId) })]
          : []),
      ])
      const previous = [
        ...queryClient.getQueriesData({ queryKey: profileReviewKeys.all }),
        ...queryClient.getQueriesData({ queryKey: activityQueryKeys.all }),
        ...(scope.kind === 'title'
          ? queryClient.getQueriesData({ queryKey: reviewKeys.title(scope.titleId) })
          : []),
      ] as Snapshot

      updateProfileReviewCaches(queryClient, reviewId, !liked)
      updateActivityReviewCaches(queryClient, reviewId, !liked)
      if (scope.kind === 'title') {
        updateTitleReviewCaches(queryClient, scope.titleId, reviewId, !liked)
      }

      return { previous }
    },
    onError: (_error, _variables, context) => {
      restoreSnapshot(queryClient, context?.previous)
    },
    onSettled: (_data, _error, { authorProfileId }) => {
      queryClient.invalidateQueries({ queryKey: profileReviewKeys.all })
      queryClient.invalidateQueries({ queryKey: activityQueryKeys.all })
      if (scope.kind === 'title') {
        queryClient.invalidateQueries({ queryKey: reviewKeys.title(scope.titleId) })
      }
      if (viewerId) {
        void invalidateProfileMutation(queryClient, {
          kind: 'review',
          profileId: authorProfileId,
          visibilityScope: { kind: 'authenticated', userId: viewerId },
        })
      }
    },
  })
}
