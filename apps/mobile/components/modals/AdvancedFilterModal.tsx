import React from 'react'
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StyleSheet,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { GenreBadge } from '~/components/common/GenreBadge'
import type { TMDbGenre } from '~/types'

export type MediaTypeFilter = 'all' | 'movie' | 'tv'
export type DecadeFilter = 'all' | '2020s' | '2010s' | '2000s' | '1990s' | '1980s' | 'older'
export type RatingFilter = 'all' | '9' | '8' | '7' | '6'
export type DurationFilter = 'all' | 'under90' | '90to120' | 'over120'
export type SeasonsFilter = 'all' | '1' | '2to4' | '5plus'
export type NationalityFilter = 'all' | 'en' | 'ko' | 'ja' | 'es' | 'fr' | 'hi' | 'ru'

export interface FilterState {
  mediaType: MediaTypeFilter
  decade: DecadeFilter
  minRating: RatingFilter
  duration: DurationFilter
  seasons: SeasonsFilter
  nationality: NationalityFilter
  genres: number[]
}

export const defaultFilterState: FilterState = {
  mediaType: 'all',
  decade: 'all',
  minRating: 'all',
  duration: 'all',
  seasons: 'all',
  nationality: 'all',
  genres: [],
}

interface AdvancedFilterModalProps {
  isVisible: boolean
  onClose: () => void
  genres: TMDbGenre[]
  filters: FilterState
  onUpdateFilters: (filters: FilterState) => void
  onClearFilters: () => void
}

const FilterPill = ({
  label,
  isActive,
  onPress,
}: {
  label: string
  isActive: boolean
  onPress: () => void
}) => (
  <TouchableOpacity
    style={[styles.pill, isActive && styles.pillActive]}
    onPress={onPress}
  >
    <Text style={[styles.pillText, isActive && styles.pillTextActive]}>{label}</Text>
  </TouchableOpacity>
)

export function AdvancedFilterModal({
  isVisible,
  onClose,
  genres,
  filters,
  onUpdateFilters,
  onClearFilters,
}: AdvancedFilterModalProps) {
  const { t } = useTranslation()

  const handleClearAndClose = () => {
    onClearFilters()
    onClose()
  }

  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    onUpdateFilters({ ...filters, [key]: value })
  }

  const toggleGenre = (id: number) => {
    const newGenres = filters.genres.includes(id)
      ? filters.genres.filter((g) => g !== id)
      : [...filters.genres, id]
    updateFilter('genres', newGenres)
  }

  return (
    <Modal animationType="slide" transparent visible={isVisible} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.modalContent}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>{t('search.filter', 'Advanced Filters')}<Text className="text-accent">.</Text></Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={28} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              
              {/* Media Type */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('search.mediaType', 'Media Type')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
                  <FilterPill label="All" isActive={filters.mediaType === 'all'} onPress={() => updateFilter('mediaType', 'all')} />
                  <FilterPill label="Movies" isActive={filters.mediaType === 'movie'} onPress={() => updateFilter('mediaType', 'movie')} />
                  <FilterPill label="TV Shows" isActive={filters.mediaType === 'tv'} onPress={() => updateFilter('mediaType', 'tv')} />
                </ScrollView>
              </View>

              {/* Release Decade */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('search.releaseDecade', 'Release Decade')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
                  <FilterPill label="Any" isActive={filters.decade === 'all'} onPress={() => updateFilter('decade', 'all')} />
                  <FilterPill label="2020s" isActive={filters.decade === '2020s'} onPress={() => updateFilter('decade', '2020s')} />
                  <FilterPill label="2010s" isActive={filters.decade === '2010s'} onPress={() => updateFilter('decade', '2010s')} />
                  <FilterPill label="2000s" isActive={filters.decade === '2000s'} onPress={() => updateFilter('decade', '2000s')} />
                  <FilterPill label="1990s" isActive={filters.decade === '1990s'} onPress={() => updateFilter('decade', '1990s')} />
                  <FilterPill label="1980s" isActive={filters.decade === '1980s'} onPress={() => updateFilter('decade', '1980s')} />
                  <FilterPill label="Older" isActive={filters.decade === 'older'} onPress={() => updateFilter('decade', 'older')} />
                </ScrollView>
              </View>

              {/* Rating */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('search.minRating', 'Minimum Rating')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
                  <FilterPill label="Any" isActive={filters.minRating === 'all'} onPress={() => updateFilter('minRating', 'all')} />
                  <FilterPill label="9+ Stars" isActive={filters.minRating === '9'} onPress={() => updateFilter('minRating', '9')} />
                  <FilterPill label="8+ Stars" isActive={filters.minRating === '8'} onPress={() => updateFilter('minRating', '8')} />
                  <FilterPill label="7+ Stars" isActive={filters.minRating === '7'} onPress={() => updateFilter('minRating', '7')} />
                  <FilterPill label="6+ Stars" isActive={filters.minRating === '6'} onPress={() => updateFilter('minRating', '6')} />
                </ScrollView>
              </View>

              {/* Duration (Movies only) */}
              {(filters.mediaType === 'all' || filters.mediaType === 'movie') && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>{t('search.duration', 'Movie Duration')}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
                    <FilterPill label="Any" isActive={filters.duration === 'all'} onPress={() => updateFilter('duration', 'all')} />
                    <FilterPill label="Under 90m" isActive={filters.duration === 'under90'} onPress={() => updateFilter('duration', 'under90')} />
                    <FilterPill label="90m - 120m" isActive={filters.duration === '90to120'} onPress={() => updateFilter('duration', '90to120')} />
                    <FilterPill label="Over 120m" isActive={filters.duration === 'over120'} onPress={() => updateFilter('duration', 'over120')} />
                  </ScrollView>
                </View>
              )}

              {/* Seasons (TV only) */}
              {(filters.mediaType === 'all' || filters.mediaType === 'tv') && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>{t('search.seasons', 'TV Seasons')}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
                    <FilterPill label="Any" isActive={filters.seasons === 'all'} onPress={() => updateFilter('seasons', 'all')} />
                    <FilterPill label="1 Season (Miniseries)" isActive={filters.seasons === '1'} onPress={() => updateFilter('seasons', '1')} />
                    <FilterPill label="2-4 Seasons" isActive={filters.seasons === '2to4'} onPress={() => updateFilter('seasons', '2to4')} />
                    <FilterPill label="5+ Seasons" isActive={filters.seasons === '5plus'} onPress={() => updateFilter('seasons', '5plus')} />
                  </ScrollView>
                </View>
              )}

              {/* Nationality / Original Language */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('search.nationality', 'Origin / Location')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
                  <FilterPill label="Any" isActive={filters.nationality === 'all'} onPress={() => updateFilter('nationality', 'all')} />
                  <FilterPill label="English (US/UK)" isActive={filters.nationality === 'en'} onPress={() => updateFilter('nationality', 'en')} />
                  <FilterPill label="Korean" isActive={filters.nationality === 'ko'} onPress={() => updateFilter('nationality', 'ko')} />
                  <FilterPill label="Japanese" isActive={filters.nationality === 'ja'} onPress={() => updateFilter('nationality', 'ja')} />
                  <FilterPill label="Spanish" isActive={filters.nationality === 'es'} onPress={() => updateFilter('nationality', 'es')} />
                  <FilterPill label="French" isActive={filters.nationality === 'fr'} onPress={() => updateFilter('nationality', 'fr')} />
                  <FilterPill label="Hindi (India)" isActive={filters.nationality === 'hi'} onPress={() => updateFilter('nationality', 'hi')} />
                  <FilterPill label="Russian" isActive={filters.nationality === 'ru'} onPress={() => updateFilter('nationality', 'ru')} />
                </ScrollView>
              </View>

              {/* Genres Grid */}
              <View style={[styles.section, { borderBottomWidth: 0 }]}>
                <Text style={styles.sectionTitle}>{t('search.genres', 'Genres')}</Text>
                <View style={styles.genreList}>
                  {genres.map((genre) => (
                    <View key={genre.id} style={{ margin: 4 }}>
                      <GenreBadge
                        name={genre.name}
                        isActive={filters.genres.includes(genre.id)}
                        onPress={() => toggleGenre(genre.id)}
                      />
                    </View>
                  ))}
                </View>
              </View>

            </ScrollView>

            <View style={styles.footer}>
              <TouchableOpacity style={styles.clearButton} onPress={handleClearAndClose}>
                <Text style={styles.clearButtonText}>{t('common.clear', 'Clear All')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.doneButton} onPress={onClose}>
                <Text style={styles.doneButtonText}>{t('common.done', 'Show Results')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  safeArea: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#181818',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    height: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
    paddingHorizontal: 20,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: -0.5,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  section: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  pillRow: {
    paddingHorizontal: 20,
    gap: 10,
  },
  pill: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#2A2A2A',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  pillActive: {
    backgroundColor: 'rgba(29, 185, 84, 0.1)',
    borderColor: '#1DB954',
  },
  pillText: {
    color: '#A0A0A0',
    fontSize: 14,
    fontWeight: '600',
  },
  pillTextActive: {
    color: '#1DB954',
  },
  genreList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
    paddingHorizontal: 20,
    paddingBottom: 30,
    backgroundColor: '#181818',
  },
  clearButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: '#2A2A2A',
    flex: 1,
    marginRight: 8,
    alignItems: 'center',
  },
  clearButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  doneButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: '#1DB954',
    flex: 2,
    marginLeft: 8,
    alignItems: 'center',
  },
  doneButtonText: {
    color: '#000000',
    fontWeight: '900',
    fontSize: 16,
  },
})
