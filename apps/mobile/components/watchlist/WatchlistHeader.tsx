import { Ionicons } from '@expo/vector-icons'
import { BlurView } from 'expo-blur'
import { Image, Text, TouchableOpacity, View } from 'react-native'
import type { UserProfile, Watchlist } from '~/types'

interface WatchlistHeaderProps {
  watchlist: Watchlist
  collaborators?: UserProfile[]
  sortOption: 'release_date' | 'added_latest' | 'added_oldest'
  onSortChange: (option: 'release_date' | 'added_latest' | 'added_oldest') => void
}

export function WatchlistHeader({
  watchlist,
  collaborators = [],
  sortOption,
  onSortChange,
}: WatchlistHeaderProps) {
  return (
    <View className="bg-surface pb-4 border-b border-white/10">
      <View className="p-6 items-center">
        <Text className="text-3xl font-bold text-text-primary text-center mb-2">
          {watchlist.name}
        </Text>
        {watchlist.description && (
          <Text className="text-text-secondary text-center mb-4">{watchlist.description}</Text>
        )}

        {/* Collaborators Row */}
        {collaborators.length > 0 && (
          <View className="flex-row items-center justify-center mb-4">
            {collaborators.map((user, index) => (
              <View
                key={user.id}
                className={`w-8 h-8 rounded-full border-2 border-surface overflow-hidden -ml-2 first:ml-0 bg-zinc-800 items-center justify-center`}
                style={{ zIndex: 10 - index }}
              >
                {user.avatar_url ? (
                  <Image source={{ uri: user.avatar_url }} className="w-full h-full" />
                ) : (
                  <Text className="text-xs text-text-secondary font-bold">
                    {(user.display_name?.[0] || user.username?.[0] || '?').toUpperCase()}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}

        {watchlist.isShared && watchlist.shareCode && (
          <View className="mt-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1">
            <Text className="font-mono text-xs tracking-widest text-accent">
              CODE: {watchlist.shareCode}
            </Text>
          </View>
        )}
      </View>

      {/* Sort Controls */}
      <View className="px-4">
        <View className="flex-row bg-black/20 p-1 rounded-lg">
          <TouchableOpacity
            className={`flex-1 py-1.5 rounded-md items-center ${sortOption === 'release_date' ? 'bg-white/10' : ''}`}
            onPress={() => onSortChange('release_date')}
          >
            <Text
              className={`text-xs ${sortOption === 'release_date' ? 'text-white font-semibold' : 'text-text-secondary'}`}
            >
              Release Date
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className={`flex-1 py-1.5 rounded-md items-center ${sortOption === 'added_latest' ? 'bg-white/10' : ''}`}
            onPress={() => onSortChange('added_latest')}
          >
            <Text
              className={`text-xs ${sortOption === 'added_latest' ? 'text-white font-semibold' : 'text-text-secondary'}`}
            >
              Latest Added
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className={`flex-1 py-1.5 rounded-md items-center ${sortOption === 'added_oldest' ? 'bg-white/10' : ''}`}
            onPress={() => onSortChange('added_oldest')}
          >
            <Text
              className={`text-xs ${sortOption === 'added_oldest' ? 'text-white font-semibold' : 'text-text-secondary'}`}
            >
              Oldest Added
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}
