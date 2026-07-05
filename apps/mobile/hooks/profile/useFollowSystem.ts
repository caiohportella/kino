// Hook for managing follow system operations
import { useState, useCallback, useEffect } from 'react'
import { Alert } from 'react-native'
import { dbService } from '~/services/database'
import type { FollowerInfo } from '~/types'

export interface UseFollowSystemReturn {
  followersCount: number
  followingCount: number
  isFollowing: boolean
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
  isOwnProfile: boolean
): UseFollowSystemReturn {
  const [followersCount, setFollowersCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [isFollowing, setIsFollowing] = useState(false)

  // User List Modal State
  const [userListModalVisible, setUserListModalVisible] = useState(false)
  const [userListTitle, setUserListTitle] = useState('')
  const [userListType, setUserListType] = useState<'followers' | 'following'>('followers')
  const [userListUsers, setUserListUsers] = useState<FollowerInfo[]>([])
  const [userListLoading, setUserListLoading] = useState(false)

  // Load follow counts and status
  const loadFollowData = useCallback(async () => {
    if (!targetUserId) return

    try {
      const [followCounts, followStatus] = await Promise.all([
        dbService.getFollowCounts(targetUserId),
        !isOwnProfile ? dbService.checkFollowStatus(targetUserId) : Promise.resolve(false),
      ])

      setFollowersCount(followCounts.followers)
      setFollowingCount(followCounts.following)
      setIsFollowing(followStatus)
    } catch (error) {
      console.error('Failed to load follow data', error)
    }
  }, [targetUserId, isOwnProfile])

  useEffect(() => {
    loadFollowData()
  }, [loadFollowData])

  const handleFollowToggle = useCallback(async () => {
    if (!targetUserId) return

    try {
      if (isFollowing) {
        await dbService.unfollowUser(targetUserId)
        setIsFollowing(false)
        setFollowersCount((prev) => Math.max(0, prev - 1))
      } else {
        await dbService.followUser(targetUserId)
        setIsFollowing(true)
        setFollowersCount((prev) => prev + 1)
      }
    } catch (error) {
      console.error('Failed to toggle follow status', error)
      Alert.alert('Error', 'Failed to update follow status')
    }
  }, [targetUserId, isFollowing])

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
          setFollowersCount((prev) => Math.max(0, prev - 1))
        } else {
          // Unfollow user
          await dbService.unfollowUser(userId)
          setFollowingCount((prev) => Math.max(0, prev - 1))
          // If we just unfollowed the target user from the modal (unlikely context but possible), update isFollowing
          if (userId === targetUserId) {
            setIsFollowing(false)
          }
        }
        // Update list
        setUserListUsers((prev) => prev.filter((u) => u.id !== userId))
      } catch (error) {
        console.error('Action failed', error)
        Alert.alert('Error', 'Failed to perform action')
      }
    },
    [userListType, targetUserId]
  )

  return {
    followersCount,
    followingCount,
    isFollowing,
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
