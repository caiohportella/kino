// User search modal component
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  FlatList,
  Image,
  ActivityIndicator,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import type { UserProfile } from '~/types'

interface UserSearchModalProps {
  visible: boolean
  onClose: () => void
  searchQuery: string
  onSearchChange: (query: string) => void
  searchResults: UserProfile[]
  isSearching: boolean
  onUserPress: (userId: string) => void
}

export function UserSearchModal({
  visible,
  onClose,
  searchQuery,
  onSearchChange,
  searchResults,
  isSearching,
  onUserPress,
}: UserSearchModalProps) {
  const insets = useSafeAreaInsets()

  return (
    <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={onClose}>
      <View className="flex-1 bg-primary" style={{ paddingTop: insets.top }}>
        <View className="flex-row items-center p-4 border-b border-white/10">
          <View className="flex-1 flex-row items-center bg-surface rounded-lg px-3 py-2 mr-3">
            <Ionicons name="search" size={20} color="#999" />
            <TextInput
              className="flex-1 ml-2 text-text-primary text-base"
              placeholder="Search for a username..."
              placeholderTextColor="#999"
              value={searchQuery}
              onChangeText={onSearchChange}
              autoFocus
              autoCapitalize="none"
            />
            {isSearching && <ActivityIndicator size="small" color="#1DB954" />}
          </View>
          <TouchableOpacity onPress={onClose}>
            <Text className="text-text-primary font-semibold">Close</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={searchResults}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              className="flex-row items-center mb-4"
              onPress={() => {
                onClose()
                onUserPress(item.id)
              }}
            >
              <View className="h-12 w-12 rounded-full bg-surface overflow-hidden mr-3 items-center justify-center">
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
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            searchQuery.length >= 2 && !isSearching ? (
              <Text className="text-text-secondary text-center mt-8">No users found</Text>
            ) : null
          }
        />
      </View>
    </Modal>
  )
}
