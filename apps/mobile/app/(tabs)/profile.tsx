import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useAuth } from '@/hooks/useAuth'
import { ProtectedContentGate } from '~/components/auth/ProtectedContentGate'
import { Skeleton } from '~/components/common/Skeleton'
import UserListModal from '~/components/modals/UserListModal'
import { WatchedMoviesModal } from '~/components/modals/WatchedMoviesModal'
import { WatchedSeriesModal } from '~/components/modals/WatchedSeriesModal'
import { ProfileHeader } from '~/components/profile/ProfileHeader'
import { ProfileStats } from '~/components/profile/ProfileStats'
// Profile components
import { UnauthenticatedView } from '~/components/profile/UnauthenticatedView'
import { UserSearchModal } from '~/components/profile/UserSearchModal'
import { WatchedMoviesSection } from '~/components/profile/WatchedMoviesSection'
import { WatchedSeriesSection } from '~/components/profile/WatchedSeriesSection'
import { useFollowSystem } from '~/hooks/profile/useFollowSystem'
// Custom hooks
import { useProfileData } from '~/hooks/profile/useProfileData'
import { useUserSearch } from '~/hooks/profile/useUserSearch'
import { dbService } from '~/services/database'
import { shareNativeResource } from '~/utils/native-share'
import { selectProfilePageStatus } from '~/utils/protectedConsumerState'

export default function ProfileScreen() {
  const { user, isAuthenticated, resolution } = useAuth()
  const params = useLocalSearchParams()
  const router = useRouter()
  const { t } = useTranslation()

  const publicTargetId = params.userId as string | undefined
  const targetUserId = publicTargetId || user?.id
  const publicProfileResolution = publicTargetId
    ? ({ status: 'authenticated', user: { id: publicTargetId } } as const)
    : resolution
  const isOwnProfile = user?.id === targetUserId

  // Custom hooks
  const {
    profile,
    watchedMovies,
    watchedSeries,
    loading,
    error,
    refreshing,
    onRefresh,
    relationship,
    retryWatchedMovies,
    retryWatchedSeries,
    watchedMoviesState,
    watchedSeriesState,
  } = useProfileData(targetUserId, user?.id)

  const followSystem = useFollowSystem(targetUserId, isOwnProfile, user?.id, relationship)
  const searchSystem = useUserSearch()

  const [watchedSeriesModalVisible, setWatchedSeriesModalVisible] = useState(false)
  const [watchedMoviesModalVisible, setWatchedMoviesModalVisible] = useState(false)

  // Reload data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated) {
        onRefresh()
      }
    }, [isAuthenticated, onRefresh])
  )

  // Handlers
  const handleShare = () => {
    if (!profile) return
    void shareNativeResource({
      canonicalUrl: `https://kino.app/${profile.username || profile.id}`,
      shareText: t('sharing.profileText', {
        username: profile.username || profile.display_name || 'kino',
      }),
      title: profile.display_name || profile.username || t('profile.user'),
    })
  }

  const handleMoviePress = (tmdbId: number) => {
    router.push(`/title/${tmdbId}?type=movie`)
  }

  const handleSeriesPress = (tmdbId: number) => {
    router.push(`/title/${tmdbId}?type=tv`)
  }

  const handleUserPress = (userId: string) => {
    router.push(`/profile/${userId}` as any)
  }

  const handleViewAllSeries = () => {
    setWatchedSeriesModalVisible(true)
  }

  const handleViewAllMovies = () => {
    setWatchedMoviesModalVisible(true)
  }

  const handleDeleteMedia = (tmdbId: number, title: string, type: 'movie' | 'tv') => {
    if (!isOwnProfile) return

    Alert.alert(t('common.delete'), t('modals.deleteEntryConfirm', { title }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            // Find the local id for this title in the db
            const titleData = await dbService.getTitleByTmdbId(tmdbId)
            if (titleData) {
              await dbService.removeMediaHistory(titleData.id, type)
              onRefresh()
            }
          } catch (error) {
            console.error('Failed to delete media', error)
            Alert.alert(t('common.error'), t('common.failedToDelete'))
          }
        },
      },
    ])
  }

  return (
    <ProtectedContentGate<unknown>
      authLoadingFallback={<Skeleton layout="profile" />}
      emptyFallback={
        <View className="flex-1 items-center justify-center bg-primary">
          <Text className="text-text-primary">{t('profile.title')}</Text>
        </View>
      }
      errorFallback={
        <View className="flex-1 items-center justify-center bg-primary">
          <Text className="text-text-primary">{t('common.failed')}</Text>
        </View>
      }
      pageLoadingFallback={<Skeleton layout="profile" />}
      pageStatus={selectProfilePageStatus({
        error,
        hasProfile: Boolean(profile),
        loading,
      })}
      resolution={publicProfileResolution}
      unauthenticatedFallback={<UnauthenticatedView onLoginPress={() => router.push('/login')} />}
    >
      <View className="flex-1 bg-primary pb-16">
        <ScrollView
          className="flex-1"
          alwaysBounceVertical={true}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled={true}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#1DB954"
              colors={['#1DB954']}
            />
          }
        >
          {refreshing && (
            <View className="items-center py-4">
              <ActivityIndicator size="small" color="#1DB954" />
            </View>
          )}

          <ProfileHeader
            profile={profile}
            isOwnProfile={isOwnProfile}
            isFollowing={followSystem.isFollowing}
            onSearchPress={() => searchSystem.setSearchModalVisible(true)}
            onSharePress={handleShare}
            onFollowToggle={followSystem.handleFollowToggle}
          />

          <ProfileStats
            followersCount={followSystem.followersCount}
            followingCount={followSystem.followingCount}
            onFollowersPress={() => followSystem.handleOpenUserList('followers')}
            onFollowingPress={() => followSystem.handleOpenUserList('following')}
          />

          {watchedMoviesState.phase === 'initial-pending' ||
          watchedMoviesState.phase === 'paused' ? (
            <View className="px-4 py-4 flex-row gap-3">
              <Skeleton width={96} height={144} />
              <Skeleton width={96} height={144} />
              <Skeleton width={96} height={144} />
            </View>
          ) : watchedMoviesState.phase === 'failed' ? (
            <View className="items-start px-4 py-4">
              <Text className="text-text-secondary">{t('common.failed')}</Text>
              <TouchableOpacity onPress={retryWatchedMovies}>
                <Text className="mt-2 text-accent">{t('common.retry')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <WatchedMoviesSection
              movies={watchedMovies}
              onMoviePress={handleMoviePress}
              onLongPress={(movie) => handleDeleteMedia(movie.tmdb_id, movie.title, 'movie')}
              onViewAll={handleViewAllMovies}
            />
          )}

          <View className="mb-20">
            {watchedSeriesState.phase === 'initial-pending' ||
            watchedSeriesState.phase === 'paused' ? (
              <View className="px-4 py-4 flex-row gap-3">
                <Skeleton width={96} height={144} />
                <Skeleton width={96} height={144} />
                <Skeleton width={96} height={144} />
              </View>
            ) : watchedSeriesState.phase === 'failed' ? (
              <View className="items-start px-4 py-4">
                <Text className="text-text-secondary">{t('common.failed')}</Text>
                <TouchableOpacity onPress={retryWatchedSeries}>
                  <Text className="mt-2 text-accent">{t('common.retry')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <WatchedSeriesSection
                series={watchedSeries}
                onSeriesPress={handleSeriesPress}
                onLongPress={(series) => handleDeleteMedia(series.tmdb_id, series.title, 'tv')}
                onViewAll={handleViewAllSeries}
              />
            )}
          </View>
        </ScrollView>

        <UserSearchModal
          visible={searchSystem.searchModalVisible}
          onClose={() => searchSystem.setSearchModalVisible(false)}
          searchQuery={searchSystem.searchQuery}
          onSearchChange={searchSystem.handleSearch}
          searchResults={searchSystem.searchResults}
          isSearching={searchSystem.isSearching}
          onUserPress={handleUserPress}
        />

        <UserListModal
          visible={followSystem.userListModalVisible}
          onClose={() => followSystem.setUserListModalVisible(false)}
          title={followSystem.userListTitle}
          users={followSystem.userListUsers}
          loading={followSystem.userListLoading}
          onUserPress={handleUserPress}
          onAction={isOwnProfile ? followSystem.handleUserListAction : undefined}
          actionLabel={
            followSystem.userListType === 'followers' ? t('profile.remove') : t('profile.unfollow')
          }
        />

        <WatchedSeriesModal
          visible={watchedSeriesModalVisible}
          onClose={() => setWatchedSeriesModalVisible(false)}
          series={watchedSeries}
          onSeriesPress={handleSeriesPress}
          onLongPress={(series) => handleDeleteMedia(series.tmdb_id, series.title, 'tv')}
        />

        <WatchedMoviesModal
          visible={watchedMoviesModalVisible}
          onClose={() => setWatchedMoviesModalVisible(false)}
          movies={watchedMovies}
          onMoviePress={handleMoviePress}
          onLongPress={(movie) => handleDeleteMedia(movie.tmdb_id, movie.title, 'movie')}
        />
      </View>
    </ProtectedContentGate>
  )
}
