'use client'

import { useReviewLikeMutation } from '@/hooks/use-review-like-mutation'

export function useActivityReviewLikeMutation() {
  return useReviewLikeMutation({ kind: 'activity' })
}
