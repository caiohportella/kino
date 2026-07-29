import { useRouter } from 'expo-router'
import { useMemo } from 'react'
import { ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { TitleCard } from '~/components/common/TitleCard'
import { localizedMediaKey, useLocalizedMediaData } from '~/hooks/data/useLocalizedMediaData'
import type { TMDbTitle } from '~/types'

interface HomeSectionProps {
  title: string
  data: TMDbTitle[]
  onViewAll?: () => void
  loading?: boolean
}

export function HomeSection({ title, data, onViewAll, loading = false }: HomeSectionProps) {
  const router = useRouter()
  const mediaItems = useMemo(
    () =>
      data.map((item) => ({
        tmdb_id: item.id,
        type: item.media_type === 'tv' ? ('tv' as const) : ('movie' as const),
      })),
    [data]
  )
  const localizedMedia = useLocalizedMediaData(mediaItems)

  if (loading || localizedMedia.isPending || data.length === 0) {
    // Basic skeleton or empty state could be here, or just return null
    return null
  }

  return (
    <View className="mb-8">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 mb-4">
        <Text className="text-xl font-bold text-text-primary">{title}</Text>
        {onViewAll && (
          <TouchableOpacity onPress={onViewAll}>
            <Text className="text-sm font-semibold text-accent">View All</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Horizontal List */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
      >
        {data.map((item) => {
          const type = item.media_type === 'tv' ? 'tv' : 'movie'
          const localized = localizedMedia[localizedMediaKey({ tmdb_id: item.id, type })]
          if (!localized) return null
          const localizedItem = {
            ...item,
            name: type === 'tv' ? localized.title : item.name,
            poster_path: localized.poster_path,
            title: type === 'movie' ? localized.title : item.title,
          }
          return (
            <View key={`${item.id}-${item.media_type}`} className="w-[120px]">
              <TitleCard
                title={localizedItem}
                onPress={() =>
                  router.push(
                    `/title/${item.id}?type=${item.media_type || (item.title ? 'movie' : 'tv')}`
                  )
                }
              />
            </View>
          )
        })}
      </ScrollView>
    </View>
  )
}
