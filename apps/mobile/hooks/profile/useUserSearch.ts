// Hook for managing user search functionality
import { useState, useCallback } from 'react'
import { dbService } from '~/services/database'
import type { UserProfile } from '~/types'

export interface UseUserSearchReturn {
  searchModalVisible: boolean
  setSearchModalVisible: (visible: boolean) => void
  searchQuery: string
  searchResults: UserProfile[]
  isSearching: boolean
  handleSearch: (query: string) => Promise<void>
}

export function useUserSearch(): UseUserSearchReturn {
  const [searchModalVisible, setSearchModalVisible] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<UserProfile[]>([])
  const [isSearching, setIsSearching] = useState(false)

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query)

    if (query.length < 2) {
      setSearchResults([])
      return
    }

    setIsSearching(true)
    try {
      const results = await dbService.searchUsers(query)
      setSearchResults(results)
    } catch (error) {
      console.error('User search failed:', error)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }, [])

  return {
    searchModalVisible,
    setSearchModalVisible,
    searchQuery,
    searchResults,
    isSearching,
    handleSearch,
  }
}
