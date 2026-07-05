import React, { useState, useRef, useEffect } from 'react'
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  LayoutAnimation,
  Keyboard,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'

interface SearchBarProps {
  onSearch: (query: string) => void
  placeholder?: string
  isLoading?: boolean
  onFilterPress?: () => void
  filterActive?: boolean
}

export function SearchBar({
  onSearch,
  placeholder,
  isLoading = false,
  onFilterPress,
  filterActive = false,
}: SearchBarProps) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<TextInput>(null)

  // Use LayoutAnimation for smooth transitions
  useEffect(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
  }, [isFocused, query.length, isLoading])

  const handleSearch = () => {
    if (query.trim()) onSearch(query.trim())
    inputRef.current?.blur()
  }

  const handleClear = () => {
    setQuery('')
    onSearch('')
    inputRef.current?.focus()
  }

  const handleCancel = () => {
    setQuery('')
    onSearch('')
    inputRef.current?.blur()
    setIsFocused(false)
    Keyboard.dismiss()
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        {/* Fallback for Liquid Glass Effect - using translucent bg instead of BlurView for stability */}
        <View style={[styles.blurContainer, styles.glassBackground]}>
          <View style={styles.contentContainer}>
            <Ionicons name="search" size={20} color="rgba(255,255,255,0.6)" style={styles.icon} />

            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder={placeholder || t('search.placeholder')}
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={query}
              onChangeText={(text) => {
                setQuery(text)
                onSearch(text)
              }}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
              autoCapitalize="none"
              textAlignVertical="center"
            />

            {isLoading ? (
              <Ionicons name="reload" size={18} color="#1DB954" style={styles.loadingIcon} />
            ) : (
              query.length > 0 && (
                <TouchableOpacity
                  onPress={handleClear}
                  activeOpacity={0.7}
                  style={styles.clearButton}
                >
                  <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.6)" />
                </TouchableOpacity>
              )
            )}
          </View>
        </View>
      </View>

      {/* Filter Button */}
      {onFilterPress && !isFocused && query.length === 0 && (
        <TouchableOpacity onPress={onFilterPress} style={styles.filterButton}>
          <Ionicons
            name="options"
            size={22}
            color={filterActive ? '#1DB954' : 'rgba(255,255,255,0.6)'}
          />
          {filterActive && <View style={styles.filterActiveDot} />}
        </TouchableOpacity>
      )}

      {(isFocused || query.length > 0) && (
        <View style={styles.cancelButtonContainer}>
          <TouchableOpacity onPress={handleCancel} style={styles.cancelButton}>
            <Text style={styles.cancelText}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  searchContainer: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    // backgroundColor moved to glassBackground
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  glassBackground: {
    backgroundColor: 'rgba(30, 30, 30, 0.8)', // Dark translucent background
  },
  blurContainer: {
    // Renamed from usage but keeping style name for structure compatibility if needed, functionally just a container now
    paddingHorizontal: 12,
    height: 44,
    justifyContent: 'center',
  },
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    color: '#FFFFFF',
    paddingVertical: 0,
    height: '100%',
  },
  icon: {
    opacity: 0.9,
  },
  clearButton: {
    padding: 4,
  },
  loadingIcon: {
    opacity: 0.8,
  },
  filterButton: {
    marginLeft: 12,
    padding: 6,
  },
  filterActiveDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1DB954',
  },
  cancelButtonContainer: {
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  cancelText: {
    color: '#1DB954',
    fontSize: 16,
    fontWeight: '600',
  },
})
