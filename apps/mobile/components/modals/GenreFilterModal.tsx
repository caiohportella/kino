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

interface GenreFilterModalProps {
  isVisible: boolean
  onClose: () => void
  genres: TMDbGenre[]
  selectedGenres: number[]
  onToggleGenre: (id: number) => void
  onClearGenres: () => void
}

export function GenreFilterModal({
  isVisible,
  onClose,
  genres,
  selectedGenres,
  onToggleGenre,
  onClearGenres,
}: GenreFilterModalProps) {
  const { t } = useTranslation()

  const handleClearAndClose = () => {
    onClearGenres()
    onClose()
  }

  return (
    <Modal animationType="slide" transparent visible={isVisible} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.modalContent}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>{t('search.filterByGenre', 'Filter by Genre')}</Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={28} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.genreList}>
              {genres.map((genre) => (
                <View key={genre.id} style={{ margin: 6 }}>
                  <GenreBadge
                    name={genre.name}
                    isActive={selectedGenres.includes(genre.id)}
                    onPress={() => onToggleGenre(genre.id)}
                  />
                </View>
              ))}
            </ScrollView>

            <View style={styles.footer}>
              <TouchableOpacity style={styles.clearButton} onPress={handleClearAndClose}>
                <Text style={styles.clearButtonText}>{t('common.clear', 'Clear')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.doneButton} onPress={onClose}>
                <Text style={styles.doneButtonText}>{t('common.done', 'Done')}</Text>
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
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    height: '75%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  genreList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#333',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  clearButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: '#333',
    flex: 1,
    marginRight: 8,
    alignItems: 'center',
  },
  clearButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  doneButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: '#1DB954',
    flex: 1,
    marginLeft: 8,
    alignItems: 'center',
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
})
