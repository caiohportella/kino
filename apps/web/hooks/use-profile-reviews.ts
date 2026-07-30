'use client'

import {
  type ProfileReview,
  type ProfileReviewCursor,
  type ProfileReviewsPage,
  profileReviewKeys,
  removeProfileReview,
  removeReview,
  replaceProfileReview,
  replaceReview,
  reviewKeys,
  type TitleReviewsPage,
  updateProfileReviewLike,
  updateReviewLike,
} from '@kino/core'
import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useEffect } from 'react'
import { invalidateProfileMutation } from '@/lib/profile-invalidation'
import { db } from '@/lib/services'
import { useAuthStore } from '@/stores/auth-store'

const PROFILE_REVIEW_PREVIEW_LIMIT = 6
const PROFILE_REVIEW_PAGE_LIMIT = 20
type Snapshot = [readonly unknown[], unknown][]
type ProfileReviewCache = ProfileReviewsPage | InfiniteData<ProfileReviewsPage>

function restore(queryClient: ReturnType<typeof useQueryClient>, snapshot: Snapshot | undefined) {
  for (const [key, value] of snapshot ?? []) queryClient.setQueryData(key, value)
}

function updateProfileReviewCache(
  cache: ProfileReviewCache | undefined,
  updater: (page: ProfileReviewsPage) => ProfileReviewsPage
) {
  if (!cache) return cache
  if ('pages' in cache) {
    return {
      ...cache,
      pages: cache.pages.map(updater),
    }
  }
  return updater(cache)
}

export function useProfileReviews(username: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: profileReviewKeys.profile(username ?? ''),
    queryFn: () => db.getProfileReviews(username!, { limit: PROFILE_REVIEW_PREVIEW_LIMIT }),
    enabled: enabled && Boolean(username),
    staleTime: 60_000,
  })
}

export function useBridgeProfileReviewsCache(
  username: string | null | undefined,
  data: ProfileReviewsPage | undefined
) {
  const queryClient = useQueryClient()
  useEffect(() => {
    if (!username || !data) return
    queryClient.setQueryData(profileReviewKeys.profile(username), data)
  }, [data, queryClient, username])
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
  const viewerId = useAuthStore((state) => state.user?.id)

  const update = useMutation({
    mutationFn: ({ reviewId, content }: { reviewId: string; content: string }) =>
      db.updateReview(reviewId, content),
    onMutate: async ({ reviewId, content }) => {
      await queryClient.cancelQueries({ queryKey: profileReviewKeys.profile(username) })
      const previous = queryClient.getQueriesData({
        queryKey: profileReviewKeys.profile(username),
      })
      queryClient.setQueriesData<ProfileReviewCache>(
        { queryKey: profileReviewKeys.profile(username) },
        (cache) =>
          updateProfileReviewCache(cache, (page) => {
            const current = page.items.find((item) => item.id === reviewId)
            return current
              ? (replaceProfileReview(page, {
                  ...current,
                  content: content.trim(),
                  updatedAt: new Date().toISOString(),
                }) ?? page)
              : page
          })
      )
      return { previous }
    },
    onError: (_error, _variables, context) => restore(queryClient, context?.previous),
    onSuccess: (review) => {
      queryClient.setQueriesData<ProfileReviewCache>(
        { queryKey: profileReviewKeys.profile(username) },
        (cache) =>
          updateProfileReviewCache(cache, (page) => {
            const current = page.items.find((item) => item.id === review.id)
            return current ? (replaceProfileReview(page, { ...current, ...review }) ?? page) : page
          })
      )
      queryClient.setQueriesData<TitleReviewsPage>(
        { queryKey: reviewKeys.title(review.titleId) },
        (page) => replaceReview(page, review)
      )
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: profileReviewKeys.profile(username) }),
        ...(viewerId
          ? [
              invalidateProfileMutation(queryClient, {
                kind: 'review',
                profileId: viewerId,
                visibilityScope: { kind: 'authenticated', userId: viewerId },
              }),
            ]
          : []),
      ]),
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
      queryClient.setQueriesData<ProfileReviewCache>(
        { queryKey: profileReviewKeys.profile(username) },
        (cache) =>
          updateProfileReviewCache(cache, (page) => removeProfileReview(page, review.id) ?? page)
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
        ...(viewerId
          ? [
              invalidateProfileMutation(queryClient, {
                kind: 'review',
                profileId: review.userId,
                visibilityScope: { kind: 'authenticated', userId: viewerId },
              }),
            ]
          : []),
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
      queryClient.setQueriesData<ProfileReviewCache>(
        { queryKey: profileReviewKeys.profile(username) },
        (cache) =>
          updateProfileReviewCache(
            cache,
            (page) => updateProfileReviewLike(page, review.id, !liked) ?? page
          )
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
        ...(viewerId
          ? [
              invalidateProfileMutation(queryClient, {
                kind: 'review',
                profileId: review.userId,
                visibilityScope: { kind: 'authenticated', userId: viewerId },
              }),
            ]
          : []),
      ]),
  })

  return { like, remove, update }
}
