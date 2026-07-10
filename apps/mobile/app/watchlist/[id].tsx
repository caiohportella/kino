import { useLocalSearchParams, useRouter, Stack } from 'expo-router'
import { useEffect, useState, useMemo, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  Alert,
  Share,
  RefreshControl,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as Clipboard from 'expo-clipboard'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  Easing,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated'
import { dbService } from '~/services/database'
import { getTMDbService } from '~/services/tmdb'
import { formatDate } from '@kino/core'

import type { Watchlist, UserProfile } from '~/types'
import { CreateWatchlistModal } from '~/components/modals/CreateWatchlistModal'
import { GroupedAvatar } from '~/components/common/GroupedAvatar'
import { ShareCodeBadge } from '~/components/watchlist/ShareCodeBadge'
import { useAuth } from '@/hooks/useAuth'
import { format } from 'date-fns'
import { useTranslation } from 'react-i18next'
import { Skeleton } from '~/components/common/Skeleton'
import { supabase } from '@/utils/supabase'
import type { SupabaseTitle, SupabaseWatchlistItem } from '~/types/supabase'

const AnimatedIonicons = Animated.createAnimatedComponent(Ionicons)

type WatchlistItemWithDetails = SupabaseWatchlistItem & {
  title: SupabaseTitle
  added_by_user?: Partial<UserProfile>
}

export default function WatchlistDetailScreen() {
  const { id } = useLocalSearchParams()
  const router = useRouter()
  const { user } = useAuth()
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()

  const [watchlist, setWatchlist] = useState<Watchlist | null>(null)
  const [items, setItems] = useState<WatchlistItemWithDetails[]>([])
  const [participants, setParticipants] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

  useEffect(() => {
    if (id) {
      loadWatchlistDetails()
    }
  }, [id])

  const loadWatchlistDetails = async () => {
    try {
      const details = await dbService.getWatchlist(id as string)
      setWatchlist(details)

      if (details) {
        // Fetch Items
        const { data: listItems, error } = await supabase
          .from('watchlist_items')
          .select(
            `
              *,
              title:titles(*)
            `
          )
          .eq('watchlist_id', id)

        if (error) throw error

        // Manually fetch profiles for "added_by" users to avoid FK issues
        let itemsWithProfiles: WatchlistItemWithDetails[] = listItems || []
        if (listItems && listItems.length > 0) {
          const userIds = [...new Set(listItems.map((item) => item.added_by).filter(Boolean))]

          if (userIds.length > 0) {
            const { data: profiles, error: profilesError } = await supabase
              .from('user_profiles')
              .select('id, avatar_url, display_name')
              .in('id', userIds)

            if (!profilesError && profiles) {
              const profilesMap = new Map(profiles.map((p) => [p.id, p]))
              itemsWithProfiles = listItems.map((item) => ({
                ...item,
                added_by_user: profilesMap.get(item.added_by),
              }))
            }
          }
        }

        setItems(itemsWithProfiles)

        // Fetch Owner and Collaborators
        const [owner, collaborators] = await Promise.all([
          dbService.getUserProfile(details.userId),
          dbService.getWatchlistCollaborators(details.id),
        ])

        const allParticipants = []
        if (owner) allParticipants.push(owner)
        if (collaborators) allParticipants.push(...collaborators)

        // Deduplicate just in case
        const uniqueParticipants = Array.from(
          new Map(allParticipants.map((item) => [item.id, item])).values()
        )
        setParticipants(uniqueParticipants)
      }
    } catch (error) {
      console.error('Error loading watchlist:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    loadWatchlistDetails()
  }, [id])

  const sortedItems = useMemo(() => {
    if (!items.length) return []
    return [...items].sort(
      (a, b) => new Date(b.added_at).getTime() - new Date(a.added_at).getTime()
    )
  }, [items])

  const copyProgress = useSharedValue(0)
  const codeOpacity = useSharedValue(1)

  const handleCopyCode = async () => {
    if (watchlist?.shareCode) {
      await Clipboard.setStringAsync(watchlist.shareCode)
      // Blink animation: Fade out -> Fade in -> Fade out -> Fade in
      codeOpacity.value = withSequence(
        withTiming(0.2, { duration: 400, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 400, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.2, { duration: 400, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 400, easing: Easing.inOut(Easing.ease) })
      )
    }
  }

  const handleCopyLink = async () => {
    if (watchlist?.shareCode) {
      const link = `kino://watchlist/join?code=${watchlist.shareCode}`
      await Clipboard.setStringAsync(link)

      // Trigger animation
      copyProgress.value = withTiming(1, {
        duration: 600,
        easing: Easing.out(Easing.exp),
      })
      setCopiedLink(true)

      // Reset after delay
      setTimeout(() => {
        copyProgress.value = withTiming(0, { duration: 400 })
        setCopiedLink(false)
      }, 2500)
    }
  }

  const fillStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateX: interpolate(
            copyProgress.value,
            [0, 1],
            [40, 0], // Button width approx 40
            Extrapolation.CLAMP
          ),
        },
      ],
      opacity: copyProgress.value,
    }
  })

  const iconStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          rotate: `${interpolate(copyProgress.value, [0, 1], [0, 360])}deg`,
        },
        {
          scale: interpolate(copyProgress.value, [0, 0.5, 1], [1, 0.8, 1]),
        },
      ],
    }
  })

  const blinkStyle = useAnimatedStyle(() => {
    return {
      opacity: codeOpacity.value,
    }
  })

  const handleDelete = () => {
    Alert.alert(t('watchlists.deleteWatchlist'), t('watchlists.deleteWatchlistConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await dbService.deleteWatchlist(id as string)
            router.back()
          } catch (error) {
            Alert.alert(t('common.error'), t('watchlists.failedToDeleteWatchlist'))
          }
        },
      },
    ])
  }

  const handleLeave = () => {
    Alert.alert(t('watchlists.leaveWatchlist'), t('watchlists.leaveWatchlistConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('watchlists.leave'),
        style: 'destructive',
        onPress: async () => {
          try {
            await dbService.leaveWatchlist(id as string)
            router.back()
          } catch (error) {
            console.error('Error leaving watchlist:', error)
            Alert.alert(t('common.error'), t('watchlists.failedToLeaveWatchlist'))
          }
        },
      },
    ])
  }

  const handleRemoveItem = (item: WatchlistItemWithDetails) => {
    Alert.alert(
      t('watchlists.removeFromListTitle'),
      t('watchlists.removeFromListConfirm', { title: item.title.title }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.remove'),
          style: 'destructive',
          onPress: async () => {
            if (!watchlist) return
            try {
              await dbService.removeFromWatchlist(watchlist.id, item.title.id)
              setItems((prev) => prev.filter((i) => i.id !== item.id))
            } catch (error) {
              console.error('Error removing item:', error)
              Alert.alert(t('common.error'), t('watchlists.failedToRemoveItem'))
            }
          },
        },
      ]
    )
  }

  if (loading && !refreshing) {
    return <Skeleton layout="watchlist-detail" />
  }

  if (!watchlist) {
    return (
      <View className="flex-1 bg-primary items-center justify-center">
        <Text className="text-text-secondary">{t('watchlists.notFound')}</Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-4">
          <Text className="text-accent">{t('title.goBack')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const isOwner = user?.id === watchlist.userId

  const renderHeader = () => (
    <View className="px-24 pt-2 pb-6 items-center">
      {/* Title & Description */}
      <Text className="text-4xl font-bold text-text-primary mb-8 pt-4 text-center uppercase">
        {watchlist.name}
      </Text>
      {watchlist.description && (
        <Text className="text-text-secondary text-base mb-10 text-center -mt-6">
          {watchlist.description}
        </Text>
      )}

      {/* Actions Section */}
      {(watchlist.isShared || isOwner) && watchlist.shareCode && (
        <View className="flex-row items-center gap-3 mb-6">
          <TouchableOpacity onPress={handleCopyCode}>
            <Animated.View style={blinkStyle}>
              <ShareCodeBadge label={watchlist.shareCode} variant="blue" className="px-3 py-2" />
            </Animated.View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleCopyLink}
            className="w-10 h-10 rounded-full border border-white/10 overflow-hidden items-center justify-center bg-surface relative"
            activeOpacity={1}
          >
            <Animated.View className="absolute inset-0 bg-[#1DB954]" style={fillStyle} />
            <AnimatedIonicons
              name={copiedLink ? 'checkmark' : 'link-outline'}
              size={20}
              color={copiedLink ? '#FFF' : '#1DB954'}
              style={iconStyle}
            />
          </TouchableOpacity>
        </View>
      )}

      {/* Participants */}
      {participants.length > 0 && (
        <View className="mb-6 justify-center items-center">
          <GroupedAvatar users={participants} limit={6} size={40} />
        </View>
      )}

      <View className="h-[1px] bg-white/10 w-full" />
    </View>
  )

  return (
    <View className="flex-1 bg-primary">
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: '',
          headerBackTitle: '',
          headerTintColor: '#fff',
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
          headerRight: () => (
            <View className="flex-row gap-3 items-center justify-evenly">
              {isOwner ? (
                <>
                  <TouchableOpacity
                    onPress={() => setShowEditModal(true)}
                    className="w-8 h-8 items-center justify-center rounded-full bg-white/10 mr-3"
                  >
                    <Ionicons name="pencil" size={16} color="#FFF" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleDelete}
                    className="w-8 h-8 items-center justify-center rounded-full bg-red-500/10"
                  >
                    <Ionicons name="trash-outline" size={16} color="#FF3B30" />
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  onPress={handleLeave}
                  className="w-8 h-8 ml-1 items-center justify-center rounded-full bg-red-500/10"
                >
                  <Ionicons name="log-out-outline" size={16} color="#FF3B30" />
                </TouchableOpacity>
              )}
            </View>
          ),
        }}
      />

      <FlatList
        data={sortedItems}
        keyExtractor={(item) => item.id}
        numColumns={3}
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        columnWrapperStyle={{ gap: 8, paddingHorizontal: 12 }}
        ListHeaderComponent={() => (
          <View>
            {refreshing && (
              <View className="py-4 items-center">
                <ActivityIndicator size="small" color="#1DB954" />
              </View>
            )}
            {renderHeader()}
          </View>
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#1DB954"
            colors={['#1DB954']}
          />
        }
        renderItem={({ item }) => {
          const tmdb = getTMDbService()
          const imageUrl = tmdb.getImageUrl(item.title.cover_image, 'w300')
          const addedBy = item.added_by_user

          const handlePress = () => {
            router.push(`/title/${item.title.tmdb_id}?type=${item.title.type}`)
          }

          return (
            <TouchableOpacity
              className="flex-1 mb-6 aspect-[2/3] max-w-[33%] bg-transparent relative"
              onPress={handlePress}
              onLongPress={() => item.added_by === user?.id && handleRemoveItem(item)}
            >
              <View className="w-full h-full rounded-lg overflow-hidden bg-surface">
                {imageUrl ? (
                  <Image source={{ uri: imageUrl }} className="w-full h-full" resizeMode="cover" />
                ) : (
                  <View className="w-full h-full items-center justify-center bg-[#333]">
                    <Ionicons name="image-outline" size={24} color="#666" />
                  </View>
                )}
              </View>

              {/* User Avatar Overlay */}
              {watchlist.isShared && addedBy && (
                <View className="absolute -bottom-5 left-1/2 -ml-5 z-10 shadow-sm">
                  <View className="w-10 h-10 rounded-full border-2 border-primary overflow-hidden bg-surface">
                    {addedBy.avatar_url ? (
                      <Image
                        source={{ uri: addedBy.avatar_url }}
                        className="w-full h-full"
                        resizeMode="cover"
                      />
                    ) : (
                      <View className="w-full h-full items-center justify-center bg-accent">
                        <Text className="text-xs font-bold text-white">
                          {addedBy.display_name?.charAt(0).toUpperCase() || 'U'}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              )}
            </TouchableOpacity>
          )
        }}
        ListEmptyComponent={
          <View className="py-20 items-center px-4">
            <Ionicons name="film-outline" size={48} color="#333" className="mb-4" />
            <Text className="text-text-secondary text-center text-lg mb-2">
              {t('watchlists.emptyList')}
            </Text>
            <Text className="text-text-secondary text-sm opacity-70 text-center">
              {t('watchlists.emptyListHint')}
            </Text>
          </View>
        }
        ListFooterComponent={
          watchlist.updatedAt ? (
            <View className="py-6 items-center">
              <Text className="text-text-secondary/50 text-xs">
                {t('common.lastUpdated')} {formatDate(watchlist.updatedAt)}
              </Text>
            </View>
          ) : null
        }
      />

      <CreateWatchlistModal
        visible={showEditModal}
        onClose={() => setShowEditModal(false)}
        initialValues={watchlist}
        onSuccess={(updatedList) => {
          setWatchlist(updatedList)
          setShowEditModal(false)
        }}
      />
    </View>
  )
}
