import { useState, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'expo-router'
import { CreateWatchlistModal } from '~/components/modals/CreateWatchlistModal'
import { useTranslation } from 'react-i18next'

import { ScreenHeader } from '~/components/layout/ScreenHeader'
import { ShareCodeBadge } from '~/components/watchlist/ShareCodeBadge'
import { Skeleton } from '~/components/common/Skeleton'
import { useUserWatchlists, USER_KEYS } from '@/hooks/useDatabase'
import { useQueryClient } from '@tanstack/react-query'
import { formatDate } from '@kino/core'

export default function WatchlistsScreen() {
  const router = useRouter()
  const { isAuthenticated } = useAuth()
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // Query
  const { data: watchlists = [], isLoading: loading } = useUserWatchlists()

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await queryClient.invalidateQueries({ queryKey: USER_KEYS.watchlists('me') })
    setRefreshing(false)
  }, [queryClient])

  if (!isAuthenticated) {
    return (
      <SafeAreaView className="flex-1 bg-primary">
        <View className="flex-1 items-center justify-center p-4">
          <Text className="mb-4 text-xl font-bold text-text-primary">{t('watchlists.title')}</Text>
          <Text className="mb-6 text-center text-text-secondary">
            {t('watchlists.loginPrompt')}
          </Text>
          <TouchableOpacity
            className="rounded-lg bg-accent px-6 py-3"
            onPress={() => router.push('/login')}
          >
            <Text className="font-semibold text-white">{t('auth.logIn')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  if (loading && !refreshing) {
    return <Skeleton layout="watchlists" />
  }

  return (
    <View className="flex-1 bg-primary">
      <View className="flex-1">
        <ScreenHeader
          title={t('watchlists.title')}
          action={{
            icon: 'plus',
            color: '#1DB954',
            onPress: () => setShowCreateModal(true),
          }}
        />

        {watchlists.length === 0 ? (
          <View className="flex-1 items-center justify-center p-4">
            <Text className="mb-4 text-center text-text-secondary">
              {t('watchlists.emptyState')}
            </Text>
            <TouchableOpacity
              className="rounded-lg bg-accent px-6 py-3"
              onPress={() => setShowCreateModal(true)}
            >
              <Text className="font-semibold text-white">{t('watchlists.createWatchlist')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={watchlists}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View className="px-4">
                <TouchableOpacity
                  className="mb-3 rounded-xl bg-surface p-4 border border-white/5"
                  onPress={() => router.push(`/watchlist/${item.id}`)}
                >
                  <View className="flex-row items-center justify-between mb-2">
                    <View className="flex items-start flex-1">
                      <Text className="text-xl font-bold text-text-primary mr-2" numberOfLines={1}>
                        {item.name}
                      </Text>

                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#666" />
                  </View>

                  {item.description && (
                    <Text className="text-text-secondary text-sm mb-3" numberOfLines={2}>
                      {item.description}
                    </Text>
                  )}

                  <View className="flex-row items-center justify-between border-t border-white/5 pt-3">
                    <Text className="text-text-secondary/50 text-xs">
                      {t('watchlists.created')} {formatDate(item.createdAt)}
                    </Text>
                    {item.isShared && (
                      <ShareCodeBadge label={t('watchlists.shared')} variant="blue" className='mb-2' />
                    )}
                  </View>
                </TouchableOpacity>
              </View>
            )}
            ListHeaderComponent={
              refreshing ? (
                <View className="py-4 items-center">
                  <ActivityIndicator size="small" color="#1DB954" />
                </View>
              ) : null
            }
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#1DB954"
                colors={['#1DB954']}
              />
            }
            contentContainerStyle={{ paddingVertical: 12, paddingBottom: 100 }}
          />
        )}
      </View>

      <CreateWatchlistModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: USER_KEYS.watchlists('me') })
          setShowCreateModal(false)
        }}
      />
    </View>
  )
}
