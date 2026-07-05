import {
  View,
  Text,
  Modal,
  FlatList,
  TouchableOpacity,
  Image,
} from 'react-native'
import { useMemo } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { WatchedMovie } from '~/types'
import { EmptyState } from '../EmptyState'
import { useTranslation } from 'react-i18next'
import userNotFound from '~/assets/illustrations/user-not-found.png'
import { OscarBadge } from '../common/OscarBadge'
import { useLocalizedMediaData } from '~/hooks/data/useLocalizedMediaData'
import { getTMDbService } from '~/services/tmdb'

interface WatchedMoviesModalProps {
  visible: boolean
  onClose: () => void
  movies: WatchedMovie[]
  onMoviePress: (tmdbId: number) => void
  onLongPress?: (movie: WatchedMovie) => void
}

export function WatchedMoviesModal({
  visible,
  onClose,
  movies,
  onMoviePress,
  onLongPress,
}: WatchedMoviesModalProps) {
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const tmdb = getTMDbService()

  const mediaItems = useMemo(
    () => movies.map((m) => ({ tmdb_id: m.tmdb_id, type: 'movie' as const })),
    [movies]
  )
  const mediaMap = useLocalizedMediaData(mediaItems)

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
            {t('profile.watchedMovies')}<Text className="text-accent">.</Text>
          </Text>
          <TouchableOpacity onPress={onClose} className="p-2">
            <Ionicons name="close" size={24} color="white" />
          </TouchableOpacity>
        </View>

        <FlatList
          data={movies}
          keyExtractor={(item) => item.id}
          numColumns={3}
          contentContainerStyle={{
            padding: 16,
            paddingBottom: insets.bottom + 16,
            gap: 16,
          }}
          columnWrapperStyle={{ gap: 12 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              className="flex-1"
              onPress={() => {
                onClose()
                onMoviePress(item.tmdb_id)
              }}
              onLongPress={() => onLongPress?.(item)}
            >
              <View className="aspect-[2/3] w-full rounded-lg bg-surface-variant overflow-hidden mb-2">
                {(() => {
                  const localizedData = mediaMap[item.tmdb_id]
                  const posterUrl = localizedData?.poster_path
                    ? tmdb.getImageUrl(localizedData.poster_path)
                    : item.cover_image

                  if (posterUrl) {
                    return (
                      <Image
                        source={{ uri: posterUrl }}
                        className="w-full h-full"
                        resizeMode="cover"
                      />
                    )
                  }
                  return (
                    <View className="flex-1 items-center justify-center">
                      <Ionicons name="film-outline" size={24} color="#666" />
                    </View>
                  )
                })()}
                <OscarBadge tmdbId={item.tmdb_id} />
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <EmptyState
              title={t('profile.noMoviesYet')}
              description={t('profile.noMoviesDescription')}
              image={userNotFound}
            />
          }
        />
      </View>
    </Modal>
  )
}
