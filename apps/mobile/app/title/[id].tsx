import { useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  Image,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Share,
  Linking,
} from 'react-native'
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { dbService } from '~/services/database'
import { RatingStars } from '~/components/common/RatingStars'
import { SeasonSection } from '~/components/title/SeasonSection'
import { FriendRatings } from '~/components/title/FriendRatings'
import { WatchlistSelectorModal } from '~/components/modals/WatchlistSelectorModal'
import { PersonalityModal } from '~/components/modals/PersonalityModal'
import { CommunityStats } from '~/components/title/CommunityStats'
import { useAuth } from '@/hooks/useAuth'
import type { MediaType } from '~/types'
import { useTitleMetadata, useTitleUserData, TITLE_DATA_KEYS } from '@/hooks/useTitleData'
import { useFriendTitleRatings } from '~/hooks/data/useFriendRatings'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useOscarData, getOscarNominationsLegacy } from '~/services/awards'
import { useTheaterStatus } from '~/hooks/data/useTheaterStatus'

export default function TitleDetailScreen() {
  const { id, type } = useLocalSearchParams<{ id: string; type: MediaType }>()
  const router = useRouter()
  const { user, isAuthenticated } = useAuth()
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [showWatchlistModal, setShowWatchlistModal] = useState(false)
  const [selectedPersonId, setSelectedPersonId] = useState<number | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const tmdbId = parseInt(id)

  // 1. Fetch Metadata (Cached)
  const metaQuery = useTitleMetadata(tmdbId, type)
  const title = metaQuery.data

  // 2. Fetch User Data (Live-ish)
  const userQuery = useTitleUserData(title?.id, user?.id)
  const { userRating, isWatched, isWatchlisted } = userQuery.data || {
    userRating: null,
    isWatched: false,
    isWatchlisted: false,
  }

  const friendRatingsQuery = useFriendTitleRatings(title?.id, isAuthenticated)
  const friendRatings = friendRatingsQuery.data || []

  const { data: awards } = useOscarData(2026)
  const nominations = awards ? awards[tmdbId] : getOscarNominationsLegacy(tmdbId)

  // 3. Theater Status
  const theaterStatusQuery = useTheaterStatus(tmdbId, type)
  const isInTheaters = theaterStatusQuery.data

  const loading = metaQuery.isLoading

  const handleRate = async (rating: number) => {
    if (!isAuthenticated) {
      Alert.alert(t('title.loginRequired'), t('title.loginToRate'))
      router.push('/login')
      return
    }

    if (!title) return

    try {
      // Default to first-time for quick rating, or use existing if set
      const currentWatchType = userRating?.watchType || 'first-time'

      await dbService.rateTitle(title.id, rating, currentWatchType, new Date())

      // Invalidate user data to refresh stats and rating
      queryClient.invalidateQueries({
        queryKey: TITLE_DATA_KEYS.userData(title.id),
      })
      setRefreshKey((prev) => prev + 1)
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to save rating')
    }
  }

  const handleShare = async () => {
    if (!title) return
    try {
      await Share.share({
        message: t('title.checkOut', { title: title.title }),
      })
    } catch (_error) { }
  }

  const handleAddToWatchlist = async () => {
    if (!isAuthenticated) {
      Alert.alert(t('title.loginRequired'), t('title.loginToWatchlist'))
      router.push('/login')
      return
    }
    setShowWatchlistModal(true)
  }

  const handleAddToDiary = async () => {
    if (!isAuthenticated) {
      Alert.alert(t('title.loginRequired'), t('title.loginToDiary'))
      router.push('/login')
      return
    }

    if (!title) return

    try {
      if (isWatched) {
        // Toggle behavior: remove entirely if already watched
        Alert.alert(
          t('title.removeHistory'),
          t('title.removeHistoryConfirm'),
          [
            { text: t('common.cancel'), style: 'cancel' },
            {
              text: t('common.delete'),
              style: 'destructive',
              onPress: async () => {
                try {
                  await dbService.removeMediaHistory(title.id, title.type)
                  queryClient.invalidateQueries({
                    queryKey: TITLE_DATA_KEYS.userData(title.id),
                  })
                  // Also invalidate community stats as they might change
                  setRefreshKey((prev) => prev + 1)
                } catch (error) {
                  Alert.alert('Error', error instanceof Error ? error.message : 'Failed to remove from diary')
                }
              }
            }
          ]
        )
      } else {
        await dbService.addWatchDiaryEntry(title.id, new Date(), 'first-time')
        queryClient.invalidateQueries({
          queryKey: TITLE_DATA_KEYS.userData(title.id),
        })
      }
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to process diary action')
    }
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-primary">
        <ActivityIndicator size="large" color="#1DB954" />
      </View>
    )
  }

  if (metaQuery.error || !title) {
    return (
      <View className="flex-1 items-center justify-center bg-primary p-4">
        <Text className="text-text-secondary">{t('title.notFound')}</Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-4">
          <Text className="text-accent">{t('title.goBack')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <ScrollView className="flex-1 bg-primary">
        {/* Hero Section */}
        <View className="relative">
          {title.backdropImage ? (
            <Image
              source={{ uri: title.backdropImage }}
              className="h-64 w-full"
              resizeMode="cover"
            />
          ) : (
            <View className="h-64 w-full items-center justify-center bg-surface">
              <Ionicons name="image-outline" size={48} color="#B0B0B0" />
            </View>
          )}
          <View className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-primary to-transparent" />
        </View>

        <View className="-mt-12 mb-6 flex-row items-end px-4">
          {title.coverImage && (
            <Image
              source={{ uri: title.coverImage }}
              className="mr-4 h-36 w-24 rounded-lg border-2 border-white shadow-md"
              resizeMode="cover"
            />
          )}
          <View className="flex-1 pb-2">
            <Text className="text-2xl font-bold text-text-primary" numberOfLines={2}>
              {title.title}
            </Text>
            <Text className="font-medium text-text-secondary">
              {title.year} •{' '}
              {title.genres
                .slice(0, 2)
                .map((g) => g.name)
                .join(', ')}
            </Text>
          </View>
        </View>

        <View className="px-4">
          {/* Action Buttons */}
          <View className="mb-6 flex-row gap-3">
            <TouchableOpacity
              className={`flex-1 flex-row items-center justify-center rounded-lg py-3 ${isWatchlisted ? 'bg-accent/20 border border-accent/30' : 'bg-accent'
                }`}
              onPress={handleAddToWatchlist}
            >
              <Ionicons
                name={isWatchlisted ? 'checkmark' : 'add'}
                size={20}
                color={isWatchlisted ? '#1DB954' : 'white'}
              />
              <Text className={`ml-2 font-semibold ${isWatchlisted ? 'text-[#1DB954]' : 'text-white'}`}>
                {isWatchlisted ? t('title.watchlisted') : t('title.watchlist')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="flex-1 flex-row items-center justify-center rounded-lg border border-accent bg-surface py-3"
              onPress={handleAddToDiary}
            >
              <Ionicons
                name={isWatched ? 'checkmark-circle' : 'journal-outline'}
                size={20}
                color="#1DB954"
              />
              <Text className="ml-2 font-semibold text-[#1DB954]">{t('title.diary')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="flex-row items-center justify-center rounded-lg border border-accent bg-surface px-4 py-3"
              onPress={handleShare}
            >
              <Ionicons name="share-outline" size={20} color="#1DB954" />
            </TouchableOpacity>
          </View>

          {/* Get Tickets Button */}
          {isInTheaters && (
            <TouchableOpacity
              className="mb-6 flex-row items-center justify-center rounded-xl bg-accent px-4 py-4 shadow-lg shadow-accent/20"
              onPress={() => {
                const searchUrl = `https://www.ingresso.com.br/busca/resultado?q=${encodeURIComponent(title.title ?? '')}`
                Linking.openURL(searchUrl)
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="ticket" size={24} color="white" />
              <View className="ml-3">
                <Text className="text-lg font-black text-white uppercase tracking-tighter">
                  {t('title.getTickets')}
                </Text>
                <Text className="text-[10px] font-bold text-white/80 uppercase">
                  {t('title.findTheaters')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="white" className="ml-auto" />
            </TouchableOpacity>
          )}

          {/* Synopsis */}
          <View className="mb-6">
            <Text className="text-base leading-6 text-text-primary">{title.synopsis}</Text>
          </View>

          {/* Oscar Nominations Section */}
          {nominations && (
            <View className="mb-8 overflow-hidden rounded-2xl bg-surface border border-accent/20">
              <View className="flex-row items-center gap-2 bg-accent/10 px-4 py-3 border-b border-accent/20">
                <Ionicons name="trophy" size={20} color="#FCC419" />
                <Text className="text-base font-black text-text-primary tracking-tight">
                  {t('awards.nominations').toUpperCase()}
                </Text>
              </View>
              <View className="p-4 bg-surface-variant/30">
                <View className="flex-row flex-wrap gap-2">
                  {nominations.map((nom, idx) => (
                    <View
                      key={idx}
                      className="rounded-full bg-accent/5 px-3 py-1.5 border border-accent/10 flex-row items-center"
                    >
                      <Text className={`text-xs font-bold ${nom.isWinner ? 'text-[#FCC419]' : 'text-text-primary'}`}>
                        {nom.isWinner ? '🏆 ' : ''}
                        {nom.isWinner ? t('awards.oscarWinner', { defaultValue: 'Oscar Winner' }) + ' - ' : ''}
                        {t(`awards.categories.${nom.category}`)}
                        {nom.details && (
                          <Text className={`font-normal ${nom.isWinner ? 'text-[#FCC419]/80' : 'text-text-secondary'}`}> • {nom.details}</Text>
                        )}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          )}

          {/* Cast & Director */}
          {(title.director || title.cast.length > 0) && (
            <View className="mb-6">
              <Text className="mb-2 text-sm font-bold text-text-primary">{t('title.credits')}</Text>
              <View>
                {title.director && (
                  <View className="mb-1 flex-row items-center">
                    <Text className="text-sm font-semibold text-text-primary mr-1">
                      {t('title.director')}
                    </Text>
                    <TouchableOpacity onPress={() => setSelectedPersonId(title.director!.id)}>
                      <Text className="text-sm text-accent underline">{title.director.name}</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {title.cast.length > 0 && (
                  <View className="flex-row flex-wrap items-center mt-1">
                    <Text className="text-sm font-semibold text-text-primary mr-1">
                      {t('title.cast')}
                    </Text>
                    {title.cast.slice(0, 5).map((c, index) => (
                      <View key={c.id} className="flex-row items-center">
                        <TouchableOpacity onPress={() => setSelectedPersonId(c.id)}>
                          <Text className="text-sm text-accent underline">{c.name}</Text>
                        </TouchableOpacity>
                        {index < Math.min(title.cast.length - 1, 4) && (
                          <Text className="text-sm text-text-secondary">, </Text>
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>
          )}

          <View className="mb-6 h-[1px] bg-surface" />

          {/* Movie Specific Rating */}
          {title.type === 'movie' && (
            <View className="mb-6 rounded-xl border border-black/50 bg-surface p-4">
              <Text className="mb-2 text-center text-lg font-bold text-text-primary">
                {t('title.rateMovie')}
              </Text>
              <View className="items-center">
                <RatingStars
                  rating={userRating?.rating || 0}
                  onRatingChange={handleRate}
                  size={32}
                />
                <Text className="mt-2 text-sm text-text-secondary">
                  {userRating?.rating ? t('title.thanksForRating') : t('title.tapToRate')}
                </Text>
              </View>
            </View>
          )}

          {/* TV Specific Sections */}
          {title.type === 'tv' && title.totalSeasons && (
            <SeasonSection
              tmdbId={title.tmdbId}
              titleId={title.id}
              numberOfSeasons={title.totalSeasons}
              isAuthenticated={isAuthenticated}
              onLoginRequest={() => {
                Alert.alert(t('title.loginRequired'), t('title.loginPrompt'))
                router.push('/login')
              }}
              watchType={'first-time'}
            />
          )}

          {/* Friend Ratings (above Community Stats) */}
          {title.type === 'movie' && <FriendRatings ratings={friendRatings} />}

          {/* Community Stats */}
          <CommunityStats titleId={title.id} type={type} refreshKey={refreshKey} />

          {/* External Links Section */}
          <View className="mt-8 mb-12">
            <Text className="mb-4 text-sm font-bold text-text-primary">
              {t('title.seeAlsoOn').toUpperCase()}
            </Text>
            <View className="flex-row gap-x-12 items-center">
              {title.externalIds?.imdb_id && (
                <TouchableOpacity
                  onPress={() => Linking.openURL(`https://www.imdb.com/title/${title.externalIds?.imdb_id}`)}
                  activeOpacity={0.7}
                  className="items-center"
                >
                  <Image source={require('~/assets/icons/imdb.png')} className="w-8 h-8 rounded" />
                  <Text className="mt-1 text-[10px] font-medium text-text-secondary">IMDb</Text>
                </TouchableOpacity>
              )}
              {title.type === 'movie' && (
                <TouchableOpacity
                  onPress={() => Linking.openURL(`https://letterboxd.com/tmdb/${title.tmdbId}`)}
                  activeOpacity={0.7}
                  className="items-center"
                >
                  <Image source={require('~/assets/icons/letterboxd.png')} className="w-8 h-8 rounded-full" />
                  <Text className="mt-1 text-[10px] font-medium text-text-secondary">Letterboxd</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => {
                  const url = title.type === 'tv' && title.externalIds?.tvdb_id
                    ? `https://www.tvtime.com/en/show/${title.externalIds.tvdb_id}`
                    : `https://www.tvtime.com/en/search?q=${encodeURIComponent(title.title ?? '')}`
                  Linking.openURL(url)
                }}
                activeOpacity={0.7}
                className="items-center"
              >
                <Image source={require('~/assets/icons/tvtime.png')} className="w-8 h-8 rounded" />
                <Text className="mt-1 text-[10px] font-medium text-text-secondary">TV Time</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      <WatchlistSelectorModal
        visible={showWatchlistModal}
        onClose={() => setShowWatchlistModal(false)}
        titleId={title.id}
      />

      <PersonalityModal
        visible={selectedPersonId !== null}
        onClose={() => setSelectedPersonId(null)}
        personId={selectedPersonId}
      />
    </>
  )
}
