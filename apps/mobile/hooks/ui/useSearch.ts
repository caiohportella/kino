// Search hook for TMDb search
import { useState, useCallback } from 'react'
import { getTMDbService } from '~/services/tmdb'
import type { TMDbTitle } from '~/types'

export function useSearch() {
  const [results, setResults] = useState<TMDbTitle[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const search = useCallback(async (query: string) => {
    if (!query.trim()) {
      setResults([])
      return
    }

    setLoading(true)
    setError(null)

    try {
      const tmdb = getTMDbService()
      const response = await tmdb.search(query)
      setResults(response.results)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed')
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  const clearResults = useCallback(() => {
    setResults([])
    setError(null)
  }, [])

  return {
    results,
    loading,
    error,
    search,
    clearResults,
  }
}
