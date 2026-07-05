import React, { useState } from 'react'
import { View, Text, Image, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import type { UserProfile } from '~/types'

interface GroupedAvatarProps {
  users: UserProfile[]
  limit?: number
  size?: number
}

interface AvatarItemProps {
  user: UserProfile
  index: number
  size: number
  totalUsers: number
  onPress: () => void
}

const AvatarItem = ({ user, index, size, totalUsers, onPress }: AvatarItemProps) => {
  const [imageError, setImageError] = useState(false)

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={{
        zIndex: totalUsers - index,
        marginLeft: index === 0 ? 0 : -10,
        width: size,
        height: size,
      }}
      className="rounded-full ring-2 ring-primary bg-surface items-center justify-center overflow-hidden"
    >
      {user.avatar_url && !imageError ? (
        <Image
          source={{ uri: user.avatar_url }}
          style={{ width: size, height: size }}
          className="rounded-full"
          onError={() => setImageError(true)}
        />
      ) : (
        <View className="w-full h-full items-center justify-center bg-[#CCCCCC]">
          <Ionicons name="person" size={size * 0.6} color="#666" />
        </View>
      )}
    </TouchableOpacity>
  )
}

export function GroupedAvatar({ users, limit = 5, size = 32 }: GroupedAvatarProps) {
  const router = useRouter()
  const visibleUsers = users.slice(0, limit)
  const remainingCount = Math.max(0, users.length - limit)

  if (users.length === 0) return null

  return (
    <View className="flex-row items-center">
      {visibleUsers.map((user, index) => (
        <AvatarItem
          key={user.id}
          user={user}
          index={index}
          size={size}
          totalUsers={visibleUsers.length}
          onPress={() => router.push(`/profile?userId=${user.id}`)}
        />
      ))}

      {remainingCount > 0 && (
        <View
          style={{
            zIndex: 0,
            marginLeft: -10,
            width: size,
            height: size,
          }}
          className="rounded-full ring-2 ring-primary bg-[#333] items-center justify-center"
        >
          <Text className="text-white text-[10px] font-bold">+{remainingCount}</Text>
        </View>
      )}
    </View>
  )
}
