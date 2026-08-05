'use client'

import {
  activityQueryKeys,
  insertViewerReview,
  type KinoReviewAuthor,
  type MediaType,
  type ProfileReviewsPage,
  profileReviewKeys,
  type Review,
  removeProfileReview,
  removeReview,
  replaceProfileReview,
  replaceReview,
  reviewKeys,
  type TitleReviewsPage,
  updateReviewContent,
} from '@kino/core'
import { type InfiniteData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useReviewLikeMutation as useSharedReviewLikeMutation } from '@/hooks/use-review-like-mutation'
import { invalidateProfileMutation } from '@/lib/profile-invalidation'
import { db } from '@/lib/services'
import { useAuthStore } from '@/stores/auth-store'

type Snapshot = [readonly unknown[], unknown][]
type ProfileReviewCache = ProfileReviewsPage | InfiniteData<ProfileReviewsPage>

function restoreSnapshot(
  queryClient: ReturnType<typeof useQueryClient>,
  snapshot: Snapshot | undefined
) {
  for (const [key, data] of snapshot ?? []) {
    queryClient.setQueryData(key, data)
  }
}

function updateTitlePages(
  queryClient: ReturnType<typeof useQueryClient>,
  titleId: string,
  updater: (page: TitleReviewsPage | undefined) => TitleReviewsPage | undefined
) {
  queryClient.setQueriesData<TitleReviewsPage>(
    {
      queryKey: reviewKeys.title(titleId),
    },
    updater
  )
}

function updateProfileReviewCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  updater: (page: ProfileReviewsPage) => ProfileReviewsPage
) {
  queryClient.setQueriesData<ProfileReviewCache>(
    {
      queryKey: profileReviewKeys.all,
    },
    (cache) => {
      if (!cache) {
        return cache
      }

      if ('pages' in cache) {
        return {
          ...cache,
          pages: cache.pages.map(updater),
        }
      }

      return updater(cache)
    }
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
  const viewerId = useAuthStore((state) => state.user?.id)

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
      await queryClient.cancelQueries({
        queryKey: reviewKeys.title(variables.titleId),
      })

      const previous = queryClient.getQueriesData({
        queryKey: reviewKeys.title(variables.titleId),
      })

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

      return {
        previous,
      }
    },

    onError: (_error, _variables, context) => {
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
      const authorProfileId = variables.author.id

      queryClient.invalidateQueries({
        queryKey: reviewKeys.title(variables.titleId),
      })
      queryClient.invalidateQueries({
        queryKey: profileReviewKeys.all,
      })
      queryClient.invalidateQueries({
        queryKey: activityQueryKeys.all,
      })

      if (viewerId) {
        void invalidateProfileMutation(queryClient, {
          kind: 'review',
          profileId: authorProfileId,
          visibilityScope: {
            kind: 'authenticated',
            userId: viewerId,
          },
        })
      }
    },
  })
}

export function useUpdateReviewMutation(titleId: string) {
  const queryClient = useQueryClient()
  const viewerId = useAuthStore((state) => state.user?.id)

  return useMutation({
    mutationFn: ({ reviewId, content }: { reviewId: string; content: string }) =>
      db.updateReview(reviewId, content),

    onMutate: async ({ reviewId, content }) => {
      await Promise.all([
        queryClient.cancelQueries({
          queryKey: reviewKeys.title(titleId),
        }),
        queryClient.cancelQueries({
          queryKey: profileReviewKeys.all,
        }),
      ])

      const previous = [
        ...queryClient.getQueriesData({
          queryKey: reviewKeys.title(titleId),
        }),
        ...queryClient.getQueriesData({
          queryKey: profileReviewKeys.all,
        }),
      ]

      updateTitlePages(queryClient, titleId, (page) =>
        updateReviewContent(page, reviewId, content.trim())
      )

      updateProfileReviewCaches(queryClient, (page) => {
        const current = page.items.find((item) => item.id === reviewId)

        return current
          ? (replaceProfileReview(page, {
              ...current,
              content: content.trim(),
              updatedAt: new Date().toISOString(),
            }) ?? page)
          : page
      })

      return {
        previous,
      }
    },

    onError: (_error, _variables, context) => {
      restoreSnapshot(queryClient, context?.previous as Snapshot | undefined)
    },

    onSuccess: (review) => {
      updateTitlePages(queryClient, titleId, (page) => replaceReview(page, review))

      updateProfileReviewCaches(queryClient, (page) => {
        const current = page.items.find((item) => item.id === review.id)

        return current
          ? (replaceProfileReview(page, {
              ...current,
              ...review,
            }) ?? page)
          : page
      })
    },

    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: reviewKeys.title(titleId),
      })
      queryClient.invalidateQueries({
        queryKey: profileReviewKeys.all,
      })
      queryClient.invalidateQueries({
        queryKey: activityQueryKeys.all,
      })

      if (viewerId) {
        void invalidateProfileMutation(queryClient, {
          kind: 'review',
          profileId: viewerId,
          visibilityScope: {
            kind: 'authenticated',
            userId: viewerId,
          },
        })
      }
    },
  })
}

export function useDeleteReviewMutation(titleId: string) {
  const queryClient = useQueryClient()
  const viewerId = useAuthStore((state) => state.user?.id)

  return useMutation({
    mutationFn: (reviewId: string) => db.deleteReview(reviewId),

    onMutate: async (reviewId) => {
      await Promise.all([
        queryClient.cancelQueries({
          queryKey: reviewKeys.title(titleId),
        }),
        queryClient.cancelQueries({
          queryKey: profileReviewKeys.all,
        }),
      ])

      const previous = [
        ...queryClient.getQueriesData({
          queryKey: reviewKeys.title(titleId),
        }),
        ...queryClient.getQueriesData({
          queryKey: profileReviewKeys.all,
        }),
      ]

      updateTitlePages(queryClient, titleId, (page) => removeReview(page, reviewId))

      updateProfileReviewCaches(queryClient, (page) => removeProfileReview(page, reviewId) ?? page)

      return {
        previous,
      }
    },

    onError: (_error, _reviewId, context) => {
      restoreSnapshot(queryClient, context?.previous as Snapshot | undefined)
    },

    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: reviewKeys.title(titleId),
      })
      queryClient.invalidateQueries({
        queryKey: profileReviewKeys.all,
      })
      queryClient.invalidateQueries({
        queryKey: activityQueryKeys.all,
      })

      if (viewerId) {
        void invalidateProfileMutation(queryClient, {
          kind: 'review',
          profileId: viewerId,
          visibilityScope: {
            kind: 'authenticated',
            userId: viewerId,
          },
        })
      }
    },
  })
}

export function useReviewLikeMutation(titleId: string) {
  return useSharedReviewLikeMutation({
    kind: 'title',
    titleId,
  })
}
