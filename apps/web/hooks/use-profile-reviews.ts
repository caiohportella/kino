'use client'

import {
  profileReviewKeys,
  type ProfileReview,
  type ProfileReviewCursor,
  type ProfileReviewsPage,
  removeProfileReview,
  removeReview,
  replaceProfileReview,
  replaceReview,
  reviewKeys,
  type TitleReviewsPage,
  updateProfileReviewLike,
  updateReviewLike,
} from '@kino/core'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { db } from '@/lib/services'

const PROFILE_REVIEW_PREVIEW_LIMIT = 6
const PROFILE_REVIEW_PAGE_LIMIT = 20
type Snapshot = Array<[readonly unknown[], unknown]>

function restore(queryClient: ReturnType<typeof useQueryClient>, snapshot: Snapshot | undefined) {
  for (const [key, value] of snapshot ?? []) queryClient.setQueryData(key, value)
}

export function useProfileReviews(username: string | null | undefined) {
  return useQuery({
    queryKey: profileReviewKeys.profile(username ?? ''),
    queryFn: () => db.getProfileReviews(username!, { limit: PROFILE_REVIEW_PREVIEW_LIMIT }),
    enabled: Boolean(username),
    staleTime: 60_000,
  })
}

export function useAllProfileReviews(username: string, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: [...profileReviewKeys.profile(username), 'all'],
    queryFn: ({ pageParam }) =>
      db.getProfileReviews(username, {
        limit: PROFILE_REVIEW_PAGE_LIMIT,
        cursor: pageParam,
      }),
    initialPageParam: null as ProfileReviewCursor | null,
    getNextPageParam: (page) => page.nextCursor,
    enabled,
  })
}

export function useProfileReviewMutations(username: string) {
  const queryClient = useQueryClient()

  const update = useMutation({
    mutationFn: ({ reviewId, content }: { reviewId: string; content: string }) =>
      db.updateReview(reviewId, content),
    onMutate: async ({ reviewId, content }) => {
      await queryClient.cancelQueries({ queryKey: profileReviewKeys.profile(username) })
      const previous = queryClient.getQueriesData({
        queryKey: profileReviewKeys.profile(username),
      })
      queryClient.setQueriesData<ProfileReviewsPage>(
        { queryKey: profileReviewKeys.profile(username) },
        (page) => {
          const current = page?.items.find((item) => item.id === reviewId)
          return current
            ? replaceProfileReview(page, {
                ...current,
                content: content.trim(),
                updatedAt: new Date().toISOString(),
              })
            : page
        }
      )
      return { previous }
    },
    onError: (_error, _variables, context) => restore(queryClient, context?.previous),
    onSuccess: (review) => {
      queryClient.setQueriesData<ProfileReviewsPage>(
        { queryKey: profileReviewKeys.profile(username) },
        (page) => {
          const current = page?.items.find((item) => item.id === review.id)
          return current ? replaceProfileReview(page, { ...current, ...review }) : page
        }
      )
      queryClient.setQueriesData<TitleReviewsPage>(
        { queryKey: reviewKeys.title(review.titleId) },
        (page) => replaceReview(page, review)
      )
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: profileReviewKeys.profile(username) }),
  })

  const remove = useMutation({
    mutationFn: (review: ProfileReview) => db.deleteReview(review.id),
    onMutate: async (review) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: profileReviewKeys.profile(username) }),
        queryClient.cancelQueries({ queryKey: reviewKeys.title(review.titleId) }),
      ])
      const previous = [
        ...queryClient.getQueriesData({ queryKey: profileReviewKeys.profile(username) }),
        ...queryClient.getQueriesData({ queryKey: reviewKeys.title(review.titleId) }),
      ] as Snapshot
      queryClient.setQueriesData<ProfileReviewsPage>(
        { queryKey: profileReviewKeys.profile(username) },
        (page) => removeProfileReview(page, review.id)
      )
      queryClient.setQueriesData<TitleReviewsPage>(
        { queryKey: reviewKeys.title(review.titleId) },
        (page) => removeReview(page, review.id)
      )
      return { previous }
    },
    onError: (_error, _variables, context) => restore(queryClient, context?.previous),
    onSettled: (_data, _error, review) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: profileReviewKeys.profile(username) }),
        queryClient.invalidateQueries({ queryKey: reviewKeys.title(review.titleId) }),
        queryClient.invalidateQueries({ queryKey: ['profile'] }),
        queryClient.invalidateQueries({ queryKey: ['profile-by-username', username] }),
      ]),
  })

  const like = useMutation({
    mutationFn: ({ review, liked }: { review: ProfileReview; liked: boolean }) =>
      liked ? db.unlikeReview(review.id) : db.likeReview(review.id),
    onMutate: async ({ review, liked }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: profileReviewKeys.profile(username) }),
        queryClient.cancelQueries({ queryKey: reviewKeys.title(review.titleId) }),
      ])
      const previous = [
        ...queryClient.getQueriesData({ queryKey: profileReviewKeys.profile(username) }),
        ...queryClient.getQueriesData({ queryKey: reviewKeys.title(review.titleId) }),
      ] as Snapshot
      queryClient.setQueriesData<ProfileReviewsPage>(
        { queryKey: profileReviewKeys.profile(username) },
        (page) => updateProfileReviewLike(page, review.id, !liked)
      )
      queryClient.setQueriesData<TitleReviewsPage>(
        { queryKey: reviewKeys.title(review.titleId) },
        (page) => updateReviewLike(page, review.id, !liked)
      )
      return { previous }
    },
    onError: (_error, _variables, context) => restore(queryClient, context?.previous),
    onSettled: (_data, _error, { review }) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: profileReviewKeys.profile(username) }),
        queryClient.invalidateQueries({ queryKey: reviewKeys.title(review.titleId) }),
      ]),
  })

  return { like, remove, update }
}
