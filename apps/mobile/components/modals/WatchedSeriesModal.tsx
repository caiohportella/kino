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
import type { WatchedSeries } from '~/types'
import { useTranslation } from 'react-i18next'
import { formatDate, isFutureDateOnly } from '@kino/core'
import { EmptyState } from '../EmptyState'
import { OscarBadge } from '../common/OscarBadge'
import { useLocalizedMediaData } from '~/hooks/data/useLocalizedMediaData'
import { getTMDbService } from '~/services/tmdb'

interface WatchedSeriesModalProps {
  visible: boolean
  onClose: () => void
  series: WatchedSeries[]
  onSeriesPress: (tmdbId: number) => void
  onLongPress?: (series: WatchedSeries) => void
}

export function WatchedSeriesModal({
  visible,
  onClose,
  series,
  onSeriesPress,
  onLongPress,
}: WatchedSeriesModalProps) {
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const tmdb = getTMDbService()

  const mediaItems = useMemo(
    () => series.map((s) => ({ tmdb_id: s.tmdb_id, type: 'tv' as const })),
    [series]
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
            {t('profile.watchedSeries')}<Text className="text-accent">.</Text>
          </Text>
          <TouchableOpacity onPress={onClose} className="p-2">
            <Ionicons name="close" size={24} color="white" />
          </TouchableOpacity>
        </View>

        <FlatList
          data={series}
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
                onSeriesPress(item.tmdb_id)
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
                      <Ionicons name="tv" size={24} color="#666" />
                    </View>
                  )
                })()}
                <OscarBadge tmdbId={item.tmdb_id} />
              </View>
              {item.is_series_completed ? (
                <Text className="text-[#1DB954] text-[10px] font-medium">{t('profile.completed')}</Text>
              ) : item.next_episode ? (
                <View className="gap-1">
                  <Text className="text-text-secondary text-[10px]">
                    {t('profile.next')}:{' '}
                    <Text className="text-accent">
                      S{item.next_episode.season} E{item.next_episode.episode}
                    </Text>
                  </Text>
                  {isFutureDateOnly(item.next_episode.air_date) ? (
                    <Text className="text-text-secondary text-[10px]">
                      {item.next_episode.air_date
                        ? t('profile.newEpisodesOn', { date: formatDate(item.next_episode.air_date) })
                        : t('profile.newEpisodesSoon')}
                    </Text>
                  ) : null}
                </View>
              ) : (
                <Text className="text-text-secondary text-[10px]">
                  {t('profile.last')}:{' '}
                  <Text className="text-accent">
                    S{item.last_episode.season} E{item.last_episode.episode}
                  </Text>
                </Text>
              )}
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <EmptyState
              title={t('profile.noSeriesYet')}
              description={t('profile.noSeriesDescription')}
              image={require('~/assets/illustrations/user-not-found.png')}
            />
          }
        />
      </View>
    </Modal>
  )
}
