'use client'

import type { FollowerInfo } from '@kino/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useToast } from '@/components/toast-provider'
import { useTranslation } from '@/lib/localization/i18n'
import { invalidateProfileMutation } from '@/lib/profile/profile-invalidation'
import { db } from '@/lib/services'

export type ProfileSocialListType = 'followers' | 'following'

export type ProfileVisibilityScope =
  | {
      kind: 'public'
    }
  | {
      kind: 'authenticated'
      userId: string
    }

export type UseProfileSocialOptions = {
  isFollowingTarget: boolean
  targetUserId?: string
  viewerId?: string
  visibilityScope: ProfileVisibilityScope
}

export function useProfileSocial({
  isFollowingTarget,
  targetUserId,
  viewerId,
  visibilityScope,
}: UseProfileSocialOptions) {
  const queryClient = useQueryClient()
  const { notify } = useToast()
  const { t } = useTranslation()

  const [listType, setListType] = useState<ProfileSocialListType | null>(null)

  const followMutation = useMutation({
    mutationFn: async () => {
      if (!targetUserId) {
        return
      }

      if (isFollowingTarget) {
        await db.unfollowUser(targetUserId)
        return
      }

      await db.followUser(targetUserId)
    },

    onSuccess: () => {
      if (!targetUserId || !viewerId) {
        return
      }

      void invalidateProfileMutation(queryClient, {
        kind: 'follow',
        profileId: targetUserId,
        viewerId,
        visibilityScope,
      })
    },
  })

  const socialListQuery = useQuery({
    queryKey: ['profile-social-list', targetUserId, listType],

    queryFn: () => {
      if (!targetUserId || !listType) {
        return []
      }

      return listType === 'followers'
        ? db.getFollowers(targetUserId)
        : db.getFollowing(targetUserId)
    },

    enabled: Boolean(targetUserId && listType),
  })

  const socialListActionMutation = useMutation({
    mutationFn: async ({ isFollowing, userId }: { isFollowing: boolean; userId: string }) => {
      if (isFollowing) {
        await db.unfollowUser(userId)

        return {
          followedAt: undefined,
        }
      }

      return {
        followedAt: await db.followUser(userId),
      }
    },

    onMutate: async ({ isFollowing, userId }) => {
      const key = ['profile-social-list', targetUserId, listType] as const

      await queryClient.cancelQueries({
        queryKey: key,
      })

      const previous = queryClient.getQueryData<FollowerInfo[]>(key)

      queryClient.setQueryData<FollowerInfo[]>(key, (current) =>
        current?.map((entry) => {
          if (entry.id !== userId) {
            return entry
          }

          const nextIsFollowing = !isFollowing

          return {
            ...entry,
            isFollowing: nextIsFollowing,
            isMutual: nextIsFollowing && entry.isFollowedBy,
            mutualSince: undefined,
          }
        })
      )

      return {
        key,
        previous,
      }
    },

    onError: (_error, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(context.key, context.previous)
      }

      notify({
        tone: 'error',
        title: t(variables.isFollowing ? 'common.failed' : 'profile.failedToFollowUser'),
      })
    },

    onSuccess: ({ followedAt }, variables) => {
      const key = ['profile-social-list', targetUserId, listType] as const

      queryClient.setQueryData<FollowerInfo[]>(key, (current) =>
        current?.map((entry) => {
          if (entry.id !== variables.userId) {
            return entry
          }

          const isFollowing = !variables.isFollowing

          const isMutual = isFollowing && entry.isFollowedBy

          return {
            ...entry,
            isFollowing,
            isMutual,
            mutualSince: isMutual ? followedAt : undefined,
          }
        })
      )

      notify({
        tone: 'success',
        title: t(variables.isFollowing ? 'profile.unfollowedUser' : 'profile.followedUser'),
      })

      if (viewerId) {
        void invalidateProfileMutation(queryClient, {
          kind: 'follow',
          profileId: variables.userId,
          viewerId,
          visibilityScope,
        })
      }

      void queryClient.invalidateQueries({
        queryKey: ['profile-social-list'],
      })
    },
  })

  const openFollowers = () => {
    setListType('followers')
  }

  const openFollowing = () => {
    setListType('following')
  }

  const closeList = () => {
    setListType(null)
  }

  return {
    closeList,

    dialog: {
      actionPending: socialListActionMutation.isPending,

      error: socialListQuery.error,

      listType,

      loading: socialListQuery.isFetching,

      onAction: (profile: FollowerInfo) => {
        socialListActionMutation.mutate({
          isFollowing: profile.isFollowing,
          userId: profile.id,
        })
      },

      onOpenChange: (open: boolean) => {
        if (!open) {
          closeList()
        }
      },

      open: Boolean(listType),

      pendingUserId: socialListActionMutation.variables?.userId,

      users: socialListQuery.data ?? [],
    },

    followTarget: {
      isPending: followMutation.isPending,

      toggle: () => {
        if (!targetUserId) {
          return
        }

        followMutation.mutate()
      },
    },

    listType,

    openFollowers,
    openFollowing,
  }
}
