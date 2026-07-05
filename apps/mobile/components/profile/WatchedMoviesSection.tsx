import { View, Text, ScrollView, Image, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useMemo } from 'react'
import placeholderPoster from '@/assets/placeholder-poster.jpg'
import { useLocalizedMediaData } from '~/hooks/data/useLocalizedMediaData'
import { getTMDbService } from '~/services/tmdb'
import { OscarBadge } from '../common/OscarBadge'

type WatchedMovie = {
  id: string
  tmdb_id: number
  title: string
  cover_image: string | null
}

type Props = {
  movies: WatchedMovie[]
  onMoviePress: (tmdbId: number) => void
  onLongPress?: (movie: WatchedMovie) => void
  onViewAll?: () => void
}

export function WatchedMoviesSection({ movies, onMoviePress, onLongPress, onViewAll }: Props) {
  const { t } = useTranslation()
  const tmdb = getTMDbService()
  const items = useMemo(() => movies.map(m => ({ tmdb_id: m.tmdb_id, type: 'movie' as const })), [movies])
  const localizedData = useLocalizedMediaData(items)

  return (
    <View className="py-4">
      <View className="flex-row items-center justify-between px-4 mb-3">
        <Text className="text-text-primary font-bold text-lg">{t('profile.watchedMovies')}</Text>
        {movies.length > 5 && onViewAll && (
          <TouchableOpacity onPress={onViewAll}>
            <Text className="text-accent text-sm font-medium">{t('profile.viewAll')}</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-4">
        {movies.length > 0 ? (
          movies.map((movie) => (
            <TouchableOpacity
              key={movie.id}
              className="mr-3"
              onPress={() => onMoviePress(movie.tmdb_id)}
              onLongPress={() => onLongPress?.(movie)}
            >
              <View className="relative">
                <Image
                  source={
                    localizedData[movie.tmdb_id]?.poster_path
                      ? { uri: tmdb.getImageUrl(localizedData[movie.tmdb_id].poster_path, 'w300') || '' }
                      : movie.cover_image ? { uri: movie.cover_image } : placeholderPoster
                  }
                  className="w-24 h-36 rounded-lg bg-surface"
                  resizeMode="cover"
                />
                <OscarBadge tmdbId={movie.tmdb_id} size="small" />
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <Text className="text-text-secondary text-sm">{t('profile.noMoviesYet')}</Text>
        )}
      </ScrollView>
    </View>
  )
}
