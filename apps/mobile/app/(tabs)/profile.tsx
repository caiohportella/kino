import { View, ScrollView, RefreshControl, ActivityIndicator, Alert } from 'react-native'
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useAuth } from '@/hooks/useAuth'
import { dbService } from '~/services/database'
import { useCallback, useState } from 'react'
import { Skeleton } from '~/components/common/Skeleton'
import UserListModal from '~/components/modals/UserListModal'
import { useTranslation } from 'react-i18next'

// Profile components
import { UnauthenticatedView } from '~/components/profile/UnauthenticatedView'
import { ProfileHeader } from '~/components/profile/ProfileHeader'
import { ProfileStats } from '~/components/profile/ProfileStats'
import { WatchedMoviesSection } from '~/components/profile/WatchedMoviesSection'
import { WatchedSeriesSection } from '~/components/profile/WatchedSeriesSection'
import { UserSearchModal } from '~/components/profile/UserSearchModal'
import { WatchedSeriesModal } from '~/components/modals/WatchedSeriesModal'
import { WatchedMoviesModal } from '~/components/modals/WatchedMoviesModal'

// Custom hooks
import { useProfileData } from '~/hooks/profile/useProfileData'
import { useFollowSystem } from '~/hooks/profile/useFollowSystem'
import { useUserSearch } from '~/hooks/profile/useUserSearch'

// Helpers
import { shareProfile } from '~/utils/profile/profileHelpers'

export default function ProfileScreen() {
  const { user, isAuthenticated } = useAuth()
  const params = useLocalSearchParams()
  const router = useRouter()
  const { t } = useTranslation()

  const targetUserId = (params.userId as string) || user?.id
  const isOwnProfile = user?.id === targetUserId

  // Custom hooks
  const { profile, watchedMovies, watchedSeries, loading, refreshing, onRefresh } =
    useProfileData(targetUserId)

  const followSystem = useFollowSystem(targetUserId, isOwnProfile)
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
  const handleShare = () => shareProfile(profile, isOwnProfile)

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

    Alert.alert(
      t('common.delete'),
      t('modals.deleteEntryConfirm', { title }),
      [
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
      ]
    )
  }

  // Unauthenticated state
  if (!isAuthenticated && !targetUserId) {
    return <UnauthenticatedView onLoginPress={() => router.push('/login')} />
  }

  // Loading state
  if (loading) {
    return <Skeleton layout="profile" />
  }

  return (
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

        <WatchedMoviesSection
          movies={watchedMovies}
          onMoviePress={handleMoviePress}
          onLongPress={(movie) => handleDeleteMedia(movie.tmdb_id, movie.title, 'movie')}
          onViewAll={handleViewAllMovies}
        />

        <View className="mb-20">
          <WatchedSeriesSection
            series={watchedSeries}
            onSeriesPress={handleSeriesPress}
            onLongPress={(series) => handleDeleteMedia(series.tmdb_id, series.title, 'tv')}
            onViewAll={handleViewAllSeries}
          />
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
  )
}
