// Watch diary screen
import { useEffect, useState, useMemo, useCallback } from 'react'
import {
  View,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  SectionList,
  Image,
  RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '@/hooks/useAuth'
import { useLanguage } from '@/hooks/useLanguage'
import { supabase } from '@/utils/supabase'
import { format } from 'date-fns'
import { enUS, fr, it, nb, pt } from 'date-fns/locale'
import { useRouter, useFocusEffect } from 'expo-router'
import { ScreenHeader } from '~/components/layout/ScreenHeader'
import { Ionicons } from '@expo/vector-icons'
import { DiaryActionModal } from '~/components/modals/DiaryActionModal'
import { RatingStars } from '~/components/common/RatingStars'
import { useTranslation } from 'react-i18next'
import { dbService } from '~/services/database'
import { useTitleDetailsFromTmdb } from '~/hooks/api/useTMDB'

import { UIDiaryEntry } from '~/types'

export default function DiaryScreen() {
  const router = useRouter()
  const { isAuthenticated, user } = useAuth()
  const { t } = useTranslation()
  const language = useLanguage()
  const [entries, setEntries] = useState<UIDiaryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Modal State
  const [selectedEntry, setSelectedEntry] = useState<UIDiaryEntry | null>(null)
  const [showActionModal, setShowActionModal] = useState(false)

  const getLocale = (language: string) => {
    switch (language) {
      case 'en':
        return enUS
      case 'fr':
        return fr
      case 'it':
        return it
      case 'no':
        return nb
      case 'pt':
        return pt
      default:
        return enUS
    }
  }

  // Group entries by Month Year
  const sections = useMemo(() => {
    const grouped: { [key: string]: UIDiaryEntry[] } = {}
    const locale = getLocale(language)

    entries.forEach((entry) => {
      const date = new Date(entry.watchedAt)
      const monthYear = format(date, 'MMMM yyyy', { locale }).toUpperCase()

      if (!grouped[monthYear]) {
        grouped[monthYear] = []
      }
      grouped[monthYear].push(entry)
    })

    return Object.keys(grouped).map((key) => ({
      title: key,
      data: grouped[key],
    }))
  }, [entries, language])

  useEffect(() => {
    if (isAuthenticated && user) {
      loadDiary()
    } else {
      setLoading(false)
    }
  }, [isAuthenticated, user])

  /* Check if user exists before attempting to load diary */
  const loadDiary = async () => {
    if (!user) return

    type DiaryData = {
      id: string
      title_id: string
      watched_at: string
      watch_type: 'first-time' | 'rewatch'
      notes: string | null
      titles: {
        title: string
        release_year: number
        cover_image: string | null
        tmdb_id: number
        type: 'movie' | 'tv'
      } | null
    }

    try {
      // 1. Fetch all diary entries so the timeline can reach the oldest entry.
      const diaryData: DiaryData[] = []
      const pageSize = 1000

      for (let offset = 0; ; offset += pageSize) {
        const { data, error } = await supabase
          .from('watch_diary')
          .select(
            `
            id,
            title_id,
            watched_at,
            watch_type,
            notes,
            titles:title_id (
              title,
              release_year,
              cover_image,
              tmdb_id,
              type
            )
          `
          )
          .eq('user_id', user.id)
          .order('watched_at', { ascending: false })
          .range(offset, offset + pageSize - 1)

        if (error) {
          throw error
        }

        const page = (data || []) as unknown as DiaryData[]
        diaryData.push(...page)
        if (page.length < pageSize) {
          break
        }
      }

      // 2. Separate entries by type and fetch ratings accordingly
      const movieTitleIds = diaryData
        .filter((e) => e.titles?.type === 'movie')
        .map((e) => e.title_id)

      const tvTitleIds = diaryData.filter((e) => e.titles?.type === 'tv').map((e) => e.title_id)

      let ratingsMap: Record<string, number> = {}

      // Fetch movie ratings
      if (movieTitleIds.length > 0) {
        const { data: ratingsData, error: ratingsError } = await supabase
          .from('title_ratings')
          .select('title_id, rating')
          .eq('user_id', user.id)
          .in('title_id', movieTitleIds)

        if (ratingsError) {
          console.error('[Diary] Movie ratings fetch error:', ratingsError)
        } else if (ratingsData) {
          ratingsData.forEach((r: { title_id: string; rating: number }) => {
            ratingsMap[r.title_id] = r.rating
          })
        }
      }

      // Fetch TV show average ratings
      if (tvTitleIds.length > 0) {
        const tvRatings = await dbService.getAverageSeasonRatingsForTitles(user.id, tvTitleIds)
        ratingsMap = { ...ratingsMap, ...tvRatings }
      }

      // 3. Merge and Set State
      const formattedEntries: UIDiaryEntry[] = diaryData.map((entry) => {
        const title = entry.titles
        return {
          id: entry.id,
          titleId: entry.title_id,
          tmdbId: title?.tmdb_id ?? 0,
          type: title?.type ?? 'movie',
          titleName: title?.title || t('diary.unknownTitle'),
          releaseYear: title?.release_year ?? 0,
          coverImage: title?.cover_image ?? null,
          watchedAt: entry.watched_at,
          watchType: entry.watch_type,
          notes: entry.notes ?? undefined,
          rating: ratingsMap[entry.title_id] || 0,
        }
      })

      setEntries(formattedEntries)
    } catch (error) {
      console.error('Error loading diary (v3):', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    loadDiary()
  }, [user])

  // Refresh diary when tab is focused
  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated) {
        onRefresh()
      }
    }, [isAuthenticated, onRefresh])
  )

  const openActionModal = (entry: UIDiaryEntry) => {
    setSelectedEntry(entry)
    setShowActionModal(true)
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaView className="flex-1 bg-primary">
        <View className="flex-1 items-center justify-center p-4">
          <Text className="mb-4 text-xl font-bold text-text-primary">{t('diary.watchDiary')}</Text>
          <Text className="mb-6 text-center text-text-secondary">{t('diary.loginPrompt')}</Text>
          <TouchableOpacity
            className="rounded-lg bg-accent px-6 py-3"
            onPress={() => router.push('/login')}
          >
            <Text className="font-semibold text-white">{t('auth.logIn')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  if (loading && !refreshing) {
    return (
      <View className="flex-1 items-center justify-center bg-primary">
        <ActivityIndicator size="large" color="#1DB954" />
      </View>
    )
  }

  return (
    <View className="flex-1 bg-primary">
      <View className="flex-1">
        <ScreenHeader title={t('diary.title')} />

        {entries.length === 0 ? (
          <View className="flex-1 items-center justify-center p-4">
            <Text className="text-center text-text-secondary">{t('diary.emptyState')}</Text>
          </View>
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: 100 }}
            stickySectionHeadersEnabled={true}
            ListHeaderComponent={
              refreshing ? (
                <View className="items-center py-2">
                  <ActivityIndicator size="small" color="#1DB954" />
                </View>
              ) : null
            }
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#1DB954"
                colors={['#1DB954']}
              />
            }
            renderSectionHeader={({ section: { title } }) => (
              <View className="border-b border-surface/50 bg-primary/95 px-4 py-3 backdrop-blur-sm">
                <Text className="text-xs font-bold tracking-widest text-text-secondary">
                  {title}
                </Text>
              </View>
            )}
            renderItem={({ item }) => (
              <DiaryEntryCard
                item={item}
                onOpenActionModal={openActionModal}
              />
            )}
          />
        )}
      </View>

      <DiaryActionModal
        visible={showActionModal}
        onClose={() => setShowActionModal(false)}
        entry={selectedEntry}
        onUpdate={loadDiary}
      />
    </View>
  )
}

function DiaryEntryCard({
  item,
  onOpenActionModal,
}: {
  item: UIDiaryEntry
  onOpenActionModal: (entry: UIDiaryEntry) => void
}) {
  const router = useRouter()
  const { t } = useTranslation()
  const date = new Date(item.watchedAt)
  const day = format(date, 'd')

  // Fetch localized details dynamically based on current app language
  const { data: tmdbTitle } = useTitleDetailsFromTmdb(item.tmdbId, item.type)
  const displayTitle =
    (item.type === 'movie' ? tmdbTitle?.title : tmdbTitle?.name) || item.titleName

  return (
    <TouchableOpacity
      className="flex-row items-center px-4 py-3 active:bg-surface/30"
      onPress={() => router.push(`/title/${item.tmdbId}?type=${item.type}`)}
    >
      {/* Day Column */}
      <View className="mr-2 w-12 items-center justify-center">
        <Text className="text-2xl font-light text-text-secondary opacity-80">{day}</Text>
      </View>

      {/* Content Card */}
      <View className="flex-1 flex-row items-center">
        {/* Poster */}
        <Image
          source={
            item.coverImage
              ? { uri: item.coverImage }
              : { uri: 'https://via.placeholder.com/100x150' }
          }
          className="mr-3 h-14 w-10 rounded-md border border-surface bg-surface"
          resizeMode="cover"
        />

        {/* Details */}
        <View className="flex-1">
          <View className="mb-0.5 flex-row items-center gap-2">
            <Text className="flex-shrink text-base font-bold text-text-primary" numberOfLines={1}>
              {displayTitle}
            </Text>
            {item.releaseYear && (
              <Text className="text-xs font-medium text-text-secondary">{item.releaseYear}</Text>
            )}
          </View>

          <View className="flex-row items-center gap-2">
            <RatingStars rating={item.rating || 0} size={12} readonly color="#1DB954" />

            {item.watchType === 'rewatch' && (
              <View className="flex-row items-center gap-1">
                <View className="mx-1 h-3 w-[1px] bg-text-secondary/30" />
                <View className="flex-row items-center gap-1">
                  <Ionicons name="refresh" size={10} color="#888" />
                  <Text className="text-[10px] font-medium uppercase text-text-secondary">
                    {t('diary.rewatch')}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>

        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation() // Prevent navigating to title
            onOpenActionModal(item)
          }}
          className="p-2"
        >
          <Ionicons name="ellipsis-horizontal" size={16} color="#666" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  )
}
