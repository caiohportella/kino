import { useRouter } from 'expo-router'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { Skeleton } from '~/components/common/Skeleton'
import { TitleCard } from '~/components/common/TitleCard'
import { resolveLocalizedMediaPresentation } from '~/hooks/data/localizedMediaPresentation'
import { useLocalizedMediaData } from '~/hooks/data/useLocalizedMediaData'
import type { TMDbTitle } from '~/types'

interface HomeSectionProps {
  title: string
  data: TMDbTitle[]
  onViewAll?: () => void
  loading?: boolean
}

export function HomeSection({ title, data, onViewAll, loading = false }: HomeSectionProps) {
  const router = useRouter()
  const { t } = useTranslation()
  const mediaItems = useMemo(
    () =>
      data.map((item) => ({
        tmdb_id: item.id,
        type: item.media_type === 'tv' ? ('tv' as const) : ('movie' as const),
      })),
    [data]
  )
  const localizedMedia = useLocalizedMediaData(mediaItems)

  if (loading || localizedMedia.isPending) return <HomeSectionSkeleton title={title} />
  if (data.length === 0) return null

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
          const localized = resolveLocalizedMediaPresentation({
            data: localizedMedia,
            errors: localizedMedia.errors,
            isError: localizedMedia.isError,
            missing: localizedMedia.missing,
            request: { tmdb_id: item.id, type },
            unknownTitle: t('diary.unknownTitle'),
          })
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

function HomeSectionSkeleton({ title }: { title: string }) {
  return (
    <View className="mb-8">
      <View className="px-4 mb-4">
        <Text className="text-xl font-bold text-text-primary">{title}</Text>
      </View>
      <View className="flex-row px-4 gap-3">
        {[0, 1, 2].map((item) => (
          <View key={item} className="w-[120px]">
            <Skeleton.Rect width={120} height={180} borderRadius={8} />
          </View>
        ))}
      </View>
    </View>
  )
}
