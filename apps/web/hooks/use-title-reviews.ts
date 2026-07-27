'use client'

import {
  insertViewerReview,
  type KinoReviewAuthor,
  type MediaType,
  profileReviewKeys,
  type ProfileReviewsPage,
  removeProfileReview,
  removeReview,
  replaceProfileReview,
  replaceReview,
  type Review,
  reviewKeys,
  type TitleReviewsPage,
  updateReviewContent,
  updateProfileReviewLike,
  updateReviewLike,
} from '@kino/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { db } from '@/lib/services'

type Snapshot = Array<[readonly unknown[], unknown]>

function restoreSnapshot(
  queryClient: ReturnType<typeof useQueryClient>,
  snapshot: Snapshot | undefined
) {
  for (const [key, data] of snapshot ?? []) queryClient.setQueryData(key, data)
}

function updateTitlePages(
  queryClient: ReturnType<typeof useQueryClient>,
  titleId: string,
  updater: (page: TitleReviewsPage | undefined) => TitleReviewsPage | undefined
) {
  queryClient.setQueriesData<TitleReviewsPage>(
    { queryKey: reviewKeys.title(titleId) },
    updater
  )
}

export function useTitleReviews(titleId: string, enabled = true) {
  return useQuery({
    queryKey: reviewKeys.title(titleId),
    queryFn: () => db.getTitleReviews(titleId),
    enabled: enabled && Boolean(titleId),
    staleTime: 60_000,
  })
}

export function useCreateReviewMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      titleId,
      mediaType,
      content,
    }: {
      titleId: string
      mediaType: MediaType
      content: string
      author: KinoReviewAuthor
    }) => db.createReview(titleId, mediaType, content),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: reviewKeys.title(variables.titleId) })
      const previous = queryClient.getQueriesData({ queryKey: reviewKeys.title(variables.titleId) })
      const now = new Date().toISOString()
      const optimistic: Review = {
        id: `optimistic:${variables.titleId}`,
        userId: variables.author.id,
        titleId: variables.titleId,
        mediaType: variables.mediaType,
        content: variables.content.trim(),
        rating: null,
        likeCount: 0,
        likedByViewer: false,
        createdAt: now,
        updatedAt: now,
        author: variables.author,
        isViewerReview: true,
        tier: 0,
      }
      updateTitlePages(queryClient, variables.titleId, (page) =>
        insertViewerReview(page, optimistic)
      )
      return { previous }
    },
    onError: (_error, variables, context) => {
      restoreSnapshot(queryClient, context?.previous as Snapshot | undefined)
    },
    onSuccess: (review, variables) => {
      updateTitlePages(queryClient, variables.titleId, (page) => {
        const withoutOptimistic = page
          ? {
              ...page,
              items: page.items.filter((item) => !item.id.startsWith('optimistic:')),
              totalCount: Math.max(0, page.totalCount - 1),
            }
          : page
        return insertViewerReview(withoutOptimistic, review)
      })
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: reviewKeys.title(variables.titleId) })
      queryClient.invalidateQueries({ queryKey: profileReviewKeys.all })
      queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
  })
}

export function useUpdateReviewMutation(titleId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ reviewId, content }: { reviewId: string; content: string }) =>
      db.updateReview(reviewId, content),
    onMutate: async ({ reviewId, content }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: reviewKeys.title(titleId) }),
        queryClient.cancelQueries({ queryKey: profileReviewKeys.all }),
      ])
      const previous = [
        ...queryClient.getQueriesData({ queryKey: reviewKeys.title(titleId) }),
        ...queryClient.getQueriesData({ queryKey: profileReviewKeys.all }),
      ]
      updateTitlePages(queryClient, titleId, (page) =>
        updateReviewContent(page, reviewId, content.trim())
      )
      queryClient.setQueriesData<ProfileReviewsPage>(
        { queryKey: profileReviewKeys.all },
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
    onError: (_error, _variables, context) =>
      restoreSnapshot(queryClient, context?.previous as Snapshot | undefined),
    onSuccess: (review) => {
      updateTitlePages(queryClient, titleId, (page) => replaceReview(page, review))
      queryClient.setQueriesData<ProfileReviewsPage>(
        { queryKey: profileReviewKeys.all },
        (page) => {
          const current = page?.items.find((item) => item.id === review.id)
          return current ? replaceProfileReview(page, { ...current, ...review }) : page
        }
      )
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: reviewKeys.title(titleId) })
      queryClient.invalidateQueries({ queryKey: profileReviewKeys.all })
    },
  })
}

export function useDeleteReviewMutation(titleId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (reviewId: string) => db.deleteReview(reviewId),
    onMutate: async (reviewId) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: reviewKeys.title(titleId) }),
        queryClient.cancelQueries({ queryKey: profileReviewKeys.all }),
      ])
      const previous = [
        ...queryClient.getQueriesData({ queryKey: reviewKeys.title(titleId) }),
        ...queryClient.getQueriesData({ queryKey: profileReviewKeys.all }),
      ]
      updateTitlePages(queryClient, titleId, (page) => removeReview(page, reviewId))
      queryClient.setQueriesData<ProfileReviewsPage>(
        { queryKey: profileReviewKeys.all },
        (page) => removeProfileReview(page, reviewId)
      )
      return { previous }
    },
    onError: (_error, _reviewId, context) =>
      restoreSnapshot(queryClient, context?.previous as Snapshot | undefined),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: reviewKeys.title(titleId) })
      queryClient.invalidateQueries({ queryKey: profileReviewKeys.all })
      queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
  })
}

export function useReviewLikeMutation(titleId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ reviewId, liked }: { reviewId: string; liked: boolean }) =>
      liked ? db.unlikeReview(reviewId) : db.likeReview(reviewId),
    onMutate: async ({ reviewId, liked }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: reviewKeys.title(titleId) }),
        queryClient.cancelQueries({ queryKey: profileReviewKeys.all }),
      ])
      const previous = [
        ...queryClient.getQueriesData({ queryKey: reviewKeys.title(titleId) }),
        ...queryClient.getQueriesData({ queryKey: profileReviewKeys.all }),
      ]
      updateTitlePages(queryClient, titleId, (page) =>
        updateReviewLike(page, reviewId, !liked)
      )
      queryClient.setQueriesData<ProfileReviewsPage>(
        { queryKey: profileReviewKeys.all },
        (page) => updateProfileReviewLike(page, reviewId, !liked)
      )
      return { previous }
    },
    onError: (_error, _variables, context) =>
      restoreSnapshot(queryClient, context?.previous as Snapshot | undefined),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: reviewKeys.title(titleId) })
      queryClient.invalidateQueries({ queryKey: profileReviewKeys.all })
    },
  })
}
