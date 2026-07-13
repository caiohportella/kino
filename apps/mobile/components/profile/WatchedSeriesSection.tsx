import { View, Text, ScrollView, Image, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useMemo } from 'react'
import { isFutureDateOnly, formatDate } from '@kino/core'
import placeholderPoster from '@/assets/placeholder-poster.jpg'
import { useLocalizedMediaData } from '~/hooks/data/useLocalizedMediaData'
import { getTMDbService } from '~/services/tmdb'
import { OscarBadge } from '../common/OscarBadge'

type WatchedSeries = {
  id: string
  tmdb_id: number
  title: string
  cover_image: string | null
  last_episode?: { season: number; episode: number } | null
  is_series_completed?: boolean
  is_caught_up?: boolean
  next_episode?: { season: number; episode: number; air_date?: string } | null
}

type Props = {
  series: WatchedSeries[]
  onSeriesPress: (tmdbId: number) => void
  onLongPress?: (series: WatchedSeries) => void
  onViewAll?: () => void
}

export function WatchedSeriesSection({ series, onSeriesPress, onLongPress, onViewAll }: Props) {
  const { t } = useTranslation()
  const tmdb = getTMDbService()
  const items = useMemo(() => series.map(s => ({ tmdb_id: s.tmdb_id, type: 'tv' as const })), [series])
  const localizedData = useLocalizedMediaData(items)
  const watchedSeries = useMemo(() => series.filter((item) => !item.next_episode), [series])
  const keepWatchingSeries = useMemo(() => series.filter((item) => Boolean(item.next_episode)), [series])

  const getStatusBadge = (item: WatchedSeries) => {
    if (item.is_series_completed || item.is_caught_up) {
      return (
        <View className="absolute bottom-2 left-1 bg-accent/90 rounded-md px-1.5 py-0.5">
          <Text className="text-[10px] font-medium text-white">{t('profile.completed')}</Text>
        </View>
      )
    }
    if (item.next_episode) {
      const upcoming = isFutureDateOnly(item.next_episode.air_date)
      return (
        <View className="absolute bottom-2 left-1 gap-1">
          <View className="bg-accent/90 rounded-md px-1.5 py-0.5">
            <Text className="text-[10px] font-medium text-white">
              {t('profile.next')} S{item.next_episode.season} E{item.next_episode.episode}
            </Text>
          </View>
          {upcoming ? (
            <View className="bg-surface/90 rounded-md px-1.5 py-0.5">
              <Text className="text-[10px] font-medium text-text-primary">
                {item.next_episode.air_date
                  ? t('profile.newEpisodesOn', { date: formatDate(item.next_episode.air_date) })
                  : t('profile.newEpisodesSoon')}
              </Text>
            </View>
          ) : null}
        </View>
      )
    }
    if (item.last_episode) {
      return (
        <View className="absolute bottom-2 left-1 bg-surface/90 rounded-md px-1.5 py-0.5">
          <Text className="text-[10px] font-medium text-text-secondary">
            {t('profile.last')} S{item.last_episode.season} E{item.last_episode.episode}
          </Text>
        </View>
      )
    }
    return null
  }

  return (
    <View className="py-4">
      {keepWatchingSeries.length > 0 ? (
        <View className="mb-6">
          <View className="flex-row items-center justify-between px-4 mb-3">
            <Text className="text-text-primary font-bold text-lg">{t('profile.keepWatching', { defaultValue: 'Keep Watching' })}</Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-4">
            {keepWatchingSeries.slice(0, 10).map((item) => renderSeriesItem(item))}
          </ScrollView>
        </View>
      ) : null}

      {watchedSeries.length > 0 ? (
        <View className="mb-6">
          <View className="flex-row items-center justify-between px-4 mb-3">
            <Text className="text-text-primary font-bold text-lg">{t('profile.watchedSeries')}</Text>
            {series.length > 5 && onViewAll && (
              <TouchableOpacity onPress={onViewAll}>
                <Text className="text-accent text-sm font-medium">{t('profile.viewAll')}</Text>
              </TouchableOpacity>
            )}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-4">
            {watchedSeries.slice(0, 10).map((item) => renderSeriesItem(item))}
          </ScrollView>
        </View>
      ) : null}

      {series.length === 0 ? (
        <View className="px-4">
          <Text className="text-text-secondary text-sm">{t('profile.noSeriesYet')}</Text>
        </View>
      ) : null}
    </View>
  )

  function renderSeriesItem(item: WatchedSeries) {
    return (
      <TouchableOpacity
        key={item.id}
        className="mr-3"
        onPress={() => onSeriesPress(item.tmdb_id)}
        onLongPress={() => onLongPress?.(item)}
      >
        <View className="relative">
          <Image
            source={
              localizedData[item.tmdb_id]?.poster_path
                ? { uri: tmdb.getImageUrl(localizedData[item.tmdb_id].poster_path, 'w300') || '' }
                : item.cover_image ? { uri: item.cover_image } : placeholderPoster
            }
            className="w-24 h-36 rounded-lg bg-surface"
            resizeMode="cover"
          />
          <OscarBadge tmdbId={item.tmdb_id} size="small" />
          {getStatusBadge(item)}
        </View>
      </TouchableOpacity>
    )
  }
}
