import {
  View,
  Text,
  Modal,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { FollowerInfo } from '~/types'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { EmptyState } from '../../components/EmptyState'
import { formatDate } from '@kino/core'

interface UserListModalProps {
  visible: boolean
  onClose: () => void
  title: string
  users: FollowerInfo[]
  loading?: boolean
  onUserPress: (userId: string) => void
  onAction?: (userId: string) => void
  actionLabel?: string
}

export default function UserListModal({
  visible,
  onClose,
  title,
  users,
  loading = false,
  onUserPress,
  onAction,
  actionLabel,
}: UserListModalProps) {
  const insets = useSafeAreaInsets()

  return (
    <Modal
      animationType="slide"
      presentationStyle="pageSheet"
      visible={visible}
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-surface">
        {/* Header */}
        <View className="flex-row items-center justify-between p-4 border-b border-white/10 bg-surface">
          <Text className="text-3xl font-black text-white italic tracking-tighter">
            {title.toUpperCase()}
            <Text className="text-accent">.</Text>
          </Text>
        </View>

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="small" color="#1DB954" />
          </View>
        ) : (
          <FlatList
            data={users}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 16 }}
            renderItem={({ item }) => (
              <View className="flex-row items-center justify-between mb-4">
                <TouchableOpacity
                  className="flex-1 flex-row items-center"
                  onPress={() => {
                    onClose()
                    onUserPress(item.id)
                  }}
                >
                  <View className="h-12 w-12 rounded-full bg-surface-variant overflow-hidden mr-3 items-center justify-center border border-white/10">
                    {item.avatar_url ? (
                      <Image source={{ uri: item.avatar_url }} className="w-full h-full" />
                    ) : (
                      <Ionicons name="person" size={24} color="#666" />
                    )}
                  </View>
                  <View>
                    <Text className="text-text-primary font-bold text-base">
                      {item.display_name || item.username}
                    </Text>
                    {item.username && (
                      <Text className="text-text-secondary text-sm">@{item.username}</Text>
                    )}
                    {item.isMutual && item.mutualSince && (
                      <Text className="text-accent text-xs mt-0.5">
                        Mutuals since {formatDate(item.mutualSince)}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>

                {onAction && actionLabel && (
                  <TouchableOpacity
                    onPress={() => onAction(item.id)}
                    className="bg-surface border border-white/20 px-3 py-1.5 rounded-full ml-2"
                  >
                    <Text className="text-text-primary text-xs font-semibold">{actionLabel}</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
            ListEmptyComponent={
              <EmptyState
                title="No users found"
                description="Try searching for a different username."
                image={require('../../assets/illustrations/user-not-found.png')}
              />
            }
          />
        )}
      </View>
    </Modal>
  )
}
