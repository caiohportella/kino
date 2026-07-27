import {
  insertViewerReview,
  type KinoReviewAuthor,
  KinoDatabaseService,
  type MediaType,
  removeReview,
  replaceReview,
  reviewKeys,
  type TitleReviewsPage,
  updateReviewContent,
  updateReviewLike,
} from '@kino/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/utils/api/supabase'

const reviewsDb = new KinoDatabaseService(supabase)

export function useTitleReviews(titleId: string, enabled = true) {
  return useQuery({
    queryKey: reviewKeys.title(titleId),
    queryFn: () => reviewsDb.getTitleReviews(titleId),
    enabled: enabled && Boolean(titleId),
    staleTime: 60_000,
  })
}

function useReviewCache(titleId: string) {
  const queryClient = useQueryClient()
  const key = reviewKeys.title(titleId)
  return {
    queryClient,
    key,
    snapshot: () => queryClient.getQueryData<TitleReviewsPage>(key),
    update: (updater: (page: TitleReviewsPage | undefined) => TitleReviewsPage | undefined) =>
      queryClient.setQueryData(key, updater),
  }
}

export function useCreateReviewMutation(titleId: string) {
  const cache = useReviewCache(titleId)
  return useMutation({
    mutationFn: ({
      mediaType,
      content,
    }: {
      mediaType: MediaType
      content: string
      author: KinoReviewAuthor
    }) => reviewsDb.createReview(titleId, mediaType, content),
    onMutate: async (variables) => {
      await cache.queryClient.cancelQueries({ queryKey: cache.key })
      const previous = cache.snapshot()
      const now = new Date().toISOString()
      cache.update((page) =>
        insertViewerReview(page, {
          id: `optimistic:${titleId}`,
          userId: variables.author.id,
          titleId,
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
        })
      )
      return { previous }
    },
    onError: (_error, _variables, context) =>
      cache.queryClient.setQueryData(cache.key, context?.previous),
    onSuccess: (review) =>
      cache.update((page) => {
        const withoutOptimistic = page
          ? {
              ...page,
              items: page.items.filter((item) => !item.id.startsWith('optimistic:')),
              totalCount: Math.max(0, page.totalCount - 1),
            }
          : page
        return insertViewerReview(withoutOptimistic, review)
      }),
    onSettled: () => cache.queryClient.invalidateQueries({ queryKey: cache.key }),
  })
}

export function useUpdateReviewMutation(titleId: string) {
  const cache = useReviewCache(titleId)
  return useMutation({
    mutationFn: ({ reviewId, content }: { reviewId: string; content: string }) =>
      reviewsDb.updateReview(reviewId, content),
    onMutate: async ({ reviewId, content }) => {
      await cache.queryClient.cancelQueries({ queryKey: cache.key })
      const previous = cache.snapshot()
      cache.update((page) => updateReviewContent(page, reviewId, content))
      return { previous }
    },
    onError: (_error, _variables, context) =>
      cache.queryClient.setQueryData(cache.key, context?.previous),
    onSuccess: (review) => cache.update((page) => replaceReview(page, review)),
    onSettled: () => cache.queryClient.invalidateQueries({ queryKey: cache.key }),
  })
}

export function useDeleteReviewMutation(titleId: string) {
  const cache = useReviewCache(titleId)
  return useMutation({
    mutationFn: (reviewId: string) => reviewsDb.deleteReview(reviewId),
    onMutate: async (reviewId) => {
      await cache.queryClient.cancelQueries({ queryKey: cache.key })
      const previous = cache.snapshot()
      cache.update((page) => removeReview(page, reviewId))
      return { previous }
    },
    onError: (_error, _variables, context) =>
      cache.queryClient.setQueryData(cache.key, context?.previous),
    onSettled: () => cache.queryClient.invalidateQueries({ queryKey: cache.key }),
  })
}

export function useReviewLikeMutation(titleId: string) {
  const cache = useReviewCache(titleId)
  return useMutation({
    mutationFn: ({ reviewId, liked }: { reviewId: string; liked: boolean }) =>
      liked ? reviewsDb.unlikeReview(reviewId) : reviewsDb.likeReview(reviewId),
    onMutate: async ({ reviewId, liked }) => {
      await cache.queryClient.cancelQueries({ queryKey: cache.key })
      const previous = cache.snapshot()
      cache.update((page) => updateReviewLike(page, reviewId, !liked))
      return { previous }
    },
    onError: (_error, _variables, context) =>
      cache.queryClient.setQueryData(cache.key, context?.previous),
    onSettled: () => cache.queryClient.invalidateQueries({ queryKey: cache.key }),
  })
}
