import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  LayoutAnimation,
  useWindowDimensions,
} from 'react-native'
import { SearchBar } from '~/components/search/SearchBar'
import { TitleCard } from '~/components/common/TitleCard'
import { useSearch } from '@/hooks/useSearch'
import { useUpstashSearch } from '@/hooks/useUpstashSearch'
import { getTMDbService } from '~/services/tmdb'
import type { TMDbTitle, TMDbGenre } from '~/types'
import { ScreenHeader } from '~/components/layout/ScreenHeader'
import { EmptyState } from '~/components/EmptyState'
import { useTranslation } from 'react-i18next'
import { AdvancedFilterModal, FilterState, defaultFilterState } from '~/components/modals/AdvancedFilterModal'

export default function SearchScreen() {
  const { t } = useTranslation()
  const {
    results: tmdbResults,
    loading: tmdbLoading,
    search: tmdbSearch,
    clearResults: clearTmdbResults,
  } = useSearch()
  const {
    results: semanticResults,
    loading: semanticLoading,
    search: semanticSearch,
    clearResults: clearSemanticResults,
  } = useUpstashSearch()
  const { width } = useWindowDimensions()

  // Responsive Grid
  const numColumns = width > 768 ? 5 : width > 480 ? 4 : 3
  const padding = 16

  const [genres, setGenres] = useState<TMDbGenre[]>([])

  // Advanced Filter state
  const [filters, setFilters] = useState<FilterState>(defaultFilterState)
  const [selectedThemes, setSelectedThemes] = useState<string[]>([]) // Keep this for now

  const [discoveryResults, setDiscoveryResults] = useState<TMDbTitle[]>([])
  const [loading, setLoading] = useState(false)

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false)

  const tmdb = getTMDbService()

  const isHybridSearchActive = searchQuery.length > 0 || selectedThemes.length > 0
  const isGlobalLoading = loading || tmdbLoading || semanticLoading
  // Check if any filter is active
  const hasActiveFilters = filters.mediaType !== 'all' || filters.decade !== 'all' || filters.minRating !== 'all' || filters.duration !== 'all' || filters.seasons !== 'all' || filters.nationality !== 'all' || filters.genres.length > 0

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
  }, [])

  // Helper to get decade start year
  const getDecadeStart = (decade: string) => {
    switch (decade) {
      case '2020s': return '2020-01-01'
      case '2010s': return '2010-01-01'
      case '2000s': return '2000-01-01'
      case '1990s': return '1990-01-01'
      case '1980s': return '1980-01-01'
      default: return null
    }
  }
  
  const getDecadeEnd = (decade: string) => {
    switch (decade) {
      case '2020s': return '2029-12-31'
      case '2010s': return '2019-12-31'
      case '2000s': return '2009-12-31'
      case '1990s': return '1999-12-31'
      case '1980s': return '1989-12-31'
      case 'older': return '1979-12-31'
      default: return null
    }
  }

  // Hybrid Search / Discovery Trigger
  useEffect(() => {
    const executeSearch = async () => {
      // 1. Semantic Search (Text OR Themes active)
      if (isHybridSearchActive) {
        // Construct semantic query
        const genreNames = genres.filter((g) => filters.genres.includes(g.id)).map((g) => g.name)

        let constructedQuery = searchQuery

        // Append context to the query
        if (selectedThemes.length > 0) {
          constructedQuery += ` ${selectedThemes.join(' ')}`
        }
        if (genreNames.length > 0) {
          constructedQuery += ` ${genreNames.join(' ')}`
        }

        // Fire both searches for robust results
        semanticSearch(constructedQuery)
        tmdbSearch(searchQuery) // TMDb keyword search is separate
      }
      // 2. Standard Discovery (Filters Active)
      else if (hasActiveFilters) {
        setLoading(true)
        clearSemanticResults()
        clearTmdbResults()
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
              }
              else if (filters.duration === 'over120') movieParams['with_runtime.gte'] = '120'
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
        clearTmdbResults()
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
  }, [searchQuery, filters, selectedThemes, isHybridSearchActive, genres])

  // Handlers
  const handleSearchInput = (text: string) => {
    setSearchQuery(text)
  }

  // Determine what to show
  const rawResults = isHybridSearchActive
    ? semanticResults.length > 0
      ? semanticResults
      : tmdbResults
    : discoveryResults

  // Local filtering for Keyword searches (semantic/tmdb) where backend parameters weren't used
  const activeResults = rawResults.filter((item) => {
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
        {isGlobalLoading && activeResults.length === 0 ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#1DB954" />
            <Text className="text-zinc-500 mt-4 font-medium">{t('search.loading')}</Text>
          </View>
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
