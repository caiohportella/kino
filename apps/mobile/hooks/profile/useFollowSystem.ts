// Hook for managing follow system operations
import { profileQueryKeys } from '@kino/core/cache'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import { Alert } from 'react-native'
import { dbService } from '~/services/database'
import type { FollowerInfo } from '~/types'
import type { MobileProfileRelationship } from './profileQueryOptions'

export interface UseFollowSystemReturn {
  followersCount: number | undefined
  followingCount: number | undefined
  isFollowing: boolean | undefined
  handleFollowToggle: () => Promise<void>
  handleOpenUserList: (type: 'followers' | 'following') => Promise<void>
  handleUserListAction: (userId: string) => Promise<void>
  userListModalVisible: boolean
  userListTitle: string
  userListType: 'followers' | 'following'
  userListUsers: FollowerInfo[]
  userListLoading: boolean
  setUserListModalVisible: (visible: boolean) => void
}

export function useFollowSystem(
  targetUserId: string | undefined,
  isOwnProfile: boolean,
  viewerId: string | undefined,
  relationship: MobileProfileRelationship | undefined,
  relationshipAvailable: boolean
): UseFollowSystemReturn {
  const queryClient = useQueryClient()
  const relationshipKey = targetUserId
    ? profileQueryKeys.relationship({
        profileId: targetUserId,
        viewerId: viewerId || 'anonymous',
      })
    : null

  // User List Modal State
  const [userListModalVisible, setUserListModalVisible] = useState(false)
  const [userListTitle, setUserListTitle] = useState('')
  const [userListType, setUserListType] = useState<'followers' | 'following'>('followers')
  const [userListUsers, setUserListUsers] = useState<FollowerInfo[]>([])
  const [userListLoading, setUserListLoading] = useState(false)

  const updateRelationship = useCallback(
    (update: (current: MobileProfileRelationship) => MobileProfileRelationship) => {
      if (!relationshipKey) return
      queryClient.setQueryData<MobileProfileRelationship>(relationshipKey, (current) =>
        current ? update(current) : current
      )
    },
    [queryClient, relationshipKey]
  )

  const invalidateRelationship = useCallback(async () => {
    if (!relationshipKey) return
    await queryClient.invalidateQueries({ exact: true, queryKey: relationshipKey })
  }, [queryClient, relationshipKey])

  const handleFollowToggle = useCallback(async () => {
    if (!relationshipAvailable) return
    if (!targetUserId || !viewerId || isOwnProfile || !relationship) return

    try {
      if (relationship?.isFollowing) {
        await dbService.unfollowUser(targetUserId)
        updateRelationship((current) => ({
          ...current,
          counts: {
            ...current.counts,
            followers: Math.max(0, current.counts.followers - 1),
          },
          isFollowing: false,
        }))
      } else {
        await dbService.followUser(targetUserId)
        updateRelationship((current) => ({
          ...current,
          counts: { ...current.counts, followers: current.counts.followers + 1 },
          isFollowing: true,
        }))
      }
      await invalidateRelationship()
    } catch (error) {
      console.error('Failed to toggle follow status', error)
      Alert.alert('Error', 'Failed to update follow status')
    }
  }, [
    invalidateRelationship,
    isOwnProfile,
    relationship,
    relationshipAvailable,
    targetUserId,
    updateRelationship,
    viewerId,
  ])

  const handleOpenUserList = useCallback(
    async (type: 'followers' | 'following') => {
      if (!targetUserId) return

      setUserListTitle(type === 'followers' ? 'Followers' : 'Following')
      setUserListType(type)
      setUserListModalVisible(true)
      setUserListLoading(true)

      try {
        const users =
          type === 'followers'
            ? await dbService.getFollowers(targetUserId)
            : await dbService.getFollowing(targetUserId)
        setUserListUsers(users)
      } catch (error) {
        console.error(`Failed to load ${type}`, error)
        Alert.alert('Error', `Failed to load ${type}`)
      } finally {
        setUserListLoading(false)
      }
    },
    [targetUserId]
  )

  const handleUserListAction = useCallback(
    async (userId: string) => {
      try {
        if (userListType === 'followers') {
          // Remove follower
          await dbService.removeFollower(userId)
          updateRelationship((current) => ({
            ...current,
            counts: {
              ...current.counts,
              followers: Math.max(0, current.counts.followers - 1),
            },
          }))
        } else {
          // Unfollow user
          await dbService.unfollowUser(userId)
          updateRelationship((current) => ({
            ...current,
            counts: {
              ...current.counts,
              following: Math.max(0, current.counts.following - 1),
            },
          }))
        }
        await invalidateRelationship()
        // Update list
        setUserListUsers((prev) => prev.filter((u) => u.id !== userId))
      } catch (error) {
        console.error('Action failed', error)
        Alert.alert('Error', 'Failed to perform action')
      }
    },
    [invalidateRelationship, updateRelationship, userListType]
  )

  return {
    followersCount: relationshipAvailable ? relationship?.counts.followers : undefined,
    followingCount: relationshipAvailable ? relationship?.counts.following : undefined,
    isFollowing: relationshipAvailable ? relationship?.isFollowing : undefined,
    handleFollowToggle,
    handleOpenUserList,
    handleUserListAction,
    userListModalVisible,
    userListTitle,
    userListType,
    userListUsers,
    userListLoading,
    setUserListModalVisible,
  }
}
