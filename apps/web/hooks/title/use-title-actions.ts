'use client'

import type { MediaType, TitleDetails, WatchType } from '@kino/core'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { db } from '@/lib/services'

type UserData = {
  userRating: Awaited<ReturnType<typeof db.getUserRating>>
  lastWatch: Awaited<ReturnType<typeof db.getLastWatchEntry>>
  isWatchlisted: boolean
}

/**
 * Bundles every mutation the title page triggers: rating a movie, deleting a
 * movie history entry, and logging/removing a diary entry. Each mutation
 * keeps the relevant caches (`title-user-data`, `title-stats`, `diary`,
 * `profile`) in sync on success.
 */
export function useTitleActions({
  title,
  type,
  userId,
}: {
  title: TitleDetails | undefined
  type: MediaType
  userId: string | undefined
}) {
  const queryClient = useQueryClient()
  const userDataKey = ['title-user-data', title?.id, userId] as const

  function getCurrentUserData() {
    return queryClient.getQueryData<UserData>(userDataKey)
  }

  const rateMutation = useMutation({
    mutationFn: (rating: number) => {
      const existingRating = getCurrentUserData()?.userRating
      return db.rateTitle(
        title!.id,
        rating,
        (existingRating?.watchType as WatchType) ?? 'first-time',
        existingRating?.watchedAt ?? new Date()
      )
    },
    onSuccess: (userRating) => {
      queryClient.setQueryData<UserData>(userDataKey, (current) =>
        current ? { ...current, userRating } : current
      )
      queryClient.invalidateQueries({ queryKey: userDataKey })
      queryClient.invalidateQueries({
        queryKey: ['title-stats', title?.id, type],
      })
      queryClient.invalidateQueries({ queryKey: ['profile', userId] })
    },
  })

  const deleteMovieEntryMutation = useMutation({
    mutationFn: () => db.removeMediaHistory(title!.id, 'movie'),
    onSuccess: () => {
      queryClient.setQueryData<UserData>(userDataKey, (current) =>
        current ? { ...current, userRating: null, lastWatch: null } : current
      )
      queryClient.invalidateQueries({ queryKey: userDataKey })
      queryClient.invalidateQueries({
        queryKey: ['title-stats', title?.id, type],
      })
      queryClient.invalidateQueries({ queryKey: ['diary', userId] })
      queryClient.invalidateQueries({ queryKey: ['profile', userId] })
    },
  })

  return { rateMutation, deleteMovieEntryMutation, queryClient, userDataKey }
}
