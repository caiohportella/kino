import type { SearchResponse, SearchResultV1, SearchResultV2 } from '@kino/core/search'
import { useRouter } from 'expo-router'
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  FlatList,
  Image,
  LayoutAnimation,
  ScrollView,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native'
import { useUpstashSearch } from '@/hooks/useUpstashSearch'
import { TitleCard } from '~/components/common/TitleCard'
import { EmptyState } from '~/components/EmptyState'
import { ScreenHeader } from '~/components/layout/ScreenHeader'
import {
  AdvancedFilterModal,
  defaultFilterState,
  FilterState,
} from '~/components/modals/AdvancedFilterModal'
import { SearchBar } from '~/components/search/SearchBar'
import { getTMDbService } from '~/services/tmdb'
import type { TMDbGenre, TMDbTitle } from '~/types'
import { mobilePersonDepartment, toMobileSearchTitle } from '~/utils/searchPresentation'

// Helper to get decade start year
function getDecadeStart(decade: string) {
  switch (decade) {
    case '2020s':
      return '2020-01-01'
    case '2010s':
      return '2010-01-01'
    case '2000s':
      return '2000-01-01'
    case '1990s':
      return '1990-01-01'
    case '1980s':
      return '1980-01-01'
    default:
      return null
  }
}

function getDecadeEnd(decade: string) {
  switch (decade) {
    case '2020s':
      return '2029-12-31'
    case '2010s':
      return '2019-12-31'
    case '2000s':
      return '2009-12-31'
    case '1990s':
      return '1999-12-31'
    case '1980s':
      return '1989-12-31'
    case 'older':
      return '1979-12-31'
    default:
      return null
  }
}

export default function SearchScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const [submittedQuery, setSubmittedQuery] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState<FilterState>(defaultFilterState)
  const semanticMediaTypes =
    filters?.mediaType === 'movie'
      ? (['movie'] as const)
      : filters?.mediaType === 'tv'
        ? (['series'] as const)
        : undefined
  const {
    response: semanticResponse,
    loading: semanticLoading,
    search: semanticSearch,
    clearResults: clearSemanticResults,
    nextPage,
  } = useUpstashSearch({
    mediaTypes: semanticMediaTypes,
    mode: submittedQuery ? 'full' : 'autocomplete',
  })
  const { width } = useWindowDimensions()

  // Responsive Grid
  const numColumns = width > 768 ? 5 : width > 480 ? 4 : 3
  const padding = 16

  const [genres, setGenres] = useState<TMDbGenre[]>([])

  // Advanced Filter state

  const [discoveryResults, setDiscoveryResults] = useState<TMDbTitle[]>([])
  const [loading, setLoading] = useState(false)

  // Search state
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false)

  const tmdb = getTMDbService()

  const isHybridSearchActive = searchQuery.length > 0
  const isGlobalLoading = loading || semanticLoading
  // Check if any filter is active
  const hasActiveFilters =
    filters.mediaType !== 'all' ||
    filters.decade !== 'all' ||
    filters.minRating !== 'all' ||
    filters.duration !== 'all' ||
    filters.seasons !== 'all' ||
    filters.nationality !== 'all' ||
    filters.genres.length > 0

  // Load genres on mount
  useEffect(() => {
    const loadGenres = async () => {
      try {
        const movieGenres = await tmdb.getGenres('movie')
        const tvGenres = await tmdb.getGenres('tv')
        const merged = [...movieGenres]
        tvGenres.forEach((genre) => {
          if (!merged.find((g) => g.id === genre.id)) merged.push(genre)
        })
        setGenres(merged.sort((a, b) => a.name.localeCompare(b.name)))
      } catch (err) {
        console.error('Failed to load genres:', err)
      }
    }
    loadGenres()
  }, [tmdb.getGenres])

  // Hybrid Search / Discovery Trigger
  useEffect(() => {
    const executeSearch = async () => {
      // 1. Semantic Search (Text OR Themes active)
      if (isHybridSearchActive) {
        // Construct semantic query
        // The gateway owns semantic retrieval and its TMDB fallback.
        semanticSearch(searchQuery)
      }
      // 2. Standard Discovery (Filters Active)
      else if (hasActiveFilters) {
        setLoading(true)
        clearSemanticResults()
        try {
          const commonParams: Record<string, string> = {
            sort_by: 'popularity.desc',
          }

          if (filters.genres.length > 0) {
            commonParams.with_genres = filters.genres.join(',')
          }
          if (filters.minRating !== 'all') {
            commonParams['vote_average.gte'] = filters.minRating
            commonParams['vote_count.gte'] = '50' // Ensure reliable ratings
          }
          if (filters.nationality !== 'all') {
            commonParams.with_original_language = filters.nationality
          }

          let results: TMDbTitle[] = []

          // Handle Movies Search
          if (filters.mediaType === 'all' || filters.mediaType === 'movie') {
            const movieParams = { ...commonParams }

            // Decade
            if (filters.decade !== 'all') {
              if (filters.decade === 'older') {
                movieParams['primary_release_date.lte'] = getDecadeEnd(filters.decade)!
              } else {
                movieParams['primary_release_date.gte'] = getDecadeStart(filters.decade)!
                movieParams['primary_release_date.lte'] = getDecadeEnd(filters.decade)!
              }
            }

            // Duration
            if (filters.duration !== 'all') {
              if (filters.duration === 'under90') movieParams['with_runtime.lte'] = '90'
              else if (filters.duration === '90to120') {
                movieParams['with_runtime.gte'] = '90'
                movieParams['with_runtime.lte'] = '120'
              } else if (filters.duration === 'over120') movieParams['with_runtime.gte'] = '120'
            }

            const movieData = await tmdb.discoverMedia('movie', movieParams)
            const movies = movieData.map((m) => ({ ...m, media_type: 'movie' as const }))
            results = [...results, ...movies]
          }

          // Handle TV Search
          if (filters.mediaType === 'all' || filters.mediaType === 'tv') {
            const tvParams = { ...commonParams }

            // Decade
            if (filters.decade !== 'all') {
              if (filters.decade === 'older') {
                tvParams['first_air_date.lte'] = getDecadeEnd(filters.decade)!
              } else {
                tvParams['first_air_date.gte'] = getDecadeStart(filters.decade)!
                tvParams['first_air_date.lte'] = getDecadeEnd(filters.decade)!
              }
            }

            // Note: TMDb doesn't support number of seasons filter directly in discover,
            // so we'll have to filter TV seasons client-side unfortunately or just skip it for now.
            // Client-side filtering requires fetching details for each show which is too heavy.

            const tvData = await tmdb.discoverMedia('tv', tvParams)
            const tvs = tvData.map((t) => ({ ...t, media_type: 'tv' as const }))
            results = [...results, ...tvs]
          }

          setDiscoveryResults(results.sort((a, b) => b.vote_average - a.vote_average))
        } catch (e) {
          console.error(e)
        } finally {
          setLoading(false)
        }
      }
      // 3. Default Popular/Trending (No Filters)
      else {
        setLoading(true)
        clearSemanticResults()
        try {
          // Load popular from all types
          const data = await tmdb.getTrending('all', 'week')
          setDiscoveryResults(data)
        } catch (e) {
          console.error(e)
        } finally {
          setLoading(false)
        }
      }
    }

    const timeoutId = setTimeout(() => {
      executeSearch()
    }, 500) // Debounce everything slightly to avoid flicker

    return () => clearTimeout(timeoutId)
  }, [
    searchQuery,
    filters,
    isHybridSearchActive,
    clearSemanticResults,
    hasActiveFilters, // Fire both searches for robust results
    semanticSearch,
    tmdb.discoverMedia,
    tmdb.getTrending,
  ])

  // Handlers
  const handleSearchInput = (text: string) => {
    setSubmittedQuery('')
    setSearchQuery(text)
    if (text.trim()) setFilters(resetDiscoveryOnlyFilters)
  }
  const handleSearchSubmit = (text: string) => {
    setSubmittedQuery(text)
    setSearchQuery(text)
    setFilters(resetDiscoveryOnlyFilters)
  }

  // Determine what to show
  const activeResults = discoveryResults.filter((item) => {
    // Media Type filter
    if (filters.mediaType !== 'all' && item.media_type !== filters.mediaType) return false

    // 1. Genre Filter
    if (filters.genres.length > 0) {
      if (!item.genre_ids) return false
      // Must have ALL selected genres to match (AND logic)
      const hasAllGenres = filters.genres.every((id) => item.genre_ids.includes(id))
      if (!hasAllGenres) return false
    }

    // 2. Rating Filter
    if (filters.minRating !== 'all' && item.vote_average < parseInt(filters.minRating)) return false

    // Must be a movie or a TV show
    if (item.media_type !== 'movie' && item.media_type !== 'tv') return false

    return true
  })

  return (
    <View className="flex-1 bg-primary justify-start">
      <ScreenHeader title={t('search.title')} />

      <SearchBar
        onSearch={handleSearchInput}
        onSubmitSearch={handleSearchSubmit}
        onFilterPress={() => setIsFilterModalVisible(true)}
        filterActive={hasActiveFilters}
      />

      <AdvancedFilterModal
        isVisible={isFilterModalVisible}
        onClose={() => setIsFilterModalVisible(false)}
        genres={genres}
        filters={filters}
        onUpdateFilters={setFilters}
        onClearFilters={() => setFilters(defaultFilterState)}
      />

      {/* Results Grid */}
      <View className="flex-1">
        {isGlobalLoading &&
        (isHybridSearchActive ? !semanticResponse : activeResults.length === 0) ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#1DB954" />
            <Text className="text-zinc-500 mt-4 font-medium">{t('search.loading')}</Text>
          </View>
        ) : isHybridSearchActive ? (
          <SemanticGroups
            mode={submittedQuery ? 'full' : 'autocomplete'}
            nextPage={nextPage}
            onNextPage={() => nextPage && semanticSearch(searchQuery, nextPage)}
            response={semanticResponse}
            router={router}
            t={t}
          />
        ) : (
          <FlatList
            key={numColumns} // Force re-render on column change
            data={activeResults}
            keyExtractor={(item, index) => `${item.id}-${index}`}
            numColumns={numColumns}
            contentContainerStyle={{
              paddingHorizontal: padding,
              paddingBottom: 100,
            }}
            columnWrapperStyle={{ justifyContent: 'space-between' }}
            renderItem={({ item }) => (
              <View
                style={{
                  width: (width - padding * 2 - (padding / 2) * (numColumns - 1)) / numColumns,
                  marginBottom: padding / 2,
                }}
              >
                <TitleCard title={item} />
              </View>
            )}
            ListEmptyComponent={
              !isGlobalLoading ? (
                <EmptyState
                  title={t('search.noResults')}
                  description={t('search.noResultsHint')}
                  image={require('../../assets/illustrations/search-not-found.png')}
                  className="mt-20"
                />
              ) : null
            }
          />
        )}
      </View>
    </View>
  )
}

function SemanticGroups({
  mode,
  nextPage,
  onNextPage,
  response,
  router,
  t,
}: {
  mode: 'autocomplete' | 'full'
  nextPage?: number
  onNextPage: () => void
  response?: SearchResponse
  router: ReturnType<typeof useRouter>
  t: ReturnType<typeof useTranslation>['t']
}) {
  if (!response?.results.length) {
    return (
      <EmptyState
        title={t('search.noResults')}
        description={t('search.noResultsHint')}
        image={require('../../assets/illustrations/search-not-found.png')}
        className="mt-20"
      />
    )
  }
  const labels = {
    movies: t('search.movies'),
    series: t('search.tvShows'),
    people: t('search.people'),
    users: t('search.users'),
  }
  return (
    <ScrollView contentContainerStyle={{ gap: 24, padding: 16, paddingBottom: 100 }}>
      {response.groups.map((group) =>
        group.results.length ? (
          <View key={group.type} className="gap-3">
            <Text className="text-xl font-bold text-text-primary">{labels[group.type]}</Text>
            <View className="flex-row flex-wrap gap-3">
              {group.results.map((result) =>
                group.type === 'movies' || group.type === 'series' ? (
                  <View className="w-[120px]" key={result.entity.id}>
                    <TitleCard title={toMobileSearchTitle(result)} />
                  </View>
                ) : (
                  <TouchableOpacity
                    className="w-full flex-row items-center gap-3 rounded-lg bg-surface-variant p-3"
                    key={result.entity.id}
                    onPress={() => router.push(gatewayRoute(result) as never)}
                  >
                    {result.entity.imageUrl ? (
                      <Image
                        className="h-12 w-12 rounded-full"
                        source={{ uri: result.entity.imageUrl }}
                      />
                    ) : (
                      <View className="h-12 w-12 rounded-full bg-white/10" />
                    )}
                    <View className="flex-1">
                      <Text className="font-semibold text-text-primary">{result.entity.title}</Text>
                      {result.entity.entityType === 'person' ? (
                        <Text className="text-sm text-text-secondary">
                          {mobilePersonDepartment(result.entity.summary, {
                            acting: t('person.department.Acting'),
                            art: t('person.department.Art'),
                            camera: t('person.department.Camera'),
                            costumeAndMakeUp: t('person.department.Costume & Make-Up'),
                            creator: t('person.department.Creator'),
                            crew: t('person.department.Crew'),
                            directing: t('person.department.Directing'),
                            editing: t('person.department.Editing'),
                            fallback: t('person.department.Person'),
                            lighting: t('person.department.Lighting'),
                            production: t('person.department.Production'),
                            sound: t('person.department.Sound'),
                            visualEffects: t('person.department.Visual Effects'),
                            writing: t('person.department.Writing'),
                          })}
                        </Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                )
              )}
            </View>
          </View>
        ) : null
      )}
      {mode === 'full' && nextPage ? (
        <TouchableOpacity className="items-center rounded-lg bg-accent p-3" onPress={onNextPage}>
          <Text className="font-bold text-black">→</Text>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  )
}

function resetDiscoveryOnlyFilters(current: FilterState): FilterState {
  return { ...defaultFilterState, mediaType: current.mediaType }
}

function gatewayRoute({ entity }: SearchResultV1 | SearchResultV2) {
  if (entity.route) return entity.route
  if (entity.entityType === 'person') return `/person/${entity.tmdbId || entity.id}`
  if (entity.entityType === 'user') return `/${entity.id}`
  return `/title/${entity.tmdbId}?type=${entity.entityType === 'series' ? 'tv' : 'movie'}`
}
