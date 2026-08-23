'use client'

import { useReviewLikeMutation } from '@/hooks/reviews/use-review-like-mutation'

export function useActivityReviewLikeMutation() {
  return useReviewLikeMutation({ kind: 'activity' })
}
